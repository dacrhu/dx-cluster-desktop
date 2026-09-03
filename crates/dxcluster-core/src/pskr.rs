//! PSK Reporter real-time feed over MQTT.
//!
//! PSK Reporter ([pskreporter.info]) publishes every reception report to an
//! anonymous public MQTT broker. We subscribe to the narrow slice
//! `pskr/filter/v2/+/+/<our call>/#` so the broker only sends us reports whose
//! *transmitter* is one of our callsigns — i.e. "who is hearing me". This is a
//! read-only supplementary data source for the map's "reports of me" layer; it
//! carries no spots, commands, or secrets, and only runs when the user opts in.
//!
//! [pskreporter.info]: https://pskreporter.info/
//!
//! Digital modes only — PSK Reporter has no CW/SSB coverage. The RBN telnet
//! feed ([`crate::connection`] with `NodeKind::Rbn`) covers CW/RTTY.

use std::time::Duration;

use rumqttc::{AsyncClient, Event, MqttOptions, Packet, QoS};
use serde::Deserialize;
use tokio::sync::mpsc;

/// The public PSK Reporter MQTT broker (plain TCP; the data is public and there
/// are no credentials, so TLS would add nothing).
pub const PSKR_BROKER: &str = "mqtt.pskreporter.info";
pub const PSKR_PORT: u16 = 1883;

/// One "someone heard me" reception report.
#[derive(Debug, Clone, PartialEq)]
pub struct PskrReport {
    /// Transmitter callsign — one of ours (`sc`).
    pub sender: String,
    /// Receiver callsign — the station that heard us (`rc`).
    pub receiver: String,
    /// Receiver Maidenhead locator, if given (`rl`).
    pub receiver_locator: Option<String>,
    /// Transmitter Maidenhead locator, if given (`sl`).
    pub sender_locator: Option<String>,
    /// Frequency in Hz (`f`).
    pub freq_hz: u64,
    /// Mode string, e.g. `"FT8"` (`md`).
    pub mode: String,
    /// Signal-to-noise report in dB (`rp`).
    pub snr_db: Option<i32>,
    /// Report timestamp, unix seconds (`t`).
    pub epoch: i64,
}

/// Lifecycle + data events from a running feed.
#[derive(Debug, Clone, PartialEq)]
pub enum PskrEvent {
    /// The broker accepted our connection and subscriptions are (re)established.
    Connected,
    /// The connection dropped; rumqttc will retry.
    Disconnected,
    /// A reception report of one of our callsigns.
    Report(PskrReport),
    /// A transport/protocol error (non-fatal — the loop keeps retrying).
    Error(String),
}

/// Raw MQTT payload shape (a subset of the documented v2 fields).
#[derive(Deserialize)]
struct RawReport {
    sc: Option<String>,
    rc: Option<String>,
    rl: Option<String>,
    sl: Option<String>,
    f: Option<u64>,
    md: Option<String>,
    rp: Option<i64>,
    t: Option<i64>,
}

/// Parse one MQTT message payload into a report. Returns `None` when the JSON
/// is malformed or is missing a field we need (sender, receiver, frequency).
pub fn parse_report(payload: &[u8]) -> Option<PskrReport> {
    let r: RawReport = serde_json::from_slice(payload).ok()?;
    let sender = r.sc?.to_ascii_uppercase();
    let receiver = r.rc?.to_ascii_uppercase();
    let freq_hz = r.f?;
    if sender.is_empty() || receiver.is_empty() || freq_hz == 0 {
        return None;
    }
    Some(PskrReport {
        sender,
        receiver,
        receiver_locator: r.rl.filter(|s| !s.is_empty()),
        sender_locator: r.sl.filter(|s| !s.is_empty()),
        freq_hz,
        mode: r.md.unwrap_or_default().to_ascii_uppercase(),
        snr_db: r.rp.map(|v| v as i32),
        epoch: r.t.unwrap_or(0),
    })
}

/// The MQTT topic that filters to reports transmitted by `call` (any band, any
/// mode, any receiver). PSK Reporter writes `/` in a callsign as `.` in the
/// topic (e.g. `HA5XYZ/P` → `HA5XYZ.P`), and matching is exact — a portable or
/// contest call must be watched as its own entry.
fn watch_topic(call: &str) -> String {
    format!(
        "pskr/filter/v2/+/+/{}/#",
        call.trim().to_ascii_uppercase().replace('/', ".")
    )
}

/// Run the feed until `tx` is closed or the task is aborted.
///
/// `callsigns` are the transmitter callsigns to watch (base form). rumqttc
/// reconnects on its own; subscriptions are re-issued on every `ConnAck`.
pub async fn run(callsigns: Vec<String>, tx: mpsc::UnboundedSender<PskrEvent>) {
    let calls: Vec<String> = callsigns
        .iter()
        .map(|c| c.trim().to_ascii_uppercase())
        .filter(|c| !c.is_empty())
        .collect();
    if calls.is_empty() {
        let _ = tx.send(PskrEvent::Error("no callsign to watch".into()));
        return;
    }

    let client_id = format!(
        "dxcd-{:x}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    );
    let mut opts = MqttOptions::new(client_id, PSKR_BROKER, PSKR_PORT);
    opts.set_keep_alive(Duration::from_secs(30));
    opts.set_max_packet_size(256 * 1024, 256 * 1024);

    let (client, mut eventloop) = AsyncClient::new(opts, 64);

    loop {
        match eventloop.poll().await {
            Ok(Event::Incoming(Packet::ConnAck(_))) => {
                for call in &calls {
                    if let Err(e) = client.subscribe(watch_topic(call), QoS::AtMostOnce).await {
                        let _ = tx.send(PskrEvent::Error(format!("subscribe failed: {e}")));
                    }
                }
                if tx.send(PskrEvent::Connected).is_err() {
                    return;
                }
            }
            Ok(Event::Incoming(Packet::Publish(p))) => {
                // The topic subscription is the filter — forward whatever the
                // broker sends us.
                if let Some(report) = parse_report(&p.payload) {
                    if tx.send(PskrEvent::Report(report)).is_err() {
                        return;
                    }
                }
            }
            Ok(Event::Incoming(Packet::Disconnect)) => {
                if tx.send(PskrEvent::Disconnected).is_err() {
                    return;
                }
            }
            Ok(_) => {}
            Err(e) => {
                if tx.send(PskrEvent::Error(e.to_string())).is_err() {
                    return;
                }
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_reception_report() {
        let payload = br#"{"sq":42,"f":14074500,"md":"FT8","rp":-11,"t":1704067200,
            "sc":"ha5xyz","sl":"JN97","rc":"DL8ABC","rl":"JO31","sa":239,"ra":230,"b":"20m"}"#;
        let r = parse_report(payload).unwrap();
        assert_eq!(r.sender, "HA5XYZ");
        assert_eq!(r.receiver, "DL8ABC");
        assert_eq!(r.receiver_locator.as_deref(), Some("JO31"));
        assert_eq!(r.freq_hz, 14_074_500);
        assert_eq!(r.mode, "FT8");
        assert_eq!(r.snr_db, Some(-11));
        assert_eq!(r.epoch, 1_704_067_200);
    }

    #[test]
    fn rejects_incomplete_or_bad_payloads() {
        assert!(parse_report(b"not json").is_none());
        assert!(parse_report(br#"{"sc":"HA5XYZ","rc":"DL8ABC"}"#).is_none()); // no freq
        assert!(parse_report(br#"{"f":14074000,"rc":"DL8ABC"}"#).is_none()); // no sender
    }

    #[test]
    fn watch_topic_uppercases_and_wildcards() {
        assert_eq!(watch_topic("ha5xyz"), "pskr/filter/v2/+/+/HA5XYZ/#");
        // `/` in a callsign becomes `.` in the topic.
        assert_eq!(watch_topic("HA5XYZ/P"), "pskr/filter/v2/+/+/HA5XYZ.P/#");
    }
}
