//! CAT (rig control) over Hamlib's `rigctld` TCP protocol.
//!
//! Two transports, one code path:
//! - **Network** — connect to a `rigctld` daemon someone else is already
//!   running (a logger, WSJT-X, Flrig, a remote station box).
//! - **Serial** — the app spawns and supervises its own `rigctld -m <model>
//!   -r <device> -s <baud> -t <port>` child bound to localhost, then talks to
//!   it exactly like the Network case.
//!
//! This is not a cluster transport — it's a local hardware link, opt-in and
//! off by default, matching the RBN / PSK Reporter / WSJT-X feed pattern.
//!
//! `rigctld`'s default (non-extended) protocol is one text line per command:
//! `F <hz>` / `M <mode> <width>` set, `f` / `m` read, and every *set* replies
//! `RPRT <n>` (`0` = ok, negative = Hamlib error code).

use std::process::Stdio;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::mpsc;

/// `rigctld`'s default TCP port.
pub const DEFAULT_RIGCTLD_PORT: u16 = 4532;

// --- config ---------------------------------------------------------------

/// How to reach the rig.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum RigTransport {
    /// Connect to an already-running `rigctld`.
    Network { host: String, port: u16 },
    /// Spawn our own `rigctld` for a serial-connected rig.
    Serial {
        /// Hamlib rig model number (see [`rig_models`]).
        model_id: u32,
        /// Serial device path (`/dev/ttyUSB0`, `COM3`, …).
        device: String,
        baud: u32,
        /// Local port for the spawned `rigctld` to listen on.
        port: u16,
    },
}

impl RigTransport {
    fn tcp_addr(&self) -> (String, u16) {
        match self {
            RigTransport::Network { host, port } => (host.clone(), *port),
            RigTransport::Serial { port, .. } => ("127.0.0.1".to_string(), *port),
        }
    }
}

/// A CAT session's configuration.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RigConfig {
    pub transport: RigTransport,
    /// Poll the VFO ~1×/s and emit [`RigEvent::Vfo`] (for the "follow radio"
    /// feature and the status readout).
    #[serde(default)]
    pub poll: bool,
}

// --- events & commands ---------------------------------------------------

/// A request pushed into a running session.
#[derive(Debug, Clone, PartialEq)]
pub enum RigCommand {
    /// Put the rig on `freq_hz` simplex, and optionally switch mode (`"CW"`,
    /// `"USB"`, `"LSB"`, `"FM"`, `"PKTUSB"`, …). If the session had split on
    /// (from an earlier [`RigCommand::SetSplit`]) it is turned off first.
    SetFreqMode { freq_hz: f64, mode: Option<String> },
    /// Work split: receive on `rx_hz`, transmit on `tx_hz` (the DX's QSX).
    /// Optionally set the mode (shared RX/TX).
    SetSplit {
        rx_hz: f64,
        tx_hz: f64,
        tx_mode: Option<String>,
    },
    /// Drop split, back to simplex on the current VFO.
    ClearSplit,
}

/// Lifecycle + data events from a running session.
#[derive(Debug, Clone, PartialEq)]
pub enum RigEvent {
    /// Connected to `rigctld` (and, for Serial, the child is up).
    Connected,
    /// The link dropped; the supervisor will retry.
    Disconnected,
    /// Current VFO frequency (Hz) and mode, from a poll.
    Vfo { freq_hz: f64, mode: String },
    /// A non-fatal error (bad command, transient I/O) — the session keeps going.
    Error(String),
}

// --- rig model list ------------------------------------------------------

/// One entry from `rigctl -l`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RigModel {
    pub id: u32,
    pub mfg: String,
    pub model: String,
    pub status: String,
}

/// A snapshot of `rigctl -l` bundled with the app, used when Hamlib's binaries
/// aren't on `PATH` at runtime.
const BUNDLED_RIG_LIST: &str = include_str!("../../../src-tauri/resources/hamlib_rigs.txt");

/// Parse the fixed-column `rigctl -l` table. Every data row ends with a
/// `RIG_MODEL_*` macro token and carries a `YYYYMMDD.n` version token; the
/// manufacturer/model text sits between the leading id and that version (the
/// model cell is occasionally blank, e.g. Flrig).
pub fn parse_rig_list(text: &str) -> Vec<RigModel> {
    let mut out = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("Rig #") {
            continue;
        }
        let tokens: Vec<&str> = trimmed.split_whitespace().collect();
        if tokens.len() < 4 {
            continue;
        }
        let Ok(id) = tokens[0].parse::<u32>() else {
            continue;
        };
        if !tokens.last().is_some_and(|t| t.starts_with("RIG_MODEL_")) {
            continue;
        }
        // version token: the one shaped like a Hamlib date-version.
        let ver_idx = tokens.iter().position(|t| {
            let (d, rest) = t.split_at(t.find('.').unwrap_or(t.len()));
            d.len() == 8 && d.bytes().all(|b| b.is_ascii_digit()) && !rest.is_empty()
        });
        let Some(ver_idx) = ver_idx else { continue };
        // status is the token right after the version.
        let status = tokens.get(ver_idx + 1).copied().unwrap_or("").to_string();
        let mid = &tokens[1..ver_idx];
        let (mfg, model) = match mid.split_first() {
            Some((m, rest)) => (m.to_string(), rest.join(" ")),
            None => (String::new(), String::new()),
        };
        out.push(RigModel {
            id,
            mfg,
            model,
            status,
        });
    }
    out
}

/// The Hamlib rig catalogue: live from `rigctl -l` if it's on `PATH`, else the
/// bundled snapshot.
pub fn rig_models() -> Vec<RigModel> {
    if let Ok(out) = std::process::Command::new("rigctl").arg("-l").output() {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout);
            let models = parse_rig_list(&text);
            if !models.is_empty() {
                return models;
            }
        }
    }
    parse_rig_list(BUNDLED_RIG_LIST)
}

// --- mode mapping ------------------------------------------------------

/// Which `rigctld` mode a spot in the coarse digital category should put the rig
/// into — the shack's fixed arrangement decides this, so it's a user setting.
/// `None` = leave the rig's mode alone (frequency-only tune).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum DigiMode {
    /// Don't send a mode for a digital spot.
    None,
    /// Plain USB (soundcard digi with no dedicated data mode).
    Usb,
    /// The rig's data / packet mode (`PKTUSB`).
    #[default]
    Data,
}

/// The `rigctld` mode name for a coarse cluster mode + frequency, or `None` to
/// leave the rig's mode untouched. SSB picks the conventional sideband by band
/// edge (LSB below 10 MHz, USB above); the digital category follows `digi`.
pub fn mode_for(mode: crate::band::Mode, freq_hz: f64, digi: DigiMode) -> Option<&'static str> {
    use crate::band::Mode;
    let sideband = if freq_hz < 10_000_000.0 { "LSB" } else { "USB" };
    match mode {
        Mode::Cw => Some("CW"),
        Mode::Ssb | Mode::Unknown => Some(sideband),
        Mode::Fm => Some("FM"),
        Mode::Digi => match digi {
            DigiMode::None => None,
            DigiMode::Usb => Some("USB"),
            DigiMode::Data => Some("PKTUSB"),
        },
    }
}

// --- the session -------------------------------------------------------

/// A live rigctld connection: the TCP stream plus, for Serial, the child we
/// spawned (kept so it's killed when the session drops).
struct Link {
    reader: BufReader<tokio::net::tcp::OwnedReadHalf>,
    writer: tokio::net::tcp::OwnedWriteHalf,
    _child: Option<ChildGuard>,
}

/// Kills the spawned `rigctld` on drop.
struct ChildGuard(tokio::process::Child);
impl Drop for ChildGuard {
    fn drop(&mut self) {
        let _ = self.0.start_kill();
    }
}

impl Link {
    /// Send one command line and return the raw response line(s), trimmed.
    async fn cmd(&mut self, line: &str) -> std::io::Result<Vec<String>> {
        self.writer
            .write_all(format!("{line}\n").as_bytes())
            .await?;
        self.writer.flush().await?;
        // Read one line; `m` (get mode) answers with two (mode, then width) —
        // callers that need the second read it themselves.
        let mut buf = String::new();
        let n = self.reader.read_line(&mut buf).await?;
        if n == 0 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::UnexpectedEof,
                "rigctld closed the connection",
            ));
        }
        Ok(vec![buf.trim().to_string()])
    }

    async fn read_line(&mut self) -> std::io::Result<String> {
        let mut buf = String::new();
        let n = self.reader.read_line(&mut buf).await?;
        if n == 0 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::UnexpectedEof,
                "rigctld closed the connection",
            ));
        }
        Ok(buf.trim().to_string())
    }

    async fn set_freq(&mut self, hz: f64) -> Result<(), String> {
        let resp = self
            .cmd(&format!("F {}", hz.round() as i64))
            .await
            .map_err(|e| e.to_string())?;
        check_rprt(resp.first().map(String::as_str).unwrap_or(""))
    }

    async fn set_mode(&mut self, mode: &str) -> Result<(), String> {
        let resp = self
            .cmd(&format!("M {mode} 0"))
            .await
            .map_err(|e| e.to_string())?;
        check_rprt(resp.first().map(String::as_str).unwrap_or(""))
    }

    /// `S <split> <tx_vfo>` — turn split on (TX on VFO B) or off (back to VFO A).
    async fn set_split_vfo(&mut self, on: bool) -> Result<(), String> {
        let arg = if on { "1 VFOB" } else { "0 VFOA" };
        let resp = self
            .cmd(&format!("S {arg}"))
            .await
            .map_err(|e| e.to_string())?;
        check_rprt(resp.first().map(String::as_str).unwrap_or(""))
    }

    /// `I <hz>` — set the split (TX) frequency.
    async fn set_split_freq(&mut self, hz: f64) -> Result<(), String> {
        let resp = self
            .cmd(&format!("I {}", hz.round() as i64))
            .await
            .map_err(|e| e.to_string())?;
        check_rprt(resp.first().map(String::as_str).unwrap_or(""))
    }

    async fn get_vfo(&mut self) -> Result<(f64, String), String> {
        let f = self.cmd("f").await.map_err(|e| e.to_string())?;
        let freq: f64 = f
            .first()
            .and_then(|s| s.parse().ok())
            .ok_or_else(|| format!("bad freq response {f:?}"))?;
        let m = self.cmd("m").await.map_err(|e| e.to_string())?;
        let mode = m.first().cloned().unwrap_or_default();
        // `m` returns a second line (passband width) — consume it.
        let _ = self.read_line().await;
        Ok((freq, mode))
    }
}

/// `RPRT 0` → ok; `RPRT -n` → the Hamlib error; anything else is unexpected.
fn check_rprt(line: &str) -> Result<(), String> {
    match line.strip_prefix("RPRT ").map(str::trim) {
        Some("0") => Ok(()),
        Some(code) => Err(format!("rigctld error {code}")),
        None => Err(format!("unexpected rigctld reply: {line:?}")),
    }
}

/// Spawn `rigctld` for a serial rig and wait briefly for its port to open.
async fn spawn_rigctld(
    model_id: u32,
    device: &str,
    baud: u32,
    port: u16,
) -> Result<ChildGuard, String> {
    let child = tokio::process::Command::new("rigctld")
        .arg("-m")
        .arg(model_id.to_string())
        .arg("-r")
        .arg(device)
        .arg("-s")
        .arg(baud.to_string())
        .arg("-t")
        .arg(port.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("could not start rigctld: {e} (is Hamlib installed?)"))?;
    // Give it a moment to bind before the first connect attempt.
    tokio::time::sleep(Duration::from_millis(600)).await;
    Ok(ChildGuard(child))
}

async fn connect(cfg: &RigConfig) -> Result<Link, String> {
    let child = match &cfg.transport {
        RigTransport::Serial {
            model_id,
            device,
            baud,
            port,
        } => Some(spawn_rigctld(*model_id, device, *baud, *port).await?),
        RigTransport::Network { .. } => None,
    };
    let (host, port) = cfg.transport.tcp_addr();
    let stream = TcpStream::connect((host.as_str(), port))
        .await
        .map_err(|e| format!("connect {host}:{port}: {e}"))?;
    stream.set_nodelay(true).ok();
    let (rd, wr) = stream.into_split();
    Ok(Link {
        reader: BufReader::new(rd),
        writer: wr,
        _child: child,
    })
}

/// One-shot: connect, read the VFO frequency, disconnect. Powers the Settings
/// dialog's "Test" button.
pub async fn test(cfg: RigConfig) -> Result<f64, String> {
    let mut link = connect(&cfg).await?;
    let (freq, _mode) = link.get_vfo().await?;
    Ok(freq)
}

/// Run a CAT session until `tx` is dropped or the task is aborted. Reconnects
/// with a short backoff whenever the link drops.
pub async fn run(
    cfg: RigConfig,
    mut cmd_rx: mpsc::UnboundedReceiver<RigCommand>,
    tx: mpsc::UnboundedSender<RigEvent>,
) {
    let mut backoff = Duration::from_millis(500);
    loop {
        let mut link = match connect(&cfg).await {
            Ok(l) => l,
            Err(e) => {
                if tx.send(RigEvent::Error(e)).is_err() {
                    return;
                }
                tokio::time::sleep(backoff).await;
                backoff = (backoff * 2).min(Duration::from_secs(15));
                continue;
            }
        };
        backoff = Duration::from_millis(500);
        if tx.send(RigEvent::Connected).is_err() {
            return;
        }
        // Emit an immediate VFO reading so the UI shows where the rig is.
        if cfg.poll {
            if let Ok((freq_hz, mode)) = link.get_vfo().await {
                let _ = tx.send(RigEvent::Vfo { freq_hz, mode });
            }
        }

        let mut poll = tokio::time::interval(Duration::from_secs(1));
        poll.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        // Per-connection: a reconnect resets it (and clears the rig's split with
        // it), so this must NOT be hoisted above the outer loop.
        let mut split_active = false;

        loop {
            tokio::select! {
                cmd = cmd_rx.recv() => match cmd {
                    None => return, // sender dropped → session stopped
                    Some(RigCommand::SetFreqMode { freq_hz, mode }) => {
                        // A plain tune transparently exits split.
                        if split_active {
                            let _ = link.set_split_vfo(false).await;
                            split_active = false;
                        }
                        if let Err(e) = link.set_freq(freq_hz).await {
                            let _ = tx.send(RigEvent::Error(e));
                            break; // drop the link, reconnect
                        }
                        if let Some(m) = &mode {
                            if let Err(e) = link.set_mode(m).await {
                                let _ = tx.send(RigEvent::Error(e));
                            }
                        }
                        if cfg.poll {
                            if let Ok((freq_hz, mode)) = link.get_vfo().await {
                                let _ = tx.send(RigEvent::Vfo { freq_hz, mode });
                            }
                        }
                    }
                    Some(RigCommand::SetSplit { rx_hz, tx_hz, tx_mode }) => {
                        let r = async {
                            link.set_freq(rx_hz).await?;
                            if let Some(m) = &tx_mode {
                                link.set_mode(m).await?;
                            }
                            link.set_split_vfo(true).await?;
                            link.set_split_freq(tx_hz).await?;
                            Ok::<(), String>(())
                        }
                        .await;
                        match r {
                            Ok(()) => split_active = true,
                            Err(e) => {
                                let _ = tx.send(RigEvent::Error(e));
                                break; // drop the link, reconnect
                            }
                        }
                        if cfg.poll {
                            if let Ok((freq_hz, mode)) = link.get_vfo().await {
                                let _ = tx.send(RigEvent::Vfo { freq_hz, mode });
                            }
                        }
                    }
                    Some(RigCommand::ClearSplit) => {
                        if let Err(e) = link.set_split_vfo(false).await {
                            let _ = tx.send(RigEvent::Error(e));
                        }
                        split_active = false;
                    }
                },
                _ = poll.tick(), if cfg.poll => {
                    match link.get_vfo().await {
                        Ok((freq_hz, mode)) => {
                            if tx.send(RigEvent::Vfo { freq_hz, mode }).is_err() {
                                return;
                            }
                        }
                        Err(_) => {
                            let _ = tx.send(RigEvent::Disconnected);
                            break;
                        }
                    }
                }
            }
        }
        // fell out of the inner loop → link is gone, loop round and reconnect
        let _ = tx.send(RigEvent::Disconnected);
        tokio::time::sleep(backoff).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_the_rigctl_table() {
        let sample = "\
 Rig #  Mfg                    Model                   Version         Status      Macro
     1  Hamlib                 Dummy                   20240709.0      Stable      RIG_MODEL_DUMMY
     2  Hamlib                 NET rigctl              20250211.0      Stable      RIG_MODEL_NETRIGCTL
     4  FLRig                                          20250107.0      Stable      RIG_MODEL_FLRIG
  1035  Yaesu                  FT-817                  20211016.0      Stable      RIG_MODEL_FT817
";
        let models = parse_rig_list(sample);
        assert_eq!(models.len(), 4);
        assert_eq!(
            models[0],
            RigModel {
                id: 1,
                mfg: "Hamlib".into(),
                model: "Dummy".into(),
                status: "Stable".into()
            }
        );
        assert_eq!(models[1].model, "NET rigctl");
        assert_eq!(
            models[2],
            RigModel {
                id: 4,
                mfg: "FLRig".into(),
                model: "".into(),
                status: "Stable".into()
            }
        );
        assert_eq!(models[3].id, 1035);
        assert_eq!(models[3].model, "FT-817");
    }

    #[test]
    fn bundled_list_parses() {
        assert!(rig_models().len() > 100);
    }

    #[test]
    fn rprt_parsing() {
        assert!(check_rprt("RPRT 0").is_ok());
        assert!(check_rprt("RPRT -1").is_err());
        assert!(check_rprt("14074000").is_err());
    }

    #[test]
    fn mode_mapping() {
        use crate::band::Mode;
        assert_eq!(mode_for(Mode::Cw, 7_020_000.0, DigiMode::None), Some("CW"));
        assert_eq!(
            mode_for(Mode::Ssb, 7_120_000.0, DigiMode::Data),
            Some("LSB")
        );
        assert_eq!(
            mode_for(Mode::Ssb, 14_200_000.0, DigiMode::Data),
            Some("USB")
        );
        assert_eq!(mode_for(Mode::Fm, 29_600_000.0, DigiMode::Data), Some("FM"));
        // The digital category follows the setting.
        assert_eq!(
            mode_for(Mode::Digi, 14_074_000.0, DigiMode::Data),
            Some("PKTUSB")
        );
        assert_eq!(
            mode_for(Mode::Digi, 14_074_000.0, DigiMode::Usb),
            Some("USB")
        );
        assert_eq!(mode_for(Mode::Digi, 14_074_000.0, DigiMode::None), None);
        assert_eq!(DigiMode::default(), DigiMode::Data);
    }
}
