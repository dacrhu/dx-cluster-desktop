//! Push a spot to a local logging program so it *pre-fills its entry window* —
//! nothing is ever saved from here. Fire-and-forget over UDP, in either of the
//! two wire formats loggers accept (chosen by the user), mirroring the sibling
//! project cwrobot (`github.com/dacrhu/cwrobot`, `models/{qso,adif,wsjtx_udp}`):
//!
//! - [`LogFormat::Wsjtx`] — a WSJT-X **Status (type 1)** datagram. QLog,
//!   JTAlert, GridTracker and Log4OM all watch for this and copy the DX call /
//!   grid / dial frequency / mode into their logging form.
//! - [`LogFormat::Adif`] — a bare partial ADIF record, the "ADIF over UDP"
//!   convention simpler loggers (Log4OM-style) listen for.
//!
//! Not a cluster transport — a one-way local hint, opt-in and off by default.

use std::net::UdpSocket;

use serde::{Deserialize, Serialize};

/// WSJT-X Network Message magic (big-endian, `QDataStream` default order).
const WSJTX_MAGIC: u32 = 0xadbc_cbda;
/// Schema every current WSJT-X build sends.
const WSJTX_SCHEMA: u32 = 3;
const MSG_STATUS: u32 = 1;
const CLIENT_ID: &str = "DX Cluster Desktop";

/// The wire format to send a prepared-QSO hint in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogFormat {
    /// WSJT-X Status (type 1) datagram.
    Wsjtx,
    /// Bare partial ADIF record.
    Adif,
}

/// Everything we know about the QSO the operator is about to start.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QsoHint {
    pub call: String,
    pub freq_hz: f64,
    /// `rigctld`-style mode name (`"CW"`, `"USB"`, `"PKTUSB"`, …).
    #[serde(default)]
    pub mode: String,
    #[serde(default)]
    pub band: Option<String>,
    #[serde(default)]
    pub grid: Option<String>,
    #[serde(default)]
    pub comment: Option<String>,
    /// The operator's own callsign / grid, for the Status message's DE fields.
    #[serde(default)]
    pub my_call: Option<String>,
    #[serde(default)]
    pub my_grid: Option<String>,
}

// --- QDataStream writer ---------------------------------------------------

fn put_u32(v: &mut Vec<u8>, x: u32) {
    v.extend_from_slice(&x.to_be_bytes());
}
fn put_u64(v: &mut Vec<u8>, x: u64) {
    v.extend_from_slice(&x.to_be_bytes());
}
fn put_bool(v: &mut Vec<u8>, x: bool) {
    v.push(x as u8);
}
/// Qt `QByteArray` / utf8 field: `quint32` byte length then the bytes.
fn put_str(v: &mut Vec<u8>, s: &str) {
    put_u32(v, s.len() as u32);
    v.extend_from_slice(s.as_bytes());
}

/// Build a WSJT-X **Status (type 1)** datagram carrying `hint`. Field order is
/// from WSJT-X's `Network/NetworkMessage.hpp` (schema 3). Receivers pre-fill
/// their logging form from `DialFrequency` / `Mode` / `DXCall` / `DXGrid` /
/// `DECall` / `DEGrid`; the rest is filled with quiescent defaults.
pub fn status_datagram(hint: &QsoHint) -> Vec<u8> {
    let mut v = Vec::with_capacity(160);
    put_u32(&mut v, WSJTX_MAGIC);
    put_u32(&mut v, WSJTX_SCHEMA);
    put_u32(&mut v, MSG_STATUS);
    put_str(&mut v, CLIENT_ID);

    put_u64(&mut v, hint.freq_hz.max(0.0).round() as u64); // DialFrequency
    put_str(&mut v, &hint.mode); // Mode
    put_str(&mut v, &hint.call.to_ascii_uppercase()); // DXCall
    put_str(&mut v, ""); // Report
    put_str(&mut v, &hint.mode); // TxMode
    put_bool(&mut v, false); // TxEnabled
    put_bool(&mut v, false); // Transmitting
    put_bool(&mut v, false); // Decoding
    put_u32(&mut v, 0); // RxDF
    put_u32(&mut v, 0); // TxDF
    put_str(&mut v, hint.my_call.as_deref().unwrap_or("")); // DECall
    put_str(&mut v, hint.my_grid.as_deref().unwrap_or("")); // DEGrid
    put_str(&mut v, hint.grid.as_deref().unwrap_or("")); // DXGrid
    put_bool(&mut v, false); // TxWatchdog
    put_str(&mut v, ""); // SubMode
    put_bool(&mut v, false); // FastMode
    v.push(0); // SpecialOperationMode (quint8, 0 = NONE)
    put_u32(&mut v, u32::MAX); // FrequencyTolerance (invalid)
    put_u32(&mut v, u32::MAX); // TRPeriod (invalid)
    put_str(&mut v, ""); // ConfigurationName
    put_str(&mut v, ""); // TxMessage
    v
}

// --- bare ADIF ----------------------------------------------------------

fn adif_field(name: &str, value: &str) -> String {
    format!("<{}:{}>{}", name, value.len(), value)
}

/// A bare partial ADIF record for `hint`, terminated with `<EOR>`. Only fields
/// we actually have are emitted (ADIF has no "blank" — a field is present or
/// absent).
pub fn bare_adif(hint: &QsoHint) -> String {
    let mut parts = vec![adif_field("CALL", &hint.call.to_ascii_uppercase())];
    if hint.freq_hz > 0.0 {
        parts.push(adif_field(
            "FREQ",
            &format!("{:.6}", hint.freq_hz / 1_000_000.0),
        ));
    }
    if let Some(b) = &hint.band {
        parts.push(adif_field("BAND", b));
    }
    if !hint.mode.is_empty() {
        parts.push(adif_field("MODE", &hint.mode));
    }
    if let Some(g) = &hint.grid {
        if !g.is_empty() {
            parts.push(adif_field("GRIDSQUARE", g));
        }
    }
    if let Some(c) = &hint.comment {
        if !c.is_empty() {
            parts.push(adif_field("COMMENT", c));
        }
    }
    parts.push("<EOR>".to_string());
    parts.join("") + "\n"
}

/// The bytes we'd send for `fmt`.
pub fn datagram(fmt: LogFormat, hint: &QsoHint) -> Vec<u8> {
    match fmt {
        LogFormat::Wsjtx => status_datagram(hint),
        LogFormat::Adif => bare_adif(hint).into_bytes(),
    }
}

/// Send to `host:port`, fire-and-forget (no reply expected).
///
/// For [`LogFormat::Wsjtx`] a **blank Status is sent first**, then the real one
/// ~60 ms later: loggers that track WSJT-X only react to a *change* in DXCall,
/// so without the blank a second identical push (after the operator cleared
/// the entry form) would be ignored. Blocking — call off the UI thread.
pub fn send(host: &str, port: u16, fmt: LogFormat, hint: &QsoHint) -> std::io::Result<()> {
    let sock = UdpSocket::bind("0.0.0.0:0")?;
    if fmt == LogFormat::Wsjtx {
        let blank = QsoHint {
            call: String::new(),
            ..hint.clone()
        };
        sock.send_to(&status_datagram(&blank), (host, port))?;
        std::thread::sleep(std::time::Duration::from_millis(60));
    }
    sock.send_to(&datagram(fmt, hint), (host, port))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hint() -> QsoHint {
        QsoHint {
            call: "dl1abc".into(),
            freq_hz: 14_074_000.0,
            mode: "PKTUSB".into(),
            band: Some("20m".into()),
            grid: Some("JO31".into()),
            comment: Some("via cluster".into()),
            my_call: Some("HA5XYZ".into()),
            my_grid: Some("JN97MN".into()),
        }
    }

    #[test]
    fn status_datagram_header_and_call() {
        let d = status_datagram(&hint());
        assert_eq!(&d[0..4], &WSJTX_MAGIC.to_be_bytes());
        assert_eq!(&d[4..8], &WSJTX_SCHEMA.to_be_bytes());
        assert_eq!(&d[8..12], &MSG_STATUS.to_be_bytes());
        // The DX call, upper-cased, appears verbatim in the payload.
        let needle = b"DL1ABC";
        assert!(
            d.windows(needle.len()).any(|w| w == needle),
            "DX call not found in datagram"
        );
        // Dial frequency (u64) sits right after the client-id string.
        let id_end = 12 + 4 + CLIENT_ID.len();
        let dial = u64::from_be_bytes(d[id_end..id_end + 8].try_into().unwrap());
        assert_eq!(dial, 14_074_000);
    }

    #[test]
    fn bare_adif_record() {
        let a = bare_adif(&hint());
        assert!(a.starts_with("<CALL:6>DL1ABC"));
        assert!(a.contains("<FREQ:9>14.074000"));
        assert!(a.contains("<BAND:3>20m"));
        assert!(a.contains("<MODE:6>PKTUSB"));
        assert!(a.contains("<GRIDSQUARE:4>JO31"));
        assert!(a.trim_end().ends_with("<EOR>"));
    }

    #[test]
    fn adif_omits_absent_fields() {
        let a = bare_adif(&QsoHint {
            call: "W1AW".into(),
            freq_hz: 0.0,
            mode: String::new(),
            ..Default::default()
        });
        assert_eq!(a, "<CALL:4>W1AW<EOR>\n");
    }

    /// `send` emits a blank Status then the real one for WSJT-X (so a repeated
    /// push registers), but just one datagram for bare ADIF.
    #[test]
    fn send_wsjtx_nudges_with_a_blank_first() {
        let rx = UdpSocket::bind("127.0.0.1:0").unwrap();
        rx.set_read_timeout(Some(std::time::Duration::from_millis(500)))
            .unwrap();
        let port = rx.local_addr().unwrap().port();

        send("127.0.0.1", port, LogFormat::Wsjtx, &hint()).unwrap();
        let mut buf = [0u8; 2048];
        let (n1, _) = rx.recv_from(&mut buf).unwrap();
        let first = buf[..n1].to_vec();
        let (n2, _) = rx.recv_from(&mut buf).unwrap();
        let second = buf[..n2].to_vec();
        // first has no DX call, second does
        let has = |d: &[u8]| d.windows(6).any(|w| w == b"DL1ABC");
        assert!(!has(&first), "blank Status should not carry the DX call");
        assert!(has(&second), "real Status should carry the DX call");

        send("127.0.0.1", port, LogFormat::Adif, &hint()).unwrap();
        let (n, _) = rx.recv_from(&mut buf).unwrap();
        assert!(buf[..n].starts_with(b"<CALL:6>DL1ABC"));
        assert!(rx.recv_from(&mut buf).is_err(), "ADIF sends exactly one");
    }
}
