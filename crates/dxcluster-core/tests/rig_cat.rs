//! End-to-end CAT: drive a real Hamlib `rigctld` (dummy rig, model 1) through
//! `rigctl::run` and confirm frequency + mode sets land and the poll reports
//! them back. Ignored by default — needs `rigctld` on `PATH`.

use std::time::Duration;

use dxcluster_core::rigctl::{self, RigCommand, RigConfig, RigEvent, RigTransport};
use tokio::sync::mpsc;

#[tokio::test]
#[ignore = "needs Hamlib rigctld on PATH"]
async fn tunes_a_dummy_rig() {
    // Spin up rigctld ourselves on a fixed test port with the dummy backend.
    let port = 45_711u16;
    let mut child = tokio::process::Command::new("rigctld")
        .args(["-m", "1", "-t", &port.to_string()])
        .kill_on_drop(true)
        .spawn()
        .expect("spawn rigctld");
    tokio::time::sleep(Duration::from_millis(500)).await;

    let cfg = RigConfig {
        transport: RigTransport::Network {
            host: "127.0.0.1".into(),
            port,
        },
        poll: true,
    };
    let (cmd_tx, cmd_rx) = mpsc::unbounded_channel::<RigCommand>();
    let (ev_tx, mut ev_rx) = mpsc::unbounded_channel::<RigEvent>();
    let task = tokio::spawn(rigctl::run(cfg, cmd_rx, ev_tx));

    // Wait for the Connected event.
    let connected = tokio::time::timeout(Duration::from_secs(3), async {
        while let Some(ev) = ev_rx.recv().await {
            if ev == RigEvent::Connected {
                return true;
            }
        }
        false
    })
    .await
    .unwrap_or(false);
    assert!(connected, "never connected to rigctld");

    cmd_tx
        .send(RigCommand::SetFreqMode {
            freq_hz: 14_074_000.0,
            mode: Some("USB".into()),
        })
        .unwrap();

    // The next VFO poll should report the frequency we just set.
    let got = tokio::time::timeout(Duration::from_secs(4), async {
        while let Some(ev) = ev_rx.recv().await {
            if let RigEvent::Vfo { freq_hz, mode } = ev {
                if (freq_hz - 14_074_000.0).abs() < 1.0 {
                    return Some(mode);
                }
            }
        }
        None
    })
    .await
    .ok()
    .flatten();

    assert_eq!(got.as_deref(), Some("USB"), "rig did not tune");

    drop(cmd_tx);
    task.abort();
    let _ = child.start_kill();
}

#[tokio::test]
#[ignore = "needs Hamlib rigctld on PATH"]
async fn sets_split() {
    let port = 45_713u16;
    let mut child = tokio::process::Command::new("rigctld")
        .args(["-m", "1", "-t", &port.to_string()])
        .kill_on_drop(true)
        .spawn()
        .expect("spawn rigctld");
    tokio::time::sleep(Duration::from_millis(500)).await;

    let cfg = RigConfig {
        transport: RigTransport::Network {
            host: "127.0.0.1".into(),
            port,
        },
        poll: true,
    };
    let (cmd_tx, cmd_rx) = mpsc::unbounded_channel::<RigCommand>();
    let (ev_tx, mut ev_rx) = mpsc::unbounded_channel::<RigEvent>();
    let task = tokio::spawn(rigctl::run(cfg, cmd_rx, ev_tx));

    // Drain events; fail on any error within the window.
    cmd_tx
        .send(RigCommand::SetSplit {
            rx_hz: 14_020_000.0,
            tx_hz: 14_025_000.0,
            tx_mode: Some("USB".into()),
        })
        .unwrap();

    let ok = tokio::time::timeout(Duration::from_secs(3), async {
        let mut saw_rx = false;
        while let Some(ev) = ev_rx.recv().await {
            match ev {
                RigEvent::Error(e) => panic!("split raised an error: {e}"),
                RigEvent::Vfo { freq_hz, .. } if (freq_hz - 14_020_000.0).abs() < 1.0 => {
                    saw_rx = true;
                    break;
                }
                _ => {}
            }
        }
        saw_rx
    })
    .await
    .unwrap_or(false);
    assert!(ok, "RX VFO never reported after split");

    cmd_tx.send(RigCommand::ClearSplit).unwrap();
    tokio::time::sleep(Duration::from_millis(300)).await;

    drop(cmd_tx);
    task.abort();
    let _ = child.start_kill();
}

#[tokio::test]
#[ignore = "needs Hamlib rigctld on PATH"]
async fn test_reads_frequency() {
    let port = 45_712u16;
    let mut child = tokio::process::Command::new("rigctld")
        .args(["-m", "1", "-t", &port.to_string()])
        .kill_on_drop(true)
        .spawn()
        .expect("spawn rigctld");
    tokio::time::sleep(Duration::from_millis(500)).await;

    let freq = rigctl::test(RigConfig {
        transport: RigTransport::Network {
            host: "127.0.0.1".into(),
            port,
        },
        poll: false,
    })
    .await
    .expect("rig test");
    assert!(freq > 0.0);
    let _ = child.start_kill();
}
