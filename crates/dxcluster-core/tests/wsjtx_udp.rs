//! End-to-end: feed real UDP datagrams to `wsjtx::run` and check a spot comes
//! out with the right frequency.

use std::time::Duration;

use dxcluster_core::wsjtx::{self, WsjtxEvent, WSJTX_MAGIC};
use tokio::net::UdpSocket;
use tokio::sync::mpsc;

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
fn header(v: &mut Vec<u8>, t: u32) {
    u32b(v, WSJTX_MAGIC);
    u32b(v, 2);
    u32b(v, t);
    strb(v, "WSJT-X");
}

fn status(dial: u64) -> Vec<u8> {
    let mut b = Vec::new();
    header(&mut b, 1);
    u64b(&mut b, dial);
    strb(&mut b, "FT8");
    strb(&mut b, "");
    strb(&mut b, "");
    strb(&mut b, "FT8");
    b.extend_from_slice(&[0, 0, 1]);
    u32b(&mut b, 1500);
    u32b(&mut b, 1500);
    strb(&mut b, "HA5XYZ");
    strb(&mut b, "JN97MN");
    b
}

fn decode(df: u32, msg: &str) -> Vec<u8> {
    let mut b = Vec::new();
    header(&mut b, 2);
    b.push(1);
    u32b(&mut b, 44_000_000);
    u32b(&mut b, (-9i32) as u32);
    f64b(&mut b, 0.1);
    u32b(&mut b, df);
    strb(&mut b, "FT8");
    strb(&mut b, msg);
    b.extend_from_slice(&[0, 0]);
    b
}

#[tokio::test]
async fn decodes_flow_through_as_spots() {
    // Bind an ephemeral port for the feed, discover it via a probe socket.
    let probe = UdpSocket::bind("127.0.0.1:0").await.unwrap();
    let port = probe.local_addr().unwrap().port();
    drop(probe);

    let (tx, mut rx) = mpsc::unbounded_channel();
    let feed = tokio::spawn(wsjtx::run(format!("127.0.0.1:{port}"), tx));

    // Wait for "Listening".
    let ev = tokio::time::timeout(Duration::from_secs(2), rx.recv())
        .await
        .unwrap();
    assert_eq!(ev, Some(WsjtxEvent::Listening));

    let sender = UdpSocket::bind("127.0.0.1:0").await.unwrap();
    sender
        .send_to(&status(14_074_000), ("127.0.0.1", port))
        .await
        .unwrap();
    sender
        .send_to(&decode(1633, "CQ DL1ABC JO31"), ("127.0.0.1", port))
        .await
        .unwrap();

    let mut got = None;
    while let Ok(Some(ev)) = tokio::time::timeout(Duration::from_secs(2), rx.recv()).await {
        if let WsjtxEvent::Spot(s) = ev {
            got = Some(s);
            break;
        }
    }
    let s = got.expect("expected a spot");
    assert_eq!(s.dx_call, "DL1ABC");
    assert_eq!(s.grid.as_deref(), Some("JO31"));
    assert_eq!(s.mode, "FT8");
    assert_eq!(s.snr_db, -9);
    assert_eq!(s.de_call, "HA5XYZ"); // operator call, from the Status
    assert!(
        (s.freq_khz - 14_075.633).abs() < 0.001,
        "freq {}",
        s.freq_khz
    );

    feed.abort();
}

/// A multicast group with a bare (port-less) address, and a second listener
/// already bound to the group — mirrors "WSJT-X → 239.255.0.1, QLog also
/// listening". Our feed must still receive.
#[tokio::test]
async fn multicast_shared_with_another_listener() {
    use socket2::{Domain, Protocol, Socket, Type};
    use std::net::{Ipv4Addr, SocketAddr};

    let group = Ipv4Addr::new(239, 255, 0, 77);
    let port = 22_370u16;
    let grp_addr = SocketAddr::from((group, port));

    // Stand-in for QLog (Qt's `ShareAddress`): `SO_REUSEADDR`, plus
    // `SO_REUSEPORT` on macOS/*BSD where Qt sets it too and it is required for a
    // second bind. Bound to the wildcard, joined to the group.
    let other = Socket::new(Domain::IPV4, Type::DGRAM, Some(Protocol::UDP)).unwrap();
    other.set_reuse_address(true).unwrap();
    #[cfg(any(
        target_os = "macos",
        target_os = "ios",
        target_os = "freebsd",
        target_os = "netbsd",
        target_os = "openbsd",
        target_os = "dragonfly"
    ))]
    other.set_reuse_port(true).unwrap();
    other
        .bind(&SocketAddr::from((Ipv4Addr::UNSPECIFIED, port)).into())
        .unwrap();
    other
        .join_multicast_v4(&group, &Ipv4Addr::UNSPECIFIED)
        .unwrap();
    other.set_nonblocking(true).unwrap();

    let (tx, mut rx) = mpsc::unbounded_channel();
    let feed = tokio::spawn(wsjtx::run(grp_addr.to_string(), tx));

    assert_eq!(
        tokio::time::timeout(Duration::from_secs(2), rx.recv())
            .await
            .unwrap(),
        Some(WsjtxEvent::Listening)
    );

    let sender = UdpSocket::bind("0.0.0.0:0").await.unwrap();
    sender.send_to(&status(21_074_000), grp_addr).await.unwrap();
    sender
        .send_to(&decode(900, "CQ EA1XYZ IN52"), grp_addr)
        .await
        .unwrap();

    let mut got = None;
    while let Ok(Some(ev)) = tokio::time::timeout(Duration::from_secs(2), rx.recv()).await {
        if let WsjtxEvent::Spot(s) = ev {
            got = Some(s);
            break;
        }
    }
    let s = got.expect("expected a spot over multicast");
    assert_eq!(s.dx_call, "EA1XYZ");
    assert!((s.freq_khz - 21_074.9).abs() < 0.001, "freq {}", s.freq_khz);

    feed.abort();
    drop(other);
}
