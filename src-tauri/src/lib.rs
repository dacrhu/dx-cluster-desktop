//! DX Cluster Desktop — Tauri shell over `dxcluster-core`.
//!
//! Phase 1: connect to a node over Telnet, stream parsed spots to the UI
//! (persisted to SQLite and enriched with DXCC/geo), post spots, and push
//! GUI-built filters to the node.

mod enrich;

use std::collections::HashMap;
use std::sync::Mutex;

use dxcluster_core::commands::{self, SpotFilter};
use dxcluster_core::connection::{connect, ConnEvent, NodeProfile, SessionConfig, SessionHandle};
use dxcluster_core::parser::ClusterEvent;
use dxcluster_core::reference::CtyDb;
use dxcluster_core::store::Store;
use tauri::{AppHandle, Emitter, Manager, State};

use enrich::{enrich, lookup, CallInfo, EnrichedSpot};

/// A connection slot: reserved while the TCP connect is in flight, then live.
enum ConnSlot {
    Connecting,
    Live(SessionHandle),
}

/// Shared application state.
pub struct AppState {
    store: Store,
    cty: CtyDb,
    sessions: Mutex<HashMap<String, ConnSlot>>,
    home_locator: Mutex<Option<String>>,
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
    lookup(&state.cty, &call, state.home().as_deref())
}

/// Most recent spots from history, newest first.
#[tauri::command]
fn recent_spots(state: State<'_, AppState>, limit: usize) -> CmdResult<Vec<EnrichedSpot>> {
    let home = state.home();
    let spots = state.store.recent_spots(limit).map_err(|e| e.to_string())?;
    Ok(spots
        .into_iter()
        .map(|s| enrich(&state.cty, s, home.as_deref()))
        .collect())
}

/// Spots received at or after `since` (unix seconds), oldest first.
#[tauri::command]
fn spots_since(state: State<'_, AppState>, since: i64) -> CmdResult<Vec<EnrichedSpot>> {
    let home = state.home();
    let spots = state.store.spots_since(since).map_err(|e| e.to_string())?;
    Ok(spots
        .into_iter()
        .map(|s| enrich(&state.cty, s, home.as_deref()))
        .collect())
}

/// Open a connection to a node and start streaming events to the UI.
#[tauri::command]
async fn connect_node(
    app: AppHandle,
    state: State<'_, AppState>,
    profile: NodeProfile,
) -> CmdResult<()> {
    let id = profile.id.clone();
    // Reserve the slot synchronously so a double-click can't open two sockets
    // (a same-callsign collision that the node would then kick).
    {
        let mut sessions = state.sessions.lock().unwrap();
        if sessions.contains_key(&id) {
            return Err(format!("already connecting/connected to {id}"));
        }
        sessions.insert(id.clone(), ConnSlot::Connecting);
    }

    let (handle, mut events) = match connect(profile, SessionConfig::default()).await {
        Ok(v) => v,
        Err(e) => {
            state.sessions.lock().unwrap().remove(&id);
            return Err(format!("connect failed: {e}"));
        }
    };

    state
        .sessions
        .lock()
        .unwrap()
        .insert(id.clone(), ConnSlot::Live(handle));

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(ev) = events.recv().await {
            forward_event(&app, &id, ev);
        }
        // Channel closed -> session ended. Drop our handle, but don't clobber a
        // fresh reconnect that may already have reserved the slot.
        if let Some(state) = app.try_state::<AppState>() {
            let mut sessions = state.sessions.lock().unwrap();
            if matches!(sessions.get(&id), Some(ConnSlot::Live(_))) {
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
                match state.store.insert_spot(node_id, &spot, received) {
                    Ok(id) => {
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
                        let enriched = enrich(&state.cty, stored, state.home().as_deref());
                        let _ = app.emit("cluster://spot", &enriched);
                    }
                    Err(e) => log::warn!("failed to persist spot: {e}"),
                }
            }
            other => {
                let _ = app.emit("cluster://raw-event", (node_id, other));
            }
        },
    }
}

/// Close a connection.
#[tauri::command]
fn disconnect_node(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    match state.sessions.lock().unwrap().remove(&id) {
        Some(ConnSlot::Live(handle)) => {
            let _ = handle.send("bye");
            Ok(())
        }
        Some(ConnSlot::Connecting) => Ok(()), // reservation cleared
        None => Err(format!("not connected to {id}")),
    }
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

/// Apply a GUI-built spot filter. When `to_node` is true the generated DXSpider
/// command is sent; the command string is always returned for the live preview.
#[tauri::command]
fn apply_spot_filter(
    state: State<'_, AppState>,
    id: String,
    filter: SpotFilter,
    to_node: bool,
) -> CmdResult<Option<String>> {
    let cmd = filter.to_dxspider();
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
        Some(ConnSlot::Live(handle)) => f(handle),
        Some(ConnSlot::Connecting) => Err(format!("still connecting to {id}")),
        None => Err(format!("not connected to {id}")),
    }
}

fn load_cty(app: &AppHandle) -> CtyDb {
    let path = app
        .path()
        .resolve("resources/cty.dat", tauri::path::BaseDirectory::Resource);
    match path
        .as_ref()
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
    {
        Some(text) => {
            let db = CtyDb::parse(&text);
            log::info!("loaded cty.dat with {} entities", db.len());
            db
        }
        None => {
            log::warn!("cty.dat resource not found; DXCC lookups disabled");
            CtyDb::default()
        }
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
            app.manage(AppState {
                store,
                cty: load_cty(&handle),
                sessions: Mutex::new(HashMap::new()),
                home_locator: Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            set_home_locator,
            lookup_call,
            recent_spots,
            spots_since,
            connect_node,
            disconnect_node,
            send_raw,
            post_spot,
            apply_spot_filter,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::is_kick_notice;

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
