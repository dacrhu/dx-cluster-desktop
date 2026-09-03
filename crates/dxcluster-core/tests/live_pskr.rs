//! Live smoke test against the real PSK Reporter MQTT broker. Ignored by
//! default (`cargo test -p dxcluster-core --test live_pskr -- --ignored --nocapture`).

use std::collections::HashMap;
use std::time::Duration;

use dxcluster_core::pskr::{self, PskrEvent};
use rumqttc::{AsyncClient, Event, MqttOptions, Packet, QoS};
use tokio::sync::mpsc;

/// Sniff the firehose briefly and return the callsign seen transmitting most.
async fn busiest_tx_call() -> String {
    let mut opts = MqttOptions::new("dxcd-sniff", pskr::PSKR_BROKER, pskr::PSKR_PORT);
    opts.set_keep_alive(Duration::from_secs(30));
    opts.set_max_packet_size(256 * 1024, 256 * 1024);
    let (client, mut eventloop) = AsyncClient::new(opts, 64);
    let mut counts: HashMap<String, u32> = HashMap::new();
    let mut raw = 0u32;
    let deadline = tokio::time::sleep(Duration::from_secs(12));
    tokio::pin!(deadline);
    loop {
        tokio::select! {
            _ = &mut deadline => break,
            ev = eventloop.poll() => match ev {
                Ok(Event::Incoming(Packet::ConnAck(_))) => {
                    client.subscribe("pskr/filter/v2/#", QoS::AtMostOnce).await.unwrap();
                }
                Ok(Event::Incoming(Packet::Publish(p))) => {
                    raw += 1;
                    if let Some(r) = pskr::parse_report(&p.payload) {
                        *counts.entry(r.sender).or_default() += 1;
                    }
                }
                Ok(_) => {}
                Err(e) => eprintln!("sniff poll error: {e}"),
            }
        }
    }
    eprintln!(
        "sniff: {raw} raw messages, {} distinct senders",
        counts.len()
    );
    counts
        .into_iter()
        .max_by_key(|(_, n)| *n)
        .map(|(c, _)| c)
        .unwrap_or_else(|| "DK0WCY".to_string())
}

#[tokio::test]
#[ignore = "hits the network"]
async fn connects_subscribes_and_receives() {
    let call = busiest_tx_call().await;
    eprintln!("watching busiest current TX: {call}");

    let (tx, mut rx) = mpsc::unbounded_channel();
    let task = tokio::spawn(pskr::run(vec![call.clone()], tx));

    let mut connected = false;
    let mut reports = 0;
    let deadline = tokio::time::sleep(Duration::from_secs(40));
    tokio::pin!(deadline);
    loop {
        tokio::select! {
            _ = &mut deadline => break,
            ev = rx.recv() => match ev {
                Some(PskrEvent::Connected) => connected = true,
                Some(PskrEvent::Report(r)) => {
                    reports += 1;
                    eprintln!("  {} heard by {} ({:?}) {} kHz {} {}dB",
                        r.sender, r.receiver, r.receiver_locator, r.freq_hz / 1000, r.mode,
                        r.snr_db.unwrap_or(0));
                }
                Some(PskrEvent::Error(e)) => eprintln!("  error: {e}"),
                Some(PskrEvent::Disconnected) => eprintln!("  disconnected"),
                None => break,
            }
        }
    }
    task.abort();
    assert!(connected, "should connect to the broker");
    eprintln!("saw {reports} reports for {call} in 40s");
    assert!(
        reports > 0,
        "expected at least one report for the busiest station"
    );
}
