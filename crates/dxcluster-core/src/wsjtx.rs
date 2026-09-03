//! WSJT-X local UDP feed: turn the decodes from a running WSJT-X instance
//! (Settings → Reporting → UDP Server) into synthetic DX spots.
//!
//! Not a cluster transport — a local reception source, like the RBN / PSK
//! Reporter feeds. Opt-in, off by default.
//!
//! Protocol: big-endian Qt `QDataStream`, magic `0xadbccbda`. We read only the
//! Status (1) and Decode (2) messages; everything else is ignored. Unknown
//! trailing fields (newer schema versions append them) are simply not read, so
//! the parser stays forward-compatible.
//! See the header comments in `Network/NetworkMessage.hpp` of the WSJT-X source.

use std::io;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::time::Duration;

use once_cell::sync::Lazy;
use regex::Regex;
use socket2::{Domain, Protocol, Socket, Type};
use tokio::net::UdpSocket;
use tokio::sync::mpsc;

pub const WSJTX_MAGIC: u32 = 0xadbc_cbda;
pub const DEFAULT_BIND: &str = "127.0.0.1:2237";
/// WSJT-X's default UDP port, used when the configured address omits one.
pub const DEFAULT_PORT: u16 = 2237;

// --- QDataStream reader ------------------------------------------------------

/// A cursor over a big-endian Qt-serialised datagram. Every read is fallible
/// and returns `None` on underflow.
struct QReader<'a> {
    buf: &'a [u8],
    pos: usize,
}

impl<'a> QReader<'a> {
    fn new(buf: &'a [u8]) -> Self {
        Self { buf, pos: 0 }
    }
    fn take(&mut self, n: usize) -> Option<&'a [u8]> {
        let end = self.pos.checked_add(n)?;
        let s = self.buf.get(self.pos..end)?;
        self.pos = end;
        Some(s)
    }
    fn u8(&mut self) -> Option<u8> {
        self.take(1).map(|b| b[0])
    }
    fn u32(&mut self) -> Option<u32> {
        self.take(4)
            .map(|b| u32::from_be_bytes(b.try_into().unwrap()))
    }
    fn i32(&mut self) -> Option<i32> {
        self.u32().map(|v| v as i32)
    }
    fn u64(&mut self) -> Option<u64> {
        self.take(8)
            .map(|b| u64::from_be_bytes(b.try_into().unwrap()))
    }
    fn f64(&mut self) -> Option<f64> {
        self.take(8)
            .map(|b| f64::from_be_bytes(b.try_into().unwrap()))
    }
    fn bool(&mut self) -> Option<bool> {
        self.u8().map(|v| v != 0)
    }
    /// A Qt utf8 string: `quint32` byte count then the bytes; `0xffffffff` is a
    /// null string (returned here as empty).
    fn utf8(&mut self) -> Option<String> {
        let len = self.u32()?;
        if len == u32::MAX {
            return Some(String::new());
        }
        let bytes = self.take(len as usize)?;
        Some(String::from_utf8_lossy(bytes).into_owned())
    }
}

// --- message parsing --------------------------------------------------------

#[derive(Debug, Clone, PartialEq)]
pub enum WsjtxMessage {
    /// Status (1) — carries the dial frequency and operator callsign.
    Status {
        dial_hz: u64,
        mode: String,
        de_call: String,
    },
    /// Decode (2) — one decoded transmission.
    Decode {
        df_hz: u32,
        snr: i32,
        mode: String,
        message: String,
    },
    /// Any other message type (heartbeat, clear, …).
    Other,
}

/// Parse one datagram. `None` if the magic is wrong or the buffer is truncated.
pub fn parse_message(buf: &[u8]) -> Option<WsjtxMessage> {
    let mut r = QReader::new(buf);
    if r.u32()? != WSJTX_MAGIC {
        return None;
    }
    let _schema = r.u32()?;
    let msg_type = r.u32()?;
    let _id = r.utf8()?;
    match msg_type {
        1 => {
            let dial_hz = r.u64()?;
            let mode = r.utf8()?;
            let _dx_call = r.utf8()?;
            let _report = r.utf8()?;
            let _tx_mode = r.utf8()?;
            let _tx_enabled = r.bool()?;
            let _transmitting = r.bool()?;
            let _decoding = r.bool()?;
            let _rx_df = r.i32()?;
            let _tx_df = r.i32()?;
            let de_call = r.utf8()?;
            Some(WsjtxMessage::Status {
                dial_hz,
                mode,
                de_call,
            })
        }
        2 => {
            let _new = r.bool()?;
            let _time_ms = r.u32()?; // QTime, ms since midnight UTC
            let snr = r.i32()?;
            let _dt = r.f64()?;
            let df_hz = r.u32()?;
            let mode = r.utf8()?;
            let message = r.utf8()?;
            Some(WsjtxMessage::Decode {
                df_hz,
                snr,
                mode,
                message,
            })
        }
        _ => Some(WsjtxMessage::Other),
    }
}

// --- decode-message callsign extraction -------------------------------------

static CALLSIGN_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^[A-Z0-9]{1,3}[0-9][A-Z0-9]{0,3}[A-Z](?:/[A-Z0-9]{1,4})?$").unwrap());
static GRID4_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^[A-R]{2}[0-9]{2}$").unwrap());

fn is_callsign(s: &str) -> bool {
    CALLSIGN_RE.is_match(s)
}
fn is_grid4(s: &str) -> bool {
    // `RR73` is the roger-73 token, never a locator in a WSJT-X message even
    // though it matches the pattern.
    s != "RR73" && GRID4_RE.is_match(s)
}
fn strip_hash(s: &str) -> &str {
    s.trim_start_matches('<').trim_end_matches('>')
}

/// The transmitting station (the one we decoded) and its grid, if present.
/// `None` for free text, unresolved `<...>` hashes, and anything unparseable.
///
/// - `CQ [DX|EU|POTA|001…] <TX> [GRID]` → `TX`
/// - `<TO> <TX> [report|RR73|73|GRID]`  → the second token
pub fn parse_decode_message(msg: &str) -> Option<(String, Option<String>)> {
    let upper = msg.trim().to_ascii_uppercase();
    let mut tokens: Vec<&str> = upper.split_whitespace().collect();
    // Some contest / RTTY-RU messages lead with "TU;".
    if tokens.first().is_some_and(|t| t.starts_with("TU")) {
        tokens.remove(0);
    }
    if tokens.is_empty() {
        return None;
    }

    let (call_tok, grid_tok): (Option<&str>, Option<&str>) = if tokens[0] == "CQ" {
        let mut i = 1;
        // Skip one directional / contest modifier that isn't itself a callsign.
        if let Some(t) = tokens.get(i) {
            if !is_callsign(strip_hash(t)) && tokens.len() > i + 1 {
                i += 1;
            }
        }
        (tokens.get(i).copied(), tokens.get(i + 1).copied())
    } else if tokens.len() >= 2 {
        (Some(tokens[1]), tokens.get(2).copied())
    } else {
        return None;
    };

    let call = strip_hash(call_tok?);
    if !is_callsign(call) {
        return None;
    }
    let grid = grid_tok
        .map(strip_hash)
        .filter(|g| is_grid4(g))
        .map(str::to_string);
    Some((call.to_string(), grid))
}

// --- the feed --------------------------------------------------------------

/// One decoded station, ready to become a synthetic spot.
#[derive(Debug, Clone, PartialEq)]
pub struct WsjtxSpot {
    pub dx_call: String,
    pub grid: Option<String>,
    pub freq_khz: f64,
    pub snr_db: i32,
    pub mode: String,
    pub message: String,
    /// The operator's own callsign from the last Status — used to place the
    /// synthetic spot's "spotter" (you) on the map / for spotter-side filters.
    pub de_call: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum WsjtxEvent {
    /// Socket bound, waiting for the first datagram.
    Listening,
    /// Datagrams are arriving.
    Receiving,
    Spot(WsjtxSpot),
    /// Non-fatal error (the loop keeps going); a fatal bind error ends the task.
    Error(String),
}

/// Parse a `host` or `host:port` string, defaulting the port to WSJT-X's 2237.
pub fn parse_bind(s: &str) -> Option<SocketAddr> {
    let s = s.trim();
    s.parse::<SocketAddr>().ok().or_else(|| {
        s.parse::<IpAddr>()
            .ok()
            .map(|ip| SocketAddr::new(ip, DEFAULT_PORT))
    })
}

/// Build the receive socket. `SO_REUSEADDR` (not `SO_REUSEPORT`) lets several
/// programs on the machine (WSJT-X's own tools: JTAlert, GridTracker, QLog…)
/// each get a full copy of the multicast stream — `SO_REUSEPORT` would instead
/// load-balance datagrams between them, so we'd only see a fraction. For a
/// multicast address we bind the wildcard and join the group on every local
/// interface (matching what Qt-based tools do).
fn open_socket(want: SocketAddr) -> io::Result<UdpSocket> {
    let sock = Socket::new(Domain::IPV4, Type::DGRAM, Some(Protocol::UDP))?;
    sock.set_reuse_address(true)?;
    sock.set_nonblocking(true)?;

    let multicast = want.ip().is_multicast();
    let bind_to = if multicast {
        SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), want.port())
    } else {
        want
    };
    sock.bind(&bind_to.into())?;

    if let (true, IpAddr::V4(group)) = (multicast, want.ip()) {
        // Join on the OS default multicast interface, and also on every local
        // IPv4 interface — WSJT-X's loopback multicast is only delivered to
        // members on the interface it was sent from, which may not be the
        // default one on a machine with docker/VPN/multiple NICs.
        let mut ifaces = vec![Ipv4Addr::UNSPECIFIED, Ipv4Addr::LOCALHOST];
        if let Ok(list) = if_addrs::get_if_addrs() {
            ifaces.extend(list.into_iter().filter_map(|i| match i.ip() {
                IpAddr::V4(v4) => Some(v4),
                IpAddr::V6(_) => None,
            }));
        }
        let mut joined = 0usize;
        for iface in ifaces {
            if sock.join_multicast_v4(&group, &iface).is_ok() {
                joined += 1;
            }
        }
        if joined == 0 {
            // Surface the real error from the default-interface attempt.
            sock.join_multicast_v4(&group, &Ipv4Addr::UNSPECIFIED)?;
        }
        log::info!("wsjtx: joined multicast {group} on {joined} interface(s)");
    }
    log::info!("wsjtx: listening on {bind_to} (multicast: {multicast})");
    UdpSocket::from_std(sock.into())
}

/// Listen on `bind` (`host` or `host:port`; a multicast address is joined) and
/// forward decoded stations until `tx` is dropped or the task is aborted.
pub async fn run(bind: String, tx: mpsc::UnboundedSender<WsjtxEvent>) {
    let Some(want) = parse_bind(&bind) else {
        let _ = tx.send(WsjtxEvent::Error(format!("bad address '{bind}'")));
        return;
    };
    let sock = match open_socket(want) {
        Ok(s) => s,
        Err(e) => {
            log::warn!("wsjtx: bind {want} failed: {e}");
            let _ = tx.send(WsjtxEvent::Error(format!("bind {want} failed: {e}")));
            return;
        }
    };
    if tx.send(WsjtxEvent::Listening).is_err() {
        return;
    }

    let mut buf = vec![0u8; 8192];
    let mut dial_hz: Option<u64> = None;
    let mut status_mode = String::new();
    let mut de_call = String::new();
    let mut announced = false;

    loop {
        let n = match sock.recv_from(&mut buf).await {
            Ok((n, _)) => n,
            Err(e) => {
                let _ = tx.send(WsjtxEvent::Error(format!("recv error: {e}")));
                tokio::time::sleep(Duration::from_secs(2)).await;
                continue;
            }
        };
        if !announced {
            announced = true;
            log::info!("wsjtx: first datagram received ({n} bytes)");
            if tx.send(WsjtxEvent::Receiving).is_err() {
                return;
            }
        }
        match parse_message(&buf[..n]) {
            Some(WsjtxMessage::Status {
                dial_hz: d,
                mode,
                de_call: dc,
            }) => {
                dial_hz = Some(d);
                if !mode.is_empty() {
                    status_mode = mode;
                }
                if !dc.is_empty() {
                    de_call = dc.to_ascii_uppercase();
                }
            }
            Some(WsjtxMessage::Decode {
                df_hz,
                snr,
                mode,
                message,
            }) => {
                let Some(dial) = dial_hz else { continue };
                let Some((dx_call, grid)) = parse_decode_message(&message) else {
                    continue;
                };
                // The Decode `mode` field is the full mode string in modern
                // WSJT-X but a single glyph in older builds — fall back to the
                // mode from the last Status then.
                let m = if mode.trim().len() > 1 {
                    mode.trim().to_string()
                } else {
                    status_mode.clone()
                };
                let spot = WsjtxSpot {
                    dx_call,
                    grid,
                    freq_khz: (dial + df_hz as u64) as f64 / 1000.0,
                    snr_db: snr,
                    mode: m,
                    message: message.trim().to_string(),
                    de_call: de_call.clone(),
                };
                if tx.send(WsjtxEvent::Spot(spot)).is_err() {
                    return;
                }
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn u32b(v: &mut Vec<u8>, x: u32) {
        v.extend_from_slice(&x.to_be_bytes());
    }
    fn u64b(v: &mut Vec<u8>, x: u64) {
        v.extend_from_slice(&x.to_be_bytes());
    }
    fn f64b(v: &mut Vec<u8>, x: f64) {
        v.extend_from_slice(&x.to_be_bytes());
    }
    fn strb(v: &mut Vec<u8>, s: &str) {
        u32b(v, s.len() as u32);
        v.extend_from_slice(s.as_bytes());
    }
    fn header(v: &mut Vec<u8>, msg_type: u32) {
        u32b(v, WSJTX_MAGIC);
        u32b(v, 2); // schema
        u32b(v, msg_type);
        strb(v, "WSJT-X"); // id
    }

    #[test]
    fn parses_a_status_message() {
        let mut b = Vec::new();
        header(&mut b, 1);
        u64b(&mut b, 14_074_000);
        strb(&mut b, "FT8"); // mode
        strb(&mut b, ""); // dx call
        strb(&mut b, ""); // report
        strb(&mut b, "FT8"); // tx mode
        b.extend_from_slice(&[0, 0, 1]); // tx enabled / transmitting / decoding
        u32b(&mut b, 1500); // rx df
        u32b(&mut b, 1500); // tx df
        strb(&mut b, "HA5XYZ"); // de call
        strb(&mut b, "JN97MN"); // de grid + trailing fields we don't read

        assert_eq!(
            parse_message(&b),
            Some(WsjtxMessage::Status {
                dial_hz: 14_074_000,
                mode: "FT8".into(),
                de_call: "HA5XYZ".into(),
            })
        );
    }

    #[test]
    fn parses_a_decode_message() {
        let mut b = Vec::new();
        header(&mut b, 2);
        b.push(1); // new
        u32b(&mut b, 44_460_000); // time ms
        u32b(&mut b, (-12i32) as u32); // snr
        f64b(&mut b, 0.2); // dt
        u32b(&mut b, 1633); // df
        strb(&mut b, "FT8");
        strb(&mut b, "CQ DL1ABC JO31");
        b.extend_from_slice(&[0, 0]); // low conf / off air

        match parse_message(&b) {
            Some(WsjtxMessage::Decode {
                df_hz,
                snr,
                mode,
                message,
            }) => {
                assert_eq!(df_hz, 1633);
                assert_eq!(snr, -12);
                assert_eq!(mode, "FT8");
                assert_eq!(message, "CQ DL1ABC JO31");
            }
            other => panic!("expected Decode, got {other:?}"),
        }
    }

    #[test]
    fn rejects_bad_magic_and_truncation() {
        assert_eq!(parse_message(b"not a wsjtx packet"), None);
        let mut b = Vec::new();
        u32b(&mut b, WSJTX_MAGIC);
        u32b(&mut b, 2);
        assert_eq!(parse_message(&b), None); // no type / id
    }

    #[test]
    fn utf8_null_is_empty() {
        let mut b = Vec::new();
        u32b(&mut b, u32::MAX);
        u32b(&mut b, 3);
        b.extend_from_slice(b"abc");
        let mut r = QReader::new(&b);
        assert_eq!(r.utf8(), Some(String::new()));
        assert_eq!(r.utf8(), Some("abc".to_string()));
        assert_eq!(r.utf8(), None);
    }

    #[test]
    fn decode_message_cq() {
        assert_eq!(
            parse_decode_message("CQ DL1ABC JO31"),
            Some(("DL1ABC".into(), Some("JO31".into())))
        );
        assert_eq!(
            parse_decode_message("CQ DX HA5XYZ"),
            Some(("HA5XYZ".into(), None))
        );
        assert_eq!(
            parse_decode_message("cq pota w1abc fn42"),
            Some(("W1ABC".into(), Some("FN42".into())))
        );
        assert_eq!(
            parse_decode_message("CQ 599 OM3ABC"),
            Some(("OM3ABC".into(), None))
        );
    }

    #[test]
    fn decode_message_qso_spots_the_transmitter() {
        // Second token is who transmitted — that's who we heard.
        assert_eq!(
            parse_decode_message("HA5XYZ DL1ABC -12"),
            Some(("DL1ABC".into(), None))
        );
        assert_eq!(
            parse_decode_message("HA5XYZ DL1ABC RR73"),
            Some(("DL1ABC".into(), None))
        );
        assert_eq!(
            parse_decode_message("HA5XYZ DL1ABC JN88"),
            Some(("DL1ABC".into(), Some("JN88".into())))
        );
        assert_eq!(
            parse_decode_message("HA5XYZ <DL1ABC> R-09"),
            Some(("DL1ABC".into(), None))
        );
        assert_eq!(
            parse_decode_message("TU; K1ABC W9XYZ R 579 MA"),
            Some(("W9XYZ".into(), None))
        );
    }

    #[test]
    fn parse_bind_defaults_the_port() {
        assert_eq!(
            parse_bind("239.255.0.1"),
            Some("239.255.0.1:2237".parse().unwrap())
        );
        assert_eq!(
            parse_bind(" 127.0.0.1:5000 "),
            Some("127.0.0.1:5000".parse().unwrap())
        );
        assert_eq!(parse_bind("not an address"), None);
    }

    #[test]
    fn decode_message_rejects_junk() {
        assert_eq!(parse_decode_message("HELLO THERE"), None);
        assert_eq!(parse_decode_message("HA5XYZ <...> -12"), None);
        assert_eq!(parse_decode_message("CQ"), None);
        assert_eq!(parse_decode_message(""), None);
        assert_eq!(parse_decode_message("73 GL"), None);
    }
}
