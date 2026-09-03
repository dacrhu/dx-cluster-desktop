//! Opt-in end-to-end test against a real public DX cluster.
//!
//! Ignored by default (needs network). Run with:
//!   cargo test -p dxcluster-core --test live_cluster -- --ignored --nocapture

use std::time::Duration;

use dxcluster_core::connection::{connect, ConnEvent, ConnState, NodeProfile, SessionConfig};
use dxcluster_core::parser::ClusterEvent;

#[tokio::test]
#[ignore = "hits the network"]
async fn connects_and_parses_real_spots() {
    let profile = NodeProfile {
        id: "live".into(),
        host: "hrd.wa9pie.net".into(),
        port: 8000,
        // Set DXTEST_CALL to your own callsign to actually complete login.
        callsign: std::env::var("DXTEST_CALL").unwrap_or_else(|_| "N0CALL".into()),
        password: None,
        on_login: vec![],
        auto_connect: false,
        kind: Default::default(),
    };

    let (handle, mut events) = connect(profile, SessionConfig::default())
        .await
        .expect("tcp connect");

    let mut online = false;
    let mut spots = 0usize;
    let deadline = tokio::time::Instant::now() + Duration::from_secs(45);

    while tokio::time::Instant::now() < deadline && spots < 3 {
        match tokio::time::timeout(Duration::from_secs(10), events.recv()).await {
            Ok(Some(ConnEvent::State {
                state: ConnState::Online,
            })) => {
                online = true;
                println!("== online ==");
                let _ = handle.send("sh/dx 5");
            }
            Ok(Some(ConnEvent::Event {
                event: ClusterEvent::Spot(s),
            })) => {
                spots += 1;
                println!(
                    "SPOT {} {} {:?} by {}",
                    s.freq_khz, s.dx_call, s.band, s.spotter
                );
            }
            Ok(Some(ConnEvent::Line { line })) => println!("| {line}"),
            Ok(Some(other)) => println!("({other:?})"),
            Ok(None) => break,
            Err(_) => println!("(idle)"),
        }
    }

    assert!(online, "should have logged in");
}
