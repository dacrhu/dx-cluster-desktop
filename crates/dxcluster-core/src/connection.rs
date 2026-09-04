//! One DX cluster connection: TCP + Telnet framing + a login state machine,
//! driven as a tokio task that emits [`ConnEvent`]s and accepts outbound command
//! lines on a channel.
//!
//! The session loop is generic over the transport so it can be exercised with an
//! in-memory duplex stream in tests; [`connect`] is the thin wrapper that opens a
//! real [`tokio::net::TcpStream`].

use std::collections::BTreeSet;
use std::time::Duration;

use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::sync::mpsc;

use crate::parser::{parse_line_ctx, ClusterEvent, ParseCtx};
use crate::telnet::Decoder;

/// Extract a `JOIN <group>` / `LEAVE <group>` from an outgoing command line.
static JOIN_LEAVE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)^\s*(join|leave)\s+(\S+)").unwrap());

/// What kind of feed a profile connects to.
///
/// A `Cluster` is a normal DX cluster node (DXSpider / AR-Cluster) that accepts
/// commands. An `Rbn` is the Reverse Beacon Network raw telnet feed
/// (`telnet.reversebeacon.net:7000` CW/RTTY, `:7001` FT8/FT4) — a command-less
/// firehose of every skimmer decode, used only to see who is hearing us.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeKind {
    #[default]
    Cluster,
    Rbn,
}

/// Which command dialect a `Cluster`-kind node speaks — which syntax
/// `commands.rs` should generate for spot filters and `SH/DX` queries.
/// AR-Cluster's `SET/DX/FILTER` query language and `SHOW/DX` criteria differ
/// from DXSpider's numbered `accept/spot` / `reject/spot` filters and `SH/DX`
/// modifiers; everything else in the bundled preset list (CC Cluster, DxNet,
/// CLX, WinCluster, AK1A, …) is close enough to DXSpider's AK1A-derived
/// syntax to default to it. Built to the documented AR-Cluster V6 filter/
/// SH-DX syntax — like the mail parser, unverified against a live AR-Cluster
/// node.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeSoftware {
    #[default]
    DxSpider,
    ArCluster,
}

/// Connection settings for a single node.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeProfile {
    /// Stable identifier chosen by the app.
    pub id: String,
    pub host: String,
    pub port: u16,
    /// Callsign used to log in.
    pub callsign: String,
    /// Password, only if the node has one set for this user.
    #[serde(default)]
    pub password: Option<String>,
    /// Commands sent once, right after login completes (filters, `set/…`).
    #[serde(default)]
    pub on_login: Vec<String>,
    /// Connect to this node automatically when the app starts.
    #[serde(default)]
    pub auto_connect: bool,
    /// Whether this is a normal cluster node or the RBN raw feed.
    #[serde(default)]
    pub kind: NodeKind,
    /// Command dialect for a `Cluster`-kind node.
    #[serde(default)]
    pub software: NodeSoftware,
}

/// High-level connection state, surfaced to the UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnState {
    Connecting,
    LoggingIn,
    Online,
    Disconnected,
}

/// Events emitted by a running session.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ConnEvent {
    /// Connection state changed.
    State { state: ConnState },
    /// A line arrived from the node (verbatim, for the raw console).
    Line { line: String },
    /// A parsed event (also delivered as `Line`).
    Event { event: ClusterEvent },
    /// A line we sent to the node (for the raw console echo).
    Sent { line: String },
    /// A transport or protocol error; the session ends after this.
    Error { message: String },
}

/// Handle for talking to a running session.
#[derive(Debug)]
pub struct SessionHandle {
    tx: mpsc::UnboundedSender<String>,
}

impl SessionHandle {
    /// Queue a command line to send to the node (no trailing CRLF needed).
    pub fn send(&self, line: impl Into<String>) -> Result<(), SessionClosed> {
        self.tx.send(line.into()).map_err(|_| SessionClosed)
    }
}

/// Returned when sending to a session whose task has ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SessionClosed;

impl std::fmt::Display for SessionClosed {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("session is closed")
    }
}
impl std::error::Error for SessionClosed {}

// --- login prompt recognition -------------------------------------------------

static CALL_PROMPT: Lazy<Regex> = Lazy::new(|| {
    // Phrases may drop the colon; the bare word "call"/"callsign" must keep it
    // so ordinary text ending in "call" is not mistaken for a prompt.
    Regex::new(
        r"(?i)((login|please enter your call|enter your call(sign)?|your call(sign)?)\s*:?\s*$)|((callsign|call)\s*:\s*$)",
    )
    .unwrap()
});
static PASSWORD_PROMPT: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)password\s*:?\s*$").unwrap());
/// A node command prompt, e.g. `HA5XYZ de GB7DJK … >` or AR-Cluster `>>`.
static NODE_PROMPT: Lazy<Regex> = Lazy::new(|| Regex::new(r">\s?>?\s*$").unwrap());

/// Does this text (a full line or the pending buffer) ask for the callsign?
pub fn is_call_prompt(text: &str) -> bool {
    CALL_PROMPT.is_match(text.trim_end())
}
/// Does this text ask for a password?
pub fn is_password_prompt(text: &str) -> bool {
    PASSWORD_PROMPT.is_match(text.trim_end())
}
/// Does this text look like the node's ready command prompt?
pub fn is_node_prompt(text: &str) -> bool {
    let t = text.trim_end();
    !t.is_empty() && NODE_PROMPT.is_match(t)
}

/// Steps of the login conversation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Login {
    NeedCall,
    NeedPassword,
    WaitReady,
    Done,
}

/// An instruction the [`LoginMachine`] wants the session loop to carry out.
#[derive(Debug, Clone, PartialEq, Eq)]
enum LoginAction {
    /// Write this line to the node and echo it to the console.
    Send(String),
    /// Write this line but echo it masked (password).
    SendSecret(String),
    /// Login is complete — go Online and run the `on_login` commands.
    Online,
}

/// Drives the login conversation. Fed prompt text as it arrives and a
/// `on_timeout` nudge when a step stalls, so promptless or oddly-worded nodes
/// still get logged in.
struct LoginMachine<'a> {
    profile: &'a NodeProfile,
    state: Login,
}

impl<'a> LoginMachine<'a> {
    fn new(profile: &'a NodeProfile) -> Self {
        Self {
            profile,
            state: Login::NeedCall,
        }
    }

    fn done(&self) -> bool {
        self.state == Login::Done
    }

    /// Advance past the current step, producing the actions for it.
    fn step(&mut self) -> Vec<LoginAction> {
        match self.state {
            Login::NeedCall => {
                self.state = if self.profile.password.is_some() {
                    Login::NeedPassword
                } else {
                    Login::WaitReady
                };
                vec![LoginAction::Send(self.profile.callsign.clone())]
            }
            Login::NeedPassword => {
                self.state = Login::WaitReady;
                match &self.profile.password {
                    Some(pw) => vec![LoginAction::SendSecret(pw.clone())],
                    None => vec![],
                }
            }
            Login::WaitReady => {
                self.state = Login::Done;
                vec![LoginAction::Online]
            }
            Login::Done => vec![],
        }
    }

    /// Feed a line or the current pending buffer.
    fn on_text(&mut self, text: &str) -> Vec<LoginAction> {
        match self.state {
            Login::NeedCall if is_call_prompt(text) => self.step(),
            Login::NeedPassword if is_password_prompt(text) => self.step(),
            Login::WaitReady if is_node_prompt(text) => self.step(),
            _ => vec![],
        }
    }

    /// A step has stalled — force it forward.
    fn on_timeout(&mut self) -> Vec<LoginAction> {
        self.step()
    }
}

/// Tuning knobs for a session.
#[derive(Debug, Clone)]
pub struct SessionConfig {
    /// Read buffer size.
    pub read_buf: usize,
    /// If no callsign prompt is recognised this long after connecting, send the
    /// callsign anyway (some nodes are promptless).
    pub initial_call_delay: Duration,
    /// If a later login step (password, ready prompt) stalls this long, force it.
    pub step_timeout: Duration,
}

impl Default for SessionConfig {
    fn default() -> Self {
        Self {
            read_buf: 8192,
            initial_call_delay: Duration::from_secs(4),
            step_timeout: Duration::from_secs(6),
        }
    }
}

/// Run a session to completion over an established transport.
///
/// Returns when the peer closes the connection, an error occurs, or the command
/// channel is dropped. All observable behaviour is reported through `events`.
pub async fn run_session<S>(
    stream: S,
    profile: &NodeProfile,
    config: &SessionConfig,
    mut commands: mpsc::UnboundedReceiver<String>,
    events: mpsc::UnboundedSender<ConnEvent>,
) where
    S: AsyncRead + AsyncWrite + Unpin,
{
    let (mut reader, mut writer) = tokio::io::split(stream);
    let mut decoder = Decoder::new();
    let mut buf = vec![0u8; config.read_buf.max(1024)];
    let mut login = LoginMachine::new(profile);
    // Chat groups we have joined this session (seeded from `on_login`), so chat
    // lines can be told apart from node chatter.
    let mut groups: BTreeSet<String> = profile
        .on_login
        .iter()
        .filter_map(|c| JOIN_LEAVE_RE.captures(c))
        .filter(|c| c[1].eq_ignore_ascii_case("join"))
        .map(|c| c[2].to_ascii_uppercase())
        .collect();

    let emit = |e: ConnEvent| {
        let _ = events.send(e);
    };
    emit(ConnEvent::State {
        state: ConnState::LoggingIn,
    });

    // A single deadline that nudges the login machine when a step stalls.
    let deadline = tokio::time::sleep(config.initial_call_delay);
    tokio::pin!(deadline);

    loop {
        tokio::select! {
            read = reader.read(&mut buf) => {
                let n = match read {
                    Ok(0) => { emit(ConnEvent::State { state: ConnState::Disconnected }); return; }
                    Ok(n) => n,
                    Err(e) => {
                        emit(ConnEvent::Error { message: format!("read error: {e}") });
                        emit(ConnEvent::State { state: ConnState::Disconnected });
                        return;
                    }
                };
                let decoded = decoder.feed(&buf[..n]);
                if !decoded.replies.is_empty() {
                    let _ = writer.write_all(&decoded.replies).await;
                }
                for line in decoded.lines {
                    emit(ConnEvent::Line { line: line.clone() });
                    if !login.done() {
                        let actions = login.on_text(&line);
                        run_login_actions(actions, profile, &mut writer, &emit, &mut deadline, config).await;
                    }
                    if login.done() {
                        let group_vec: Vec<String> = groups.iter().cloned().collect();
                        let ctx = ParseCtx {
                            my_call: Some(&profile.callsign),
                            my_groups: &group_vec,
                        };
                        emit(ConnEvent::Event { event: parse_line_ctx(&line, &ctx) });
                    }
                }
                // Prompts often arrive without a trailing newline.
                if !login.done() {
                    let pending = decoder.pending().to_string();
                    let actions = login.on_text(&pending);
                    run_login_actions(actions, profile, &mut writer, &emit, &mut deadline, config).await;
                }
            }

            cmd = commands.recv() => {
                match cmd {
                    None => { emit(ConnEvent::State { state: ConnState::Disconnected }); return; }
                    Some(line) => {
                        let trimmed = line.trim_end().to_string();
                        if let Some(c) = JOIN_LEAVE_RE.captures(&trimmed) {
                            let group = c[2].to_ascii_uppercase();
                            if c[1].eq_ignore_ascii_case("join") {
                                groups.insert(group);
                            } else {
                                groups.remove(&group);
                            }
                        }
                        if writer.write_all(format!("{trimmed}\r\n").as_bytes()).await.is_err() {
                            emit(ConnEvent::Error { message: "write failed".into() });
                            emit(ConnEvent::State { state: ConnState::Disconnected });
                            return;
                        }
                        emit(ConnEvent::Sent { line: trimmed });
                    }
                }
            }

            _ = &mut deadline, if !login.done() => {
                let actions = login.on_timeout();
                run_login_actions(actions, profile, &mut writer, &emit, &mut deadline, config).await;
            }
        }
    }
}

/// Carry out login actions and re-arm the stall deadline while login continues.
async fn run_login_actions<W>(
    actions: Vec<LoginAction>,
    profile: &NodeProfile,
    writer: &mut W,
    emit: &impl Fn(ConnEvent),
    deadline: &mut std::pin::Pin<&mut tokio::time::Sleep>,
    config: &SessionConfig,
) where
    W: AsyncWrite + Unpin,
{
    for action in actions {
        match action {
            LoginAction::Send(line) => {
                let _ = writer.write_all(format!("{line}\r\n").as_bytes()).await;
                emit(ConnEvent::Sent { line });
            }
            LoginAction::SendSecret(line) => {
                let _ = writer.write_all(format!("{line}\r\n").as_bytes()).await;
                emit(ConnEvent::Sent {
                    line: "********".into(),
                });
            }
            LoginAction::Online => {
                emit(ConnEvent::State {
                    state: ConnState::Online,
                });
                for cmd in &profile.on_login {
                    if writer
                        .write_all(format!("{}\r\n", cmd.trim_end()).as_bytes())
                        .await
                        .is_ok()
                    {
                        emit(ConnEvent::Sent { line: cmd.clone() });
                    }
                }
            }
        }
    }
    deadline
        .as_mut()
        .reset(tokio::time::Instant::now() + config.step_timeout);
}

/// Open a TCP connection to the node and run a session on it.
///
/// Returns a [`SessionHandle`] for sending commands and the receiver end of the
/// event stream. The session runs on a spawned task.
pub async fn connect(
    profile: NodeProfile,
    config: SessionConfig,
) -> std::io::Result<(SessionHandle, mpsc::UnboundedReceiver<ConnEvent>)> {
    let (ev_tx, ev_rx) = mpsc::unbounded_channel();
    let (cmd_tx, cmd_rx) = mpsc::unbounded_channel();

    let _ = ev_tx.send(ConnEvent::State {
        state: ConnState::Connecting,
    });
    let stream = tokio::net::TcpStream::connect((profile.host.as_str(), profile.port)).await?;
    let _ = stream.set_nodelay(true);

    tokio::spawn(async move {
        run_session(stream, &profile, &config, cmd_rx, ev_tx).await;
    });

    Ok((SessionHandle { tx: cmd_tx }, ev_rx))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Fail fast instead of hanging CI if a session bug stalls the loop.
    async fn guarded<F: std::future::Future>(f: F) -> F::Output {
        tokio::time::timeout(Duration::from_secs(20), f)
            .await
            .expect("test stalled")
    }

    fn profile() -> NodeProfile {
        NodeProfile {
            id: "t".into(),
            host: "x".into(),
            port: 0,
            callsign: "HA5XYZ".into(),
            password: None,
            on_login: vec!["set/ft8".into()],
            auto_connect: false,
            kind: NodeKind::default(),
            software: NodeSoftware::default(),
        }
    }

    #[test]
    fn prompt_matchers() {
        assert!(is_call_prompt("login: "));
        assert!(is_call_prompt("Please enter your call:"));
        // RBN feed prompt, both casings and with a trailing space.
        assert!(is_call_prompt("Please enter your call: "));
        assert!(is_call_prompt("please enter your call:"));
        assert!(is_call_prompt("Your call: "));
        assert!(!is_call_prompt("DX de X: 1"));
        assert!(is_password_prompt("Password: "));
        assert!(is_node_prompt("HA5XYZ de GB7DJK 12-Aug-2025 1830Z >"));
        assert!(is_node_prompt("AR-Cluster >>"));
        assert!(!is_node_prompt(""));
    }

    #[test]
    fn node_kind_serde_defaults_to_cluster() {
        // An old saved profile with no `kind` field deserialises as Cluster.
        let json = r#"{"id":"a","host":"h","port":7300,"callsign":"HA5XYZ"}"#;
        let p: NodeProfile = serde_json::from_str(json).unwrap();
        assert_eq!(p.kind, NodeKind::Cluster);

        // "rbn" round-trips.
        assert_eq!(serde_json::to_string(&NodeKind::Rbn).unwrap(), r#""rbn""#);
        let k: NodeKind = serde_json::from_str(r#""rbn""#).unwrap();
        assert_eq!(k, NodeKind::Rbn);
    }

    #[tokio::test(start_paused = true)]
    async fn logs_in_and_receives_spots() {
        guarded(logs_in_and_receives_spots_body()).await;
    }

    async fn logs_in_and_receives_spots_body() {
        let (client, server) = tokio::io::duplex(4096);
        let (cmd_tx, cmd_rx) = mpsc::unbounded_channel();
        let (ev_tx, mut ev_rx) = mpsc::unbounded_channel();

        let p = profile();
        let cfg = SessionConfig::default();
        let task = tokio::spawn(async move { run_session(client, &p, &cfg, cmd_rx, ev_tx).await });

        let (mut srv_r, mut srv_w) = tokio::io::split(server);

        // Server greets and asks for the call, no newline on the prompt.
        srv_w
            .write_all(b"Welcome to GB7DJK\r\nlogin: ")
            .await
            .unwrap();

        // Expect the client to send its callsign.
        let mut buf = [0u8; 64];
        let n = srv_r.read(&mut buf).await.unwrap();
        assert_eq!(&buf[..n], b"HA5XYZ\r\n");

        // Server sends the ready prompt, then a spot.
        srv_w
            .write_all(b"Hello Bela\r\nHA5XYZ de GB7DJK 12-Aug-2025 1830Z >\r\n")
            .await
            .unwrap();
        srv_w
            .write_all(
                b"DX de DL1ABC:     14195.0  EA8XYZ       hi there                     1831Z\r\n",
            )
            .await
            .unwrap();

        // The client should send the on_login command after reaching Online.
        let n = srv_r.read(&mut buf).await.unwrap();
        assert_eq!(&buf[..n], b"set/ft8\r\n");

        let mut saw_online = false;
        let mut saw_spot = false;
        while let Ok(ev) = tokio::time::timeout(Duration::from_millis(50), ev_rx.recv()).await {
            match ev {
                Some(ConnEvent::State {
                    state: ConnState::Online,
                }) => saw_online = true,
                Some(ConnEvent::Event {
                    event: ClusterEvent::Spot(s),
                }) => {
                    assert_eq!(s.dx_call, "EA8XYZ");
                    saw_spot = true;
                }
                Some(_) => {}
                None => break,
            }
        }
        assert!(saw_online, "should have reached Online");
        assert!(saw_spot, "should have parsed the spot");

        drop(cmd_tx);
        let _ = task.await;
    }

    #[tokio::test(start_paused = true)]
    async fn promptless_node_logs_in_via_timers() {
        guarded(promptless_body()).await;
    }

    async fn promptless_body() {
        let (client, server) = tokio::io::duplex(4096);
        let (_cmd_tx, cmd_rx) = mpsc::unbounded_channel();
        let (ev_tx, mut ev_rx) = mpsc::unbounded_channel();
        let p = profile();
        let cfg = SessionConfig::default();
        tokio::spawn(async move { run_session(client, &p, &cfg, cmd_rx, ev_tx).await });

        let (mut srv_r, mut srv_w) = tokio::io::split(server);
        // A banner with no recognisable prompt at all.
        srv_w
            .write_all(b"*** Connected to NC7J\r\nAR-Cluster v6 Telnet Server\r\n")
            .await
            .unwrap();

        // After initial_call_delay the client sends its callsign unprompted.
        let mut buf = [0u8; 8];
        srv_r.read_exact(&mut buf).await.unwrap();
        assert_eq!(&buf, b"HA5XYZ\r\n");

        // Then step_timeout forces Online (this node never sends a `>` prompt),
        // and the on_login command goes out.
        let mut buf2 = [0u8; 9];
        srv_r.read_exact(&mut buf2).await.unwrap();
        assert_eq!(&buf2, b"set/ft8\r\n");

        let mut saw_online = false;
        while let Ok(Some(ev)) = tokio::time::timeout(Duration::from_millis(50), ev_rx.recv()).await
        {
            if let ConnEvent::State {
                state: ConnState::Online,
            } = ev
            {
                saw_online = true;
                break;
            }
        }
        assert!(
            saw_online,
            "timers should force Online for a promptless node"
        );
    }

    #[test]
    fn login_machine_steps() {
        let p = profile();
        let mut m = LoginMachine::new(&p);
        assert_eq!(m.on_text("banner line"), vec![]);
        assert_eq!(
            m.on_text("login: "),
            vec![LoginAction::Send("HA5XYZ".into())]
        );
        // No password -> next recognised thing is the ready prompt.
        assert_eq!(m.on_text("still logging in"), vec![]);
        assert_eq!(m.on_text("HA5XYZ de NODE >"), vec![LoginAction::Online]);
        assert!(m.done());
    }

    #[test]
    fn login_machine_timeout_forces_progress() {
        let p = NodeProfile {
            password: Some("secret".into()),
            ..profile()
        };
        let mut m = LoginMachine::new(&p);
        assert_eq!(m.on_timeout(), vec![LoginAction::Send("HA5XYZ".into())]);
        assert_eq!(
            m.on_timeout(),
            vec![LoginAction::SendSecret("secret".into())]
        );
        assert_eq!(m.on_timeout(), vec![LoginAction::Online]);
        assert_eq!(m.on_timeout(), vec![]);
    }
}
