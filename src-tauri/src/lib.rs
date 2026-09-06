//! DX Cluster Desktop — Tauri shell over `dxcluster-core`.
//!
//! Phase 1: connect to a node over Telnet, stream parsed spots to the UI
//! (persisted to SQLite and enriched with DXCC/geo), post spots, and push
//! GUI-built filters to the node.

mod cty_update;
mod enrich;
mod muf_update;
mod presets_update;
mod skimmers_update;

use std::collections::HashMap;
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::{Mutex, RwLock};
use std::time::Duration;

use dxcluster_core::commands::{self, SpotFilter};
use dxcluster_core::connection::{
    connect, ConnEvent, NodeKind, NodeProfile, NodeSoftware, SessionConfig, SessionHandle,
};
use dxcluster_core::parser::{
    base_call, parse_directory as parse_dir, parse_read_message, parse_sh_announce, parse_sh_chat,
    parse_sh_dx, parse_sh_station, parse_sh_users, ClusterEvent, HistSpot, MailHeader, StationInfo,
};
use dxcluster_core::pskr::{self, PskrEvent, PskrReport};
use dxcluster_core::reference::{CtyDb, SkimmerDb};
use dxcluster_core::store::{
    Store, StoredAnnounce, StoredChat, StoredMail, StoredSpot, StoredTalk, StoredWcy, StoredWwv,
};
use dxcluster_core::wsjtx::{self, WsjtxEvent, WsjtxSpot};
use dxcluster_core::{logpush, rigctl};
use tauri::{AppHandle, Emitter, Manager, State};

use enrich::{enrich, lookup, place_by_at_locator, CallInfo, EnrichedSpot};

/// A connection slot: reserved while the TCP connect is in flight, then live.
enum ConnSlot {
    Connecting,
    Live {
        handle: SessionHandle,
        /// The callsign this connection logged in with (to spot our own echoes).
        callsign: String,
        /// Cluster node or RBN raw feed.
        kind: NodeKind,
    },
}

impl AppState {
    /// The callsign a live connection logged in with.
    fn callsign_of(&self, id: &str) -> Option<String> {
        match self.sessions.lock().unwrap().get(id) {
            Some(ConnSlot::Live { callsign, .. }) => Some(callsign.clone()),
            _ => None,
        }
    }

    /// Whether a live connection is a cluster node or the RBN feed.
    fn session_kind(&self, id: &str) -> Option<NodeKind> {
        match self.sessions.lock().unwrap().get(id) {
            Some(ConnSlot::Live { kind, .. }) => Some(*kind),
            _ => None,
        }
    }

    /// Admit an RBN spot unless an identical one passed within the last 90 s.
    fn rbn_dedup_admit(&self, key: u64, now: i64) -> bool {
        dedup_admit(&mut self.rbn_recent.lock().unwrap(), key, now)
    }

    /// Admit a PSK Reporter report unless an identical one passed within 90 s.
    fn pskr_dedup_admit(&self, key: u64, now: i64) -> bool {
        dedup_admit(&mut self.pskr_recent.lock().unwrap(), key, now)
    }

    /// Admit a WSJT-X decode unless an identical one passed within 90 s.
    fn wsjtx_dedup_admit(&self, key: u64, now: i64) -> bool {
        dedup_admit(&mut self.wsjtx_recent.lock().unwrap(), key, now)
    }
}

/// 90 s sliding-window dedup over `(key, unix_seconds)` entries. Prunes entries
/// older than the window, then admits `key` only if it isn't already present.
fn dedup_admit(recent: &mut Vec<(u64, i64)>, key: u64, now: i64) -> bool {
    const WINDOW: i64 = 90;
    recent.retain(|(_, ts)| now - *ts < WINDOW);
    if recent.iter().any(|(k, _)| *k == key) {
        return false;
    }
    recent.push((key, now));
    true
}

/// Dedup key for a non-persisted spot: `(base dx call, base spotter, 0.1 kHz)`.
fn synth_spot_key(dx_call: &str, spotter_base: &str, freq_khz: f64) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    base_call(dx_call).to_ascii_uppercase().hash(&mut h);
    base_call(spotter_base).to_ascii_uppercase().hash(&mut h);
    ((freq_khz * 10.0).round() as i64).hash(&mut h);
    h.finish()
}

/// Shared application state.
pub struct AppState {
    store: Store,
    /// DXCC country file — swapped out when `cty.dat` is updated at runtime.
    cty: RwLock<CtyDb>,
    /// Where the loaded country file came from (`downloaded` / `bundled` / `none`).
    cty_source: Mutex<String>,
    /// Public cluster node presets (`dxclusters.dat`), hot-swapped on update.
    presets: RwLock<Vec<dxcluster_core::reference::ClusterPreset>>,
    presets_version: Mutex<Option<String>>,
    presets_source: Mutex<String>,
    /// Known RBN skimmer grid squares (`rbn_skimmers.tsv`), hot-swapped on update.
    skimmers: RwLock<SkimmerDb>,
    skimmers_source: Mutex<String>,
    sessions: Mutex<HashMap<String, ConnSlot>>,
    home_locator: Mutex<Option<String>>,
    /// 90 s in-memory dedup window for RBN spots — `(key, unix_seconds)`.
    /// RBN lines never touch SQLite, so this can't live in the store.
    rbn_recent: Mutex<Vec<(u64, i64)>>,
    /// Same, for PSK Reporter reports.
    pskr_recent: Mutex<Vec<(u64, i64)>>,
    /// Same, for WSJT-X decodes.
    wsjtx_recent: Mutex<Vec<(u64, i64)>>,
    /// Source of synthetic negative ids for RBN / PSK Reporter / WSJT-X spots
    /// (never DB rows), counting down from -1.
    synth_seq: AtomicI64,
    /// The running PSK Reporter feed task, if the user has enabled it.
    pskr_task: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
    /// The running WSJT-X UDP feed task, if the user has enabled it.
    wsjtx_task: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
    /// The running CAT (rigctld) session task, if the user has enabled it.
    rig_task: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
    /// Command channel into the running CAT session (freq/mode sets).
    rig_cmd: Mutex<Option<tokio::sync::mpsc::UnboundedSender<rigctl::RigCommand>>>,
    /// Measured ionosonde data for the map's MUF layer (kc2g), fetched on demand.
    muf: Mutex<muf_update::MufCache>,
}

impl AppState {
    fn home(&self) -> Option<String> {
        self.home_locator.lock().unwrap().clone()
    }
}

type CmdResult<T> = Result<T, String>;

fn now_unix() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// The operating system's UI locale (e.g. `"hu-HU"`), for `language = system`.
/// The webview's `navigator.language` is unreliable on Linux/WebKitGTK, so the
/// frontend asks the OS through here instead.
#[tauri::command]
fn system_locale() -> Option<String> {
    linux_locale_conf().or_else(sys_locale::get_locale)
}

/// On Linux the app is often launched from a desktop entry with no `LANG` in the
/// environment, so `sys-locale` falls back to `"en"`. systemd's canonical source
/// is `/etc/locale.conf` (overridden per-user by `~/.config/locale.conf`); read
/// the same `LC_ALL` > `LC_MESSAGES` > `LANG` order glibc uses, from the
/// environment first and then those files.
#[cfg(target_os = "linux")]
fn linux_locale_conf() -> Option<String> {
    fn normalise(v: &str) -> Option<String> {
        // "hu_HU.UTF-8" / "hu_HU" / `"hu_HU.UTF-8"` -> "hu_HU"
        let v = v.trim().trim_matches('"');
        let v = v.split(['.', '@']).next().unwrap_or(v);
        match v {
            "" | "C" | "POSIX" => None,
            _ => Some(v.to_string()),
        }
    }
    fn from_conf(path: std::path::PathBuf) -> Option<String> {
        let text = std::fs::read_to_string(path).ok()?;
        let find = |key: &str| {
            text.lines()
                .filter_map(|l| l.trim().strip_prefix(key)?.strip_prefix('='))
                .find_map(normalise)
        };
        find("LC_ALL")
            .or_else(|| find("LC_MESSAGES"))
            .or_else(|| find("LANG"))
    }

    for key in ["LC_ALL", "LC_MESSAGES", "LANG"] {
        if let Some(v) = std::env::var(key).ok().as_deref().and_then(normalise) {
            return Some(v);
        }
    }
    std::env::var_os("HOME")
        .map(std::path::PathBuf::from)
        .and_then(|h| from_conf(h.join(".config/locale.conf")))
        .or_else(|| from_conf("/etc/locale.conf".into()))
}

#[cfg(not(target_os = "linux"))]
fn linux_locale_conf() -> Option<String> {
    None
}

#[tauri::command]
fn ping() -> String {
    format!(
        "pong (app {}, core {})",
        env!("CARGO_PKG_VERSION"),
        dxcluster_core::core_version()
    )
}

/// Set the operator's home Maidenhead locator (for beam headings/distance).
#[tauri::command]
fn set_home_locator(state: State<'_, AppState>, locator: Option<String>) {
    *state.home_locator.lock().unwrap() = locator.filter(|s| !s.trim().is_empty());
}

/// Resolve a callsign to DXCC + geometry.
#[tauri::command]
fn lookup_call(state: State<'_, AppState>, call: String) -> Option<CallInfo> {
    lookup(&state.cty.read().unwrap(), &call, state.home().as_deref())
}

/// Most recent spots from history, newest first.
#[tauri::command]
fn recent_spots(state: State<'_, AppState>, limit: usize) -> CmdResult<Vec<EnrichedSpot>> {
    let home = state.home();
    let spots = state.store.recent_spots(limit).map_err(|e| e.to_string())?;
    let cty = state.cty.read().unwrap();
    let skimmers = state.skimmers.read().unwrap();
    Ok(spots
        .into_iter()
        .map(|s| enrich(&cty, &skimmers, s, home.as_deref()))
        .collect())
}

/// Spots received at or after `since` (unix seconds), oldest first.
#[tauri::command]
fn spots_since(state: State<'_, AppState>, since: i64) -> CmdResult<Vec<EnrichedSpot>> {
    let home = state.home();
    let spots = state.store.spots_since(since).map_err(|e| e.to_string())?;
    let cty = state.cty.read().unwrap();
    let skimmers = state.skimmers.read().unwrap();
    Ok(spots
        .into_iter()
        .map(|s| enrich(&cty, &skimmers, s, home.as_deref()))
        .collect())
}

/// Recent announcements / WX, newest first.
#[tauri::command]
fn recent_announcements(
    state: State<'_, AppState>,
    limit: usize,
) -> CmdResult<Vec<StoredAnnounce>> {
    state
        .store
        .recent_announcements(limit)
        .map_err(|e| e.to_string())
}

/// Result of importing `SH/ANN` history.
#[derive(serde::Serialize)]
struct ImportResult {
    imported: usize,
    announcements: Vec<StoredAnnounce>,
}

/// Parse `SH/ANN` history lines (from `runQuery` on the frontend), store any new
/// ones, and return the refreshed recent list plus how many were new.
#[tauri::command]
fn import_announce_history(
    state: State<'_, AppState>,
    node_id: String,
    lines: Vec<String>,
    limit: usize,
) -> CmdResult<ImportResult> {
    let mut imported = 0usize;
    for line in &lines {
        if let Some(h) = parse_sh_announce(line) {
            match state
                .store
                .insert_announce_dedup(&node_id, &h.announce, h.at)
            {
                Ok(Some(_)) => imported += 1,
                Ok(None) => {}
                Err(e) => log::warn!("import announce failed: {e}"),
            }
        }
    }
    let announcements = state
        .store
        .recent_announcements(limit)
        .map_err(|e| e.to_string())?;
    Ok(ImportResult {
        imported,
        announcements,
    })
}

/// Recent WWV broadcasts, newest first.
#[tauri::command]
fn recent_wwv(state: State<'_, AppState>, limit: usize) -> CmdResult<Vec<StoredWwv>> {
    state.store.recent_wwv(limit).map_err(|e| e.to_string())
}

/// Recent WCY broadcasts, newest first.
#[tauri::command]
fn recent_wcy(state: State<'_, AppState>, limit: usize) -> CmdResult<Vec<StoredWcy>> {
    state.store.recent_wcy(limit).map_err(|e| e.to_string())
}

/// Recent talk messages, newest first (the UI groups them by peer).
#[tauri::command]
fn recent_talk(state: State<'_, AppState>, limit: usize) -> CmdResult<Vec<StoredTalk>> {
    state.store.recent_talk(limit).map_err(|e| e.to_string())
}

/// Send a talk message and record it as outgoing.
#[tauri::command]
fn send_talk(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    to: String,
    text: String,
) -> CmdResult<String> {
    let cmd = commands::talk(&to, &text);
    with_session(&state, &id, |h| {
        h.send(cmd.clone()).map_err(|e| e.to_string())
    })?;
    let now = now_unix();
    if let Ok(row_id) = state.store.insert_talk(&id, true, &to, text.trim(), now) {
        let _ = app.emit(
            "cluster://talk",
            StoredTalk {
                id: row_id,
                node_id: id,
                received_at: now,
                outgoing: true,
                peer: to.to_ascii_uppercase(),
                text: text.trim().to_string(),
            },
        );
    }
    Ok(cmd)
}

/// Recent chat messages, newest first (the UI groups them by group).
#[tauri::command]
fn recent_chat(state: State<'_, AppState>, limit: usize) -> CmdResult<Vec<StoredChat>> {
    state.store.recent_chat(limit).map_err(|e| e.to_string())
}

/// Join / leave a chat group.
#[tauri::command]
fn chat_membership(
    state: State<'_, AppState>,
    id: String,
    group: String,
    join: bool,
) -> CmdResult<String> {
    let cmd = if join {
        commands::join_group(&group)
    } else {
        commands::leave_group(&group)
    };
    with_session(&state, &id, |h| {
        h.send(cmd.clone()).map_err(|e| e.to_string())
    })?;
    Ok(cmd)
}

/// Send a chat message to a group. The node echoes the line back, which
/// `forward_event` parses, stores and emits (as `outgoing` when the sender is
/// our callsign) — so nothing is inserted here.
#[tauri::command]
fn send_chat(
    state: State<'_, AppState>,
    id: String,
    group: String,
    text: String,
) -> CmdResult<String> {
    let cmd = commands::chat(&group, &text);
    with_session(&state, &id, |h| {
        h.send(cmd.clone()).map_err(|e| e.to_string())
    })?;
    Ok(cmd)
}

/// Parse `SH/CHAT` history lines, store new rows, return the refreshed list.
#[tauri::command]
fn import_chat_history(
    state: State<'_, AppState>,
    node_id: String,
    lines: Vec<String>,
    limit: usize,
) -> CmdResult<Vec<StoredChat>> {
    for line in &lines {
        if let Some(h) = parse_sh_chat(line) {
            if let Err(e) = state
                .store
                .insert_chat_dedup(&node_id, &h.group, &h.from, &h.text, h.at)
            {
                log::warn!("import chat failed: {e}");
            }
        }
    }
    state.store.recent_chat(limit).map_err(|e| e.to_string())
}

/// Add / remove a buddy.
#[tauri::command]
fn set_buddy(state: State<'_, AppState>, id: String, call: String, add: bool) -> CmdResult<String> {
    let cmd = if add {
        commands::set_buddy(&call)
    } else {
        commands::unset_buddy(&call)
    };
    with_session(&state, &id, |h| {
        h.send(cmd.clone()).map_err(|e| e.to_string())
    })?;
    Ok(cmd)
}

/// Parse `SH/USERS` output into a sorted callsign list.
#[tauri::command]
fn parse_users(lines: Vec<String>) -> Vec<String> {
    parse_sh_users(&lines)
}

/// Parse `SH/STATION` output into a field list.
#[tauri::command]
fn parse_station(lines: Vec<String>) -> Option<StationInfo> {
    parse_sh_station(&lines)
}

/// Parse a `DIRECTORY` listing into message headers.
#[tauri::command]
fn parse_directory(lines: Vec<String>) -> Vec<MailHeader> {
    parse_dir(&lines)
}

/// A `SH/DX` row plus the resolved DXCC name for the DX callsign.
#[derive(serde::Serialize)]
struct HistRow {
    #[serde(flatten)]
    spot: HistSpot,
    dxcc: Option<String>,
}

/// Parse a `SH/DX` / `SH/DXCC` response, adding the DXCC name per row.
#[tauri::command]
fn parse_hist_spots(state: State<'_, AppState>, lines: Vec<String>) -> Vec<HistRow> {
    let cty = state.cty.read().unwrap();
    parse_sh_dx(&lines)
        .into_iter()
        .map(|s| {
            let dxcc = cty.lookup(&s.dx_call).map(|m| m.name);
            HistRow { spot: s, dxcc }
        })
        .collect()
}

/// Offline `SH/DX`: search the local spot history.
#[tauri::command]
fn search_local_spots(
    state: State<'_, AppState>,
    dx_prefix: Option<String>,
    band: Option<String>,
    spotter_prefix: Option<String>,
    since_hours: Option<i64>,
    limit: usize,
) -> CmdResult<Vec<EnrichedSpot>> {
    let since = since_hours.map(|h| now_unix() - h * 3600);
    let home = state.home();
    let rows = state
        .store
        .search_spots(
            dx_prefix.as_deref(),
            band.as_deref(),
            spotter_prefix.as_deref(),
            since,
            limit.clamp(1, 2000),
        )
        .map_err(|e| e.to_string())?;
    let cty = state.cty.read().unwrap();
    let skimmers = state.skimmers.read().unwrap();
    Ok(rows
        .into_iter()
        .map(|s| enrich(&cty, &skimmers, s, home.as_deref()))
        .collect())
}

/// Parse a `READ <msgno>` response, cache the body, and return it.
#[tauri::command]
fn read_mail(
    state: State<'_, AppState>,
    node_id: String,
    lines: Vec<String>,
) -> CmdResult<Option<StoredMail>> {
    let Some(msg) = parse_read_message(&lines) else {
        return Ok(None);
    };
    state
        .store
        .upsert_mail(&node_id, &msg, now_unix())
        .map_err(|e| e.to_string())?;
    state
        .store
        .get_mail(&node_id, msg.msgno)
        .map_err(|e| e.to_string())
}

/// Return a cached mail body without hitting the node.
#[tauri::command]
fn cached_mail(
    state: State<'_, AppState>,
    node_id: String,
    msgno: u32,
) -> CmdResult<Option<StoredMail>> {
    state
        .store
        .get_mail(&node_id, msgno)
        .map_err(|e| e.to_string())
}

/// Post an announcement (`ANN` / `ANN/FULL`).
#[tauri::command]
fn post_announce(
    state: State<'_, AppState>,
    id: String,
    text: String,
    full: bool,
) -> CmdResult<String> {
    let cmd = commands::announce(&text, full);
    with_session(&state, &id, |h| {
        h.send(cmd.clone()).map_err(|e| e.to_string())
    })?;
    Ok(cmd)
}

/// Post a local weather report (`WX`).
#[tauri::command]
fn post_wx(state: State<'_, AppState>, id: String, text: String) -> CmdResult<String> {
    let cmd = commands::wx(&text);
    with_session(&state, &id, |h| {
        h.send(cmd.clone()).map_err(|e| e.to_string())
    })?;
    Ok(cmd)
}

/// Open a connection to a node and start streaming events to the UI.
#[tauri::command]
async fn connect_node(
    app: AppHandle,
    state: State<'_, AppState>,
    profile: NodeProfile,
) -> CmdResult<()> {
    let id = profile.id.clone();
    let callsign = profile.callsign.clone();
    let kind = profile.kind;
    // Reserve the slot synchronously so a double-click can't open two sockets
    // (a same-callsign collision that the node would then kick).
    {
        let mut sessions = state.sessions.lock().unwrap();
        if sessions.contains_key(&id) {
            return Err(format!("already connecting/connected to {id}"));
        }
        sessions.insert(id.clone(), ConnSlot::Connecting);
    }

    // The RBN feed never sends a `>` command prompt, so a 6 s ready-step wait
    // would just delay Online; nudge it forward quickly instead.
    let config = match kind {
        NodeKind::Rbn => SessionConfig {
            step_timeout: Duration::from_millis(800),
            ..SessionConfig::default()
        },
        NodeKind::Cluster => SessionConfig::default(),
    };
    let (handle, mut events) = match connect(profile, config).await {
        Ok(v) => v,
        Err(e) => {
            state.sessions.lock().unwrap().remove(&id);
            return Err(format!("connect failed: {e}"));
        }
    };

    state.sessions.lock().unwrap().insert(
        id.clone(),
        ConnSlot::Live {
            handle,
            callsign,
            kind,
        },
    );

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(ev) = events.recv().await {
            forward_event(&app, &id, ev);
        }
        // Channel closed -> session ended. Drop our handle, but don't clobber a
        // fresh reconnect that may already have reserved the slot.
        if let Some(state) = app.try_state::<AppState>() {
            let mut sessions = state.sessions.lock().unwrap();
            if matches!(sessions.get(&id), Some(ConnSlot::Live { .. })) {
                sessions.remove(&id);
            }
        }
        let _ = app.emit("cluster://closed", &id);
    });

    Ok(())
}

/// Node lines that mean "you have been kicked", usually a same-callsign clash.
fn is_kick_notice(line: &str) -> bool {
    let l = line.to_ascii_lowercase();
    l.contains("this instance is disconnected")
        || l.contains("reconnected as")
        || (l.contains("already") && l.contains("connected"))
}

/// Push one event to the frontend, persisting spots along the way.
fn forward_event(app: &AppHandle, node_id: &str, ev: ConnEvent) {
    match ev {
        ConnEvent::State { state } => {
            let _ = app.emit("cluster://state", (node_id, state));
        }
        ConnEvent::Line { line } => {
            if is_kick_notice(&line) {
                let _ = app.emit(
                    "cluster://error",
                    (
                        node_id,
                        format!("a node lezárta a kapcsolatot: „{}” — fut még máshol kliens ugyanezzel a hívójellel?", line.trim()),
                    ),
                );
            }
            let _ = app.emit("cluster://line", (node_id, line));
        }
        ConnEvent::Sent { line } => {
            let _ = app.emit("cluster://sent", (node_id, line));
        }
        ConnEvent::Error { message } => {
            let _ = app.emit("cluster://error", (node_id, message));
        }
        ConnEvent::Event { event } => match event {
            ClusterEvent::Spot(spot) => {
                let Some(state) = app.try_state::<AppState>() else {
                    return;
                };
                let received = now_unix();

                // RBN raw feed: a firehose of every skimmer decode of every DX.
                // Keep only spots of our own callsign ("who is hearing me"),
                // dedup in memory, and never persist — restart / offline SH/DX
                // must not resurrect them.
                if state.session_kind(node_id) == Some(NodeKind::Rbn) {
                    let my_call = state.callsign_of(node_id).unwrap_or_default();
                    if !base_call(&spot.dx_call).eq_ignore_ascii_case(base_call(&my_call)) {
                        return;
                    }
                    let key = synth_spot_key(&spot.dx_call, &spot.spotter_base, spot.freq_khz);
                    if !state.rbn_dedup_admit(key, received) {
                        return;
                    }
                    let id = state.synth_seq.fetch_sub(1, Ordering::Relaxed);
                    let stored = dxcluster_core::store::StoredSpot {
                        id,
                        node_id: node_id.to_string(),
                        received_at: received,
                        spotter: spot.spotter,
                        spotter_base: spot.spotter_base,
                        freq_khz: spot.freq_khz,
                        dx_call: spot.dx_call,
                        comment: spot.comment,
                        time_hhmm: spot.time_hhmm,
                        grid: spot.grid,
                        band: spot.band,
                        mode: spot.mode,
                        is_skimmer: spot.is_skimmer,
                    };
                    let enriched = enrich(
                        &state.cty.read().unwrap(),
                        &state.skimmers.read().unwrap(),
                        stored,
                        state.home().as_deref(),
                    );
                    let _ = app.emit("cluster://spot", &enriched);
                    return;
                }

                match state.store.insert_spot(node_id, &spot, received) {
                    Ok(None) => {} // duplicate relayed from another node — skip
                    Ok(Some(id)) => {
                        let stored = dxcluster_core::store::StoredSpot {
                            id,
                            node_id: node_id.to_string(),
                            received_at: received,
                            spotter: spot.spotter,
                            spotter_base: spot.spotter_base,
                            freq_khz: spot.freq_khz,
                            dx_call: spot.dx_call,
                            comment: spot.comment,
                            time_hhmm: spot.time_hhmm,
                            grid: spot.grid,
                            band: spot.band,
                            mode: spot.mode,
                            is_skimmer: spot.is_skimmer,
                        };
                        let enriched = enrich(
                            &state.cty.read().unwrap(),
                            &state.skimmers.read().unwrap(),
                            stored,
                            state.home().as_deref(),
                        );
                        let _ = app.emit("cluster://spot", &enriched);
                    }
                    Err(e) => log::warn!("failed to persist spot: {e}"),
                }
            }
            ClusterEvent::Announce(a) => {
                if let Some(state) = app.try_state::<AppState>() {
                    let received = now_unix();
                    match state.store.insert_announce(node_id, &a, received) {
                        Ok(id) => {
                            let stored = StoredAnnounce {
                                id,
                                node_id: node_id.to_string(),
                                received_at: received,
                                sender: a.from,
                                target: a.to,
                                text: a.text,
                                is_wx: a.is_wx,
                            };
                            let _ = app.emit("cluster://announce", &stored);
                        }
                        Err(e) => log::warn!("failed to persist announce: {e}"),
                    }
                }
            }
            ClusterEvent::Wwv(w) => {
                if let Some(state) = app.try_state::<AppState>() {
                    let received = now_unix();
                    match state.store.insert_wwv(node_id, &w, received) {
                        Ok(id) => {
                            let stored = StoredWwv {
                                id,
                                node_id: node_id.to_string(),
                                received_at: received,
                                sender: w.from,
                                hour: w.hour,
                                sfi: w.sfi,
                                a: w.a,
                                k: w.k,
                                forecast: w.forecast,
                            };
                            let _ = app.emit("cluster://wwv", &stored);
                        }
                        Err(e) => log::warn!("failed to persist wwv: {e}"),
                    }
                }
            }
            ClusterEvent::Wcy(w) => {
                if let Some(state) = app.try_state::<AppState>() {
                    let received = now_unix();
                    match state.store.insert_wcy(node_id, &w, received) {
                        Ok(id) => {
                            let stored = StoredWcy {
                                id,
                                node_id: node_id.to_string(),
                                received_at: received,
                                sender: w.from,
                                hour: w.hour,
                                k: w.k,
                                expk: w.expk,
                                a: w.a,
                                r: w.r,
                                sfi: w.sfi,
                                sa: w.sa,
                                gmf: w.gmf,
                                aurora: w.aurora,
                            };
                            let _ = app.emit("cluster://wcy", &stored);
                        }
                        Err(e) => log::warn!("failed to persist wcy: {e}"),
                    }
                }
            }
            ClusterEvent::Talk(t) => {
                if let Some(state) = app.try_state::<AppState>() {
                    let received = now_unix();
                    match state
                        .store
                        .insert_talk(node_id, false, &t.from, &t.text, received)
                    {
                        Ok(id) => {
                            let _ = app.emit(
                                "cluster://talk",
                                StoredTalk {
                                    id,
                                    node_id: node_id.to_string(),
                                    received_at: received,
                                    outgoing: false,
                                    peer: t.from.to_ascii_uppercase(),
                                    text: t.text,
                                },
                            );
                        }
                        Err(e) => log::warn!("failed to persist talk: {e}"),
                    }
                }
            }
            ClusterEvent::Chat(c) => {
                if let Some(state) = app.try_state::<AppState>() {
                    let received = now_unix();
                    let outgoing = state
                        .callsign_of(node_id)
                        .is_some_and(|call| call.eq_ignore_ascii_case(&c.from));
                    match state
                        .store
                        .insert_chat(node_id, outgoing, &c.group, &c.from, &c.text, received)
                    {
                        Ok(id) => {
                            let _ = app.emit(
                                "cluster://chat",
                                StoredChat {
                                    id,
                                    node_id: node_id.to_string(),
                                    received_at: received,
                                    outgoing,
                                    group: c.group.to_ascii_uppercase(),
                                    sender: c.from.to_ascii_uppercase(),
                                    text: c.text,
                                },
                            );
                        }
                        Err(e) => log::warn!("failed to persist chat: {e}"),
                    }
                }
            }
            ClusterEvent::Raw { line } => {
                let _ = app.emit("cluster://raw-event", (node_id, line));
            }
        },
    }
}

/// Close a connection.
#[tauri::command]
fn disconnect_node(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    match state.sessions.lock().unwrap().remove(&id) {
        Some(ConnSlot::Live { handle, .. }) => {
            let _ = handle.send("bye");
            Ok(())
        }
        Some(ConnSlot::Connecting) => Ok(()), // reservation cleared
        None => Err(format!("not connected to {id}")),
    }
}

// --- PSK Reporter feed ("who is hearing me") ---------------------------------

/// Start (or restart) the PSK Reporter MQTT feed for `callsigns`. Reports flow
/// to the UI as synthetic skimmer spots on `cluster://spot` (never persisted),
/// exactly like the RBN feed; lifecycle goes out on `pskr://state`.
#[tauri::command]
fn pskr_start(app: AppHandle, state: State<'_, AppState>, callsigns: Vec<String>) -> CmdResult<()> {
    let calls: Vec<String> = callsigns
        .iter()
        .map(|c| c.trim().to_uppercase())
        .filter(|c| !c.is_empty())
        .collect();
    if calls.is_empty() {
        return Err("no callsign to watch".into());
    }

    // Replace any running feed.
    if let Some(old) = state.pskr_task.lock().unwrap().take() {
        old.abort();
    }
    state.pskr_recent.lock().unwrap().clear();

    // One task owns both the MQTT loop (as a plain future, *not* a detached
    // task) and the event drain, so aborting it on stop/restart tears the
    // rumqttc connection down instead of leaking it.
    let app2 = app.clone();
    let task = tauri::async_runtime::spawn(async move {
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<PskrEvent>();
        let feed = pskr::run(calls, tx);
        tokio::pin!(feed);
        loop {
            tokio::select! {
                _ = &mut feed => break,
                ev = rx.recv() => match ev {
                    None => break,
                    Some(PskrEvent::Connected) => {
                        let _ = app2.emit("pskr://state", "online");
                    }
                    Some(PskrEvent::Disconnected) => {
                        let _ = app2.emit("pskr://state", "connecting");
                    }
                    Some(PskrEvent::Error(msg)) => {
                        let _ = app2.emit("pskr://state", format!("error: {msg}"));
                    }
                    Some(PskrEvent::Report(r)) => forward_pskr_report(&app2, r),
                },
            }
        }
    });
    *state.pskr_task.lock().unwrap() = Some(task);
    let _ = app.emit("pskr://state", "connecting");
    Ok(())
}

/// Stop the PSK Reporter feed.
#[tauri::command]
fn pskr_stop(app: AppHandle, state: State<'_, AppState>) -> CmdResult<()> {
    if let Some(task) = state.pskr_task.lock().unwrap().take() {
        task.abort();
    }
    let _ = app.emit("pskr://state", "off");
    Ok(())
}

/// Turn a PSK Reporter report into a synthetic "reports of me" spot and emit it.
fn forward_pskr_report(app: &AppHandle, r: PskrReport) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    let received = now_unix();
    let freq_khz = r.freq_hz as f64 / 1000.0;

    let key = synth_spot_key(&r.sender, &r.receiver, freq_khz);
    if !state.pskr_dedup_admit(key, received) {
        return;
    }

    let comment = match r.snr_db {
        Some(snr) => format!("{} {} dB (PSK Reporter)", r.mode, snr),
        None => format!("{} (PSK Reporter)", r.mode),
    };
    let hh = ((r.epoch.rem_euclid(86_400)) / 3600) as u32;
    let mm = ((r.epoch.rem_euclid(3600)) / 60) as u32;

    let stored = StoredSpot {
        id: state.synth_seq.fetch_sub(1, Ordering::Relaxed),
        node_id: "pskr".to_string(),
        received_at: received,
        spotter: r.receiver.clone(),
        spotter_base: base_call(&r.receiver).to_string(),
        freq_khz,
        dx_call: r.sender.clone(),
        comment: comment.clone(),
        time_hhmm: format!("{hh:02}{mm:02}"),
        grid: None,
        band: dxcluster_core::band::band_for_khz(freq_khz).map(String::from),
        mode: dxcluster_core::band::guess_mode(freq_khz, &comment),
        is_skimmer: true,
    };

    let home = state.home();
    let mut enriched = enrich(
        &state.cty.read().unwrap(),
        &state.skimmers.read().unwrap(),
        stored,
        home.as_deref(),
    );
    if let Some(loc) = r.receiver_locator.as_deref() {
        place_by_at_locator(&mut enriched, loc, home.as_deref());
    }
    let _ = app.emit("cluster://spot", &enriched);
}

// --- WSJT-X local UDP feed ("what my radio hears") --------------------------

/// Start (or restart) the WSJT-X UDP feed bound to `bind` (`host:port`). Decodes
/// flow to the UI as synthetic spots on `cluster://spot` with the spotter
/// `WSJT-X` (never persisted); lifecycle goes out on `wsjtx://state`.
#[tauri::command]
fn wsjtx_start(app: AppHandle, state: State<'_, AppState>, bind: String) -> CmdResult<()> {
    let bind = bind.trim().to_string();
    if bind.is_empty() {
        return Err("no address".into());
    }

    if let Some(old) = state.wsjtx_task.lock().unwrap().take() {
        old.abort();
    }
    state.wsjtx_recent.lock().unwrap().clear();

    let app2 = app.clone();
    let task = tauri::async_runtime::spawn(async move {
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<WsjtxEvent>();
        let feed = wsjtx::run(bind, tx);
        tokio::pin!(feed);
        loop {
            tokio::select! {
                _ = &mut feed => break,
                ev = rx.recv() => match ev {
                    None => break,
                    Some(WsjtxEvent::Listening) => {
                        let _ = app2.emit("wsjtx://state", "listening");
                    }
                    Some(WsjtxEvent::Receiving) => {
                        let _ = app2.emit("wsjtx://state", "receiving");
                    }
                    Some(WsjtxEvent::Error(msg)) => {
                        let _ = app2.emit("wsjtx://state", format!("error: {msg}"));
                    }
                    Some(WsjtxEvent::Spot(s)) => forward_wsjtx_spot(&app2, s),
                },
            }
        }
    });
    *state.wsjtx_task.lock().unwrap() = Some(task);
    let _ = app.emit("wsjtx://state", "listening");
    Ok(())
}

/// Stop the WSJT-X feed.
#[tauri::command]
fn wsjtx_stop(app: AppHandle, state: State<'_, AppState>) -> CmdResult<()> {
    if let Some(task) = state.wsjtx_task.lock().unwrap().take() {
        task.abort();
    }
    let _ = app.emit("wsjtx://state", "off");
    Ok(())
}

// --- CAT (rig control via rigctld) -----------------------------------------

/// The Hamlib rig catalogue for the Serial-mode model picker (from `rigctl -l`,
/// or the bundled snapshot when Hamlib isn't installed).
#[tauri::command]
async fn rig_models() -> Vec<rigctl::RigModel> {
    tauri::async_runtime::spawn_blocking(rigctl::rig_models)
        .await
        .unwrap_or_default()
}

/// Connect, read the VFO frequency once, disconnect — the Settings "Test"
/// button. For Serial, this spawns a throwaway `rigctld`.
#[tauri::command]
async fn rig_test(cfg: rigctl::RigConfig) -> CmdResult<f64> {
    rigctl::test(cfg).await
}

/// Start (or restart) a CAT session. Frequency/mode sets go in via `rig_set`;
/// lifecycle is on `rig://state`, VFO polls on `rig://vfo`.
#[tauri::command]
fn rig_start(app: AppHandle, state: State<'_, AppState>, cfg: rigctl::RigConfig) -> CmdResult<()> {
    if let Some(old) = state.rig_task.lock().unwrap().take() {
        old.abort();
    }
    let (cmd_tx, cmd_rx) = tokio::sync::mpsc::unbounded_channel::<rigctl::RigCommand>();
    *state.rig_cmd.lock().unwrap() = Some(cmd_tx);

    let app2 = app.clone();
    let task = tauri::async_runtime::spawn(async move {
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<rigctl::RigEvent>();
        let feed = rigctl::run(cfg, cmd_rx, tx);
        tokio::pin!(feed);
        loop {
            tokio::select! {
                _ = &mut feed => break,
                ev = rx.recv() => match ev {
                    None => break,
                    Some(rigctl::RigEvent::Connected) => {
                        let _ = app2.emit("rig://state", "connected");
                    }
                    Some(rigctl::RigEvent::Disconnected) => {
                        let _ = app2.emit("rig://state", "disconnected");
                    }
                    Some(rigctl::RigEvent::Error(msg)) => {
                        let _ = app2.emit("rig://state", format!("error: {msg}"));
                    }
                    Some(rigctl::RigEvent::Vfo { freq_hz, mode }) => {
                        let _ = app2.emit(
                            "rig://vfo",
                            serde_json::json!({ "freqHz": freq_hz, "mode": mode }),
                        );
                    }
                },
            }
        }
    });
    *state.rig_task.lock().unwrap() = Some(task);
    let _ = app.emit("rig://state", "connecting");
    Ok(())
}

/// Stop the CAT session.
#[tauri::command]
fn rig_stop(app: AppHandle, state: State<'_, AppState>) -> CmdResult<()> {
    if let Some(task) = state.rig_task.lock().unwrap().take() {
        task.abort();
    }
    *state.rig_cmd.lock().unwrap() = None;
    let _ = app.emit("rig://state", "off");
    Ok(())
}

/// Tune the rig to `freq_khz` (and optionally switch mode). No-op error if no
/// session is running.
#[tauri::command]
fn rig_set(state: State<'_, AppState>, freq_khz: f64, mode: Option<String>) -> CmdResult<()> {
    let guard = state.rig_cmd.lock().unwrap();
    let tx = guard.as_ref().ok_or("CAT is not connected")?;
    tx.send(rigctl::RigCommand::SetFreqMode {
        freq_hz: freq_khz * 1000.0,
        mode,
    })
    .map_err(|_| "CAT session has gone away".to_string())
}

/// Put the rig into split — receive on `rx_khz`, transmit on `tx_khz`.
#[tauri::command]
fn rig_set_split(
    state: State<'_, AppState>,
    rx_khz: f64,
    tx_khz: f64,
    mode: Option<String>,
) -> CmdResult<()> {
    let guard = state.rig_cmd.lock().unwrap();
    let tx = guard.as_ref().ok_or("CAT is not connected")?;
    tx.send(rigctl::RigCommand::SetSplit {
        rx_hz: rx_khz * 1000.0,
        tx_hz: tx_khz * 1000.0,
        tx_mode: mode,
    })
    .map_err(|_| "CAT session has gone away".to_string())
}

/// Drop split, back to simplex.
#[tauri::command]
fn rig_clear_split(state: State<'_, AppState>) -> CmdResult<()> {
    let guard = state.rig_cmd.lock().unwrap();
    let tx = guard.as_ref().ok_or("CAT is not connected")?;
    tx.send(rigctl::RigCommand::ClearSplit)
        .map_err(|_| "CAT session has gone away".to_string())
}

// --- logging-program push ("prepare a QSO") -------------------------------

/// Push a QSO hint to the local logging program so it pre-fills its entry
/// window. Fire-and-forget UDP; nothing is saved here. Async + blocking send
/// (the WSJT-X path sleeps ~60 ms between a blank and the real Status).
#[tauri::command]
async fn log_prepare(
    host: String,
    port: u16,
    format: logpush::LogFormat,
    hint: logpush::QsoHint,
) -> CmdResult<()> {
    tokio::task::spawn_blocking(move || logpush::send(&host, port, format, &hint))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

/// Best-effort: bring the window whose title contains `title` to the front. The
/// per-OS mechanism is picked here so the user only has to supply a title:
/// `target` is a window-title fragment *or* a freedesktop app-id
/// (`org.foo.Bar`). Each platform tries the mechanisms most likely to work,
/// newest/most-reliable first:
/// - **Linux**: if `target` looks like an app-id, D-Bus `org.freedesktop.
///   Application.Activate` (and `gapplication launch`) — this is the *only*
///   thing that reliably raises another app's window under Wayland. Then the
///   X11 tools `wmctrl` / `xdotool` as a fallback.
/// - **macOS**: `osascript … activate` then `open -a`.
/// - **Windows**: PowerShell `AppActivate` (title or PID).
fn try_cmd(bin: &str, args: &[&str]) -> bool {
    std::process::Command::new(bin)
        .args(args)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[tauri::command]
fn raise_window(title: String) -> CmdResult<()> {
    let target = title.trim().to_string();
    if target.is_empty() {
        return Err("no window title / app-id configured".into());
    }

    #[cfg(target_os = "macos")]
    {
        let esc = target.replace('\\', "\\\\").replace('"', "\\\"");
        if try_cmd(
            "osascript",
            &["-e", &format!("tell application \"{esc}\" to activate")],
        ) {
            return Ok(());
        }
        if try_cmd("open", &["-a", &target]) {
            return Ok(());
        }
        return Err(format!(
            "could not activate \"{target}\" — check the app name"
        ));
    }

    #[cfg(windows)]
    {
        let esc = target.replace('\'', "''");
        let script = format!(
            "$w=New-Object -ComObject WScript.Shell; if(-not $w.AppActivate('{esc}')){{exit 1}}"
        );
        if try_cmd("powershell", &["-NoProfile", "-Command", &script]) {
            return Ok(());
        }
        return Err(format!("could not activate a window titled \"{target}\""));
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let looks_like_app_id = target.contains('.') && !target.contains(char::is_whitespace);
        // 1. freedesktop app activation over D-Bus — the one thing that
        //    reliably raises another app's window under Wayland.
        if looks_like_app_id {
            let obj: String = std::iter::once('/')
                .chain(target.chars().map(|c| match c {
                    '.' => '/',
                    '-' | '+' => '_',
                    other => other,
                }))
                .collect();
            if try_cmd(
                "gdbus",
                &[
                    "call",
                    "--session",
                    "--dest",
                    &target,
                    "--object-path",
                    &obj,
                    "--method",
                    "org.freedesktop.Application.Activate",
                    "{}",
                ],
            ) || try_cmd("gapplication", &["launch", &target])
            {
                return Ok(());
            }
        }
        // 2. X11 window managers (works on X11 sessions and some XWayland).
        if try_cmd("wmctrl", &["-a", &target]) || try_cmd("wmctrl", &["-x", "-a", &target]) {
            return Ok(());
        }
        for how in ["--name", "--classname", "--class"] {
            if try_cmd("xdotool", &["search", how, &target, "windowactivate"]) {
                return Ok(());
            }
        }
        // 3. Last resort: re-launch. Single-instance apps (Electron, GApp,
        //    many Qt apps, Flatpak apps) raise their existing window instead
        //    of opening a second one.
        for name in [target.as_str(), &format!("{target}.desktop")] {
            if try_cmd("gtk-launch", &[name]) {
                return Ok(());
            }
        }
        if looks_like_app_id && try_cmd("flatpak", &["run", &target]) {
            return Ok(());
        }
        return Err(format!(
            "could not raise \"{target}\" — under Wayland pass the app-id (`flatpak list` / `gapplication list-apps`); otherwise install wmctrl / xdotool"
        ));
    }

    #[allow(unreachable_code)]
    Err("window raising is not supported on this platform".into())
}

/// Turn a WSJT-X decode into a synthetic spot (own source category, spotter
/// `WSJT-X`, not a skimmer) and emit it.
fn forward_wsjtx_spot(app: &AppHandle, s: WsjtxSpot) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    let received = now_unix();

    let key = synth_spot_key(&s.dx_call, "WSJT-X", s.freq_khz);
    if !state.wsjtx_dedup_admit(key, received) {
        return;
    }

    let comment = format!("{}  {}  {} dB", s.mode, s.message, s.snr_db)
        .trim()
        .to_string();
    let hh = ((received.rem_euclid(86_400)) / 3600) as u32;
    let mm = ((received.rem_euclid(3600)) / 60) as u32;

    let stored = StoredSpot {
        id: state.synth_seq.fetch_sub(1, Ordering::Relaxed),
        node_id: "wsjtx".to_string(),
        received_at: received,
        spotter: "WSJT-X".to_string(),
        spotter_base: "WSJT-X".to_string(),
        freq_khz: s.freq_khz,
        dx_call: s.dx_call,
        comment: comment.clone(),
        time_hhmm: format!("{hh:02}{mm:02}"),
        grid: s.grid,
        band: dxcluster_core::band::band_for_khz(s.freq_khz).map(String::from),
        mode: dxcluster_core::band::guess_mode(s.freq_khz, &comment),
        is_skimmer: false,
    };

    let home = state.home();
    let cty = state.cty.read().unwrap();
    let mut enriched = enrich(
        &cty,
        &state.skimmers.read().unwrap(),
        stored,
        home.as_deref(),
    );
    // The "spotter" is the local operator — resolve `by` from their own
    // callsign (not the literal "WSJT-X") so spotter-side filters and the map
    // place these at the operator's QTH.
    if !s.de_call.is_empty() {
        if let Some(by) = lookup(&cty, &s.de_call, home.as_deref()) {
            enriched.by = Some(by);
        }
    }
    let _ = app.emit("cluster://spot", &enriched);
}

/// Send a raw command line to a node (used by the Raw terminal tab).
#[tauri::command]
fn send_raw(state: State<'_, AppState>, id: String, line: String) -> CmdResult<()> {
    with_session(&state, &id, |h| h.send(line).map_err(|e| e.to_string()))
}

/// Post a DX spot via the GUI form.
#[tauri::command]
fn post_spot(
    state: State<'_, AppState>,
    id: String,
    freq_khz: f64,
    dx_call: String,
    comment: String,
) -> CmdResult<String> {
    let cmd = commands::dx_spot(freq_khz, &dx_call, &comment);
    with_session(&state, &id, |h| {
        h.send(cmd.clone()).map_err(|e| e.to_string())
    })?;
    Ok(cmd)
}

/// Apply a GUI-built spot filter, in the target node's command dialect. When
/// `to_node` is true the generated command is sent; the command string is
/// always returned for the live preview.
#[tauri::command]
fn apply_spot_filter(
    state: State<'_, AppState>,
    id: String,
    filter: SpotFilter,
    to_node: bool,
    software: NodeSoftware,
) -> CmdResult<Option<String>> {
    let cmd = filter.to_command(software);
    if to_node {
        if let Some(c) = &cmd {
            with_session(&state, &id, |h| {
                h.send(c.clone()).map_err(|e| e.to_string())
            })?;
        }
    }
    Ok(cmd)
}

fn with_session<T>(
    state: &State<'_, AppState>,
    id: &str,
    f: impl FnOnce(&SessionHandle) -> Result<T, String>,
) -> Result<T, String> {
    let sessions = state.sessions.lock().unwrap();
    match sessions.get(id) {
        Some(ConnSlot::Live { handle, .. }) => f(handle),
        Some(ConnSlot::Connecting) => Err(format!("still connecting to {id}")),
        None => Err(format!("not connected to {id}")),
    }
}

/// All DXCC entities (name, primary prefix, centroid) for the map's labels.
#[tauri::command]
fn cty_entities(state: State<'_, AppState>) -> Vec<dxcluster_core::reference::Entity> {
    state.cty.read().unwrap().entities().to_vec()
}

/// Status of the loaded `cty.dat` (no network).
#[tauri::command]
fn cty_status(app: AppHandle, state: State<'_, AppState>) -> cty_update::CtyStatus {
    let entities = state.cty.read().unwrap().len();
    let source = state.cty_source.lock().unwrap().clone();
    cty_update::status(&app, entities, &source)
}

/// Download `cty.dat` if the local copy is older than a week; reload on change.
#[tauri::command]
async fn maybe_update_cty(
    app: AppHandle,
    state: State<'_, AppState>,
) -> CmdResult<cty_update::CtyStatus> {
    apply_cty_update(&app, &state, cty_update::maybe_update(&app).await?)
}

/// Force a `cty.dat` download now; reload on change.
#[tauri::command]
async fn update_cty(
    app: AppHandle,
    state: State<'_, AppState>,
) -> CmdResult<cty_update::CtyStatus> {
    apply_cty_update(&app, &state, cty_update::force_update(&app).await?)
}

fn apply_cty_update(
    app: &AppHandle,
    state: &State<'_, AppState>,
    changed: bool,
) -> CmdResult<cty_update::CtyStatus> {
    if changed {
        let (db, source) = cty_update::load(app);
        let entities = db.len();
        *state.cty.write().unwrap() = db;
        *state.cty_source.lock().unwrap() = source.to_string();
        let mut s = cty_update::status(app, entities, source);
        s.updated = true;
        Ok(s)
    } else {
        let entities = state.cty.read().unwrap().len();
        let source = state.cty_source.lock().unwrap().clone();
        Ok(cty_update::status(app, entities, &source))
    }
}

/// Measured ionosonde data (kc2g) for the map's MUF layer, refreshed if stale.
/// A fetch failure logs and returns the last good snapshot (the frontend then
/// falls back to its own model where coverage is thin).
#[tauri::command]
async fn muf_stations(
    state: State<'_, AppState>,
    force: Option<bool>,
) -> CmdResult<muf_update::MufSnapshot> {
    match muf_update::refresh(&state.muf, force.unwrap_or(false)).await {
        Ok(snap) => Ok(snap),
        Err(e) => {
            log::warn!("muf_stations: {e}");
            Ok(state.muf.lock().unwrap().snapshot())
        }
    }
}

/// Show a desktop notification from the Rust side.
///
/// The `@tauri-apps/plugin-notification` JS `sendNotification` is a silent no-op
/// on Linux, and the plugin's Rust `show()` fires `notify-rust` from inside
/// Tauri's async runtime with the result discarded (`let _ = …`) — so a failure
/// there is invisible. We call `notify-rust` directly on a dedicated OS thread
/// (its `zbus::block_on` must not run on a tokio worker) and log the real
/// outcome.
///
/// On GNOME 49 the freedesktop notification source destroys the notification the
/// instant the sending D-Bus connection disconnects (`messageTray.js`
/// `_onNameVanished` → `source.destroy()`), which kills the banner before it is
/// drawn — but only for notifications it attributes to an app (the
/// `desktop-entry` hint). `notify-rust` opens a fresh connection per `show()`
/// and closes it on drop, so we park recent handles in `NOTIFY_HANDLES` to keep
/// their connections open (bounded ring — old ones drop as new alerts arrive).
#[cfg(target_os = "linux")]
static NOTIFY_HANDLES: Mutex<Vec<notify_rust::NotificationHandle>> = Mutex::new(Vec::new());

#[tauri::command]
fn os_notify(_app: AppHandle, title: String, body: String) -> CmdResult<()> {
    std::thread::spawn(move || {
        let mut n = notify_rust::Notification::new();
        n.summary(&title)
            .body(&body)
            .appname("DX Cluster Desktop")
            .icon("hu.dacr.dxclusterdesktop")
            .hint(notify_rust::Hint::DesktopEntry(
                "hu.dacr.dxclusterdesktop".into(),
            ));
        match n.show() {
            Ok(handle) => {
                log::info!("os_notify: shown ({title})");
                #[cfg(target_os = "linux")]
                if let Ok(mut q) = NOTIFY_HANDLES.lock() {
                    q.push(handle);
                    let overflow = q.len().saturating_sub(8);
                    if overflow > 0 {
                        q.drain(..overflow);
                    }
                }
                #[cfg(not(target_os = "linux"))]
                let _ = handle;
            }
            Err(e) => log::warn!("os_notify failed: {e}"),
        }
    });
    Ok(())
}

// --- cluster node presets (dxclusters.dat) ---------------------------------

/// A preset node with its country resolved from the callsign via `cty.dat`.
#[derive(Debug, Clone, serde::Serialize)]
struct EnrichedPreset {
    name: String,
    host: String,
    port: u16,
    software: String,
    dxcc: Option<String>,
    continent: Option<String>,
    prefix: Option<String>,
}

/// The preset node list, each entry tagged with its DXCC country / continent.
#[tauri::command]
fn cluster_presets(state: State<'_, AppState>) -> Vec<EnrichedPreset> {
    let cty = state.cty.read().unwrap();
    state
        .presets
        .read()
        .unwrap()
        .iter()
        .map(|p| {
            let m = cty.lookup(base_call(&p.name));
            EnrichedPreset {
                name: p.name.clone(),
                host: p.host.clone(),
                port: p.port,
                software: p.software.clone(),
                dxcc: m.as_ref().map(|m| m.name.clone()),
                continent: m.as_ref().map(|m| m.continent.clone()),
                prefix: m.as_ref().map(|m| m.primary_prefix.clone()),
            }
        })
        .collect()
}

/// Status of the loaded preset list (no network).
#[tauri::command]
fn presets_status(app: AppHandle, state: State<'_, AppState>) -> presets_update::PresetsStatus {
    let count = state.presets.read().unwrap().len();
    let version = state.presets_version.lock().unwrap().clone();
    let source = state.presets_source.lock().unwrap().clone();
    presets_update::status(&app, count, version, &source)
}

/// Download the preset list if the local copy is stale; reload on change.
#[tauri::command]
async fn maybe_update_presets(
    app: AppHandle,
    state: State<'_, AppState>,
) -> CmdResult<presets_update::PresetsStatus> {
    apply_presets_update(&app, &state, presets_update::maybe_update(&app).await?)
}

/// Force a preset-list download now; reload on change.
#[tauri::command]
async fn update_presets(
    app: AppHandle,
    state: State<'_, AppState>,
) -> CmdResult<presets_update::PresetsStatus> {
    apply_presets_update(&app, &state, presets_update::force_update(&app).await?)
}

fn apply_presets_update(
    app: &AppHandle,
    state: &State<'_, AppState>,
    changed: bool,
) -> CmdResult<presets_update::PresetsStatus> {
    if changed {
        let (nodes, version, source) = presets_update::load(app);
        let count = nodes.len();
        *state.presets.write().unwrap() = nodes;
        *state.presets_version.lock().unwrap() = version.clone();
        *state.presets_source.lock().unwrap() = source.to_string();
        let mut s = presets_update::status(app, count, version, source);
        s.updated = true;
        Ok(s)
    } else {
        let count = state.presets.read().unwrap().len();
        let version = state.presets_version.lock().unwrap().clone();
        let source = state.presets_source.lock().unwrap().clone();
        Ok(presets_update::status(app, count, version, &source))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(all(desktop, not(any(target_os = "android", target_os = "ios"))))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            }
        }));
    }

    builder
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let data_dir = app.path().app_data_dir().expect("app data dir");
            std::fs::create_dir_all(&data_dir).ok();
            let store =
                Store::open(data_dir.join("history.sqlite3")).expect("open history database");
            let (cty, cty_source) = cty_update::load(&handle);
            let (presets, presets_version, presets_source) = presets_update::load(&handle);
            let (skimmers, skimmers_source) = skimmers_update::load(&handle);
            app.manage(AppState {
                store,
                cty: RwLock::new(cty),
                cty_source: Mutex::new(cty_source.to_string()),
                presets: RwLock::new(presets),
                presets_version: Mutex::new(presets_version),
                presets_source: Mutex::new(presets_source.to_string()),
                skimmers: RwLock::new(skimmers),
                skimmers_source: Mutex::new(skimmers_source.to_string()),
                sessions: Mutex::new(HashMap::new()),
                home_locator: Mutex::new(None),
                rbn_recent: Mutex::new(Vec::new()),
                pskr_recent: Mutex::new(Vec::new()),
                wsjtx_recent: Mutex::new(Vec::new()),
                synth_seq: AtomicI64::new(-1),
                pskr_task: Mutex::new(None),
                wsjtx_task: Mutex::new(None),
                rig_task: Mutex::new(None),
                rig_cmd: Mutex::new(None),
                muf: Mutex::new(muf_update::MufCache::default()),
            });
            // Weekly RBN skimmer-table refresh, best effort — a scrape failure
            // just leaves the bundled snapshot in place. Hot-swapped like cty.
            {
                let h = handle.clone();
                tauri::async_runtime::spawn(async move {
                    match skimmers_update::maybe_update(&h).await {
                        Ok(true) => {
                            let (db, source) = skimmers_update::load(&h);
                            if let Some(state) = h.try_state::<AppState>() {
                                log::info!("skimmer table refreshed: {} positions", db.len());
                                *state.skimmers.write().unwrap() = db;
                                *state.skimmers_source.lock().unwrap() = source.to_string();
                            }
                        }
                        Ok(false) => {}
                        Err(e) => log::warn!("skimmer table refresh: {e}"),
                    }
                });
            }
            if std::env::var("DXCD_NOTIFY_TEST").is_ok() {
                os_notify(
                    app.handle().clone(),
                    "DX Cluster Desktop".into(),
                    "startup notification self-test".into(),
                )
                .ok();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            system_locale,
            set_home_locator,
            lookup_call,
            recent_spots,
            spots_since,
            recent_announcements,
            import_announce_history,
            recent_wwv,
            recent_wcy,
            recent_talk,
            recent_chat,
            import_chat_history,
            connect_node,
            disconnect_node,
            pskr_start,
            pskr_stop,
            wsjtx_start,
            wsjtx_stop,
            rig_models,
            rig_test,
            rig_start,
            rig_stop,
            rig_set,
            rig_set_split,
            rig_clear_split,
            log_prepare,
            raise_window,
            send_raw,
            post_spot,
            post_announce,
            post_wx,
            send_talk,
            send_chat,
            chat_membership,
            set_buddy,
            parse_users,
            parse_station,
            parse_directory,
            parse_hist_spots,
            search_local_spots,
            cty_status,
            cty_entities,
            maybe_update_cty,
            update_cty,
            muf_stations,
            cluster_presets,
            presets_status,
            maybe_update_presets,
            update_presets,
            os_notify,
            read_mail,
            cached_mail,
            apply_spot_filter,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{dedup_admit, is_kick_notice, synth_spot_key};

    #[test]
    fn dedup_window() {
        let mut recent = Vec::new();
        assert!(dedup_admit(&mut recent, 1, 1_000));
        // Same key inside the window: rejected.
        assert!(!dedup_admit(&mut recent, 1, 1_050));
        // Different key: admitted.
        assert!(dedup_admit(&mut recent, 2, 1_050));
        // Same key again once the window has passed: admitted, and the stale
        // entries have been pruned.
        assert!(dedup_admit(&mut recent, 1, 1_200));
        assert!(recent.iter().all(|(_, ts)| *ts >= 1_200 - 90));
    }

    #[test]
    fn synth_key_buckets_frequency_not_spotter() {
        // 0.1 kHz jitter from one skimmer collapses to the same key.
        assert_eq!(
            synth_spot_key("HA5XYZ", "OH6BG", 14025.00),
            synth_spot_key("HA5XYZ", "OH6BG", 14025.04),
        );
        // A different skimmer / receiver is a distinct key.
        assert_ne!(
            synth_spot_key("HA5XYZ", "OH6BG", 14025.00),
            synth_spot_key("HA5XYZ", "DL8TG", 14025.00),
        );
        // Callsigns compared case-insensitively on their base form.
        assert_eq!(
            synth_spot_key("ha5xyz-#", "OH6BG", 14025.00),
            synth_spot_key("HA5XYZ", "OH6BG", 14025.00),
        );
    }

    #[test]
    fn recognises_kick_notices() {
        assert!(is_kick_notice(
            "Reconnected as HG7WHD at 127.0.0.1, this instance is disconnected"
        ));
        assert!(is_kick_notice("Sorry, you are already connected"));
        assert!(!is_kick_notice(
            "DX de HG7WHD: 14195.0 EA8XYZ this instance rocks 1200Z"
        ));
        assert!(!is_kick_notice("HG7WHD de WA9PIE-2 dxspider >"));
    }
}
