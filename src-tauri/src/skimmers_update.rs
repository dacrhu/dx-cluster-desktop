//! Loading and refreshing the RBN skimmer position table (`rbn_skimmers.tsv`).
//!
//! Same shape as `presets_update.rs`: a downloaded copy in the app data dir wins
//! over the bundled snapshot. [`maybe_update`] refreshes it weekly by scraping
//! the Reverse Beacon Network's public skimmer status page and rewriting the
//! `CALL<TAB>GRID` file. Stale data just means a skimmer or two plots at an old
//! QTH — the DXCC centroid is still the ultimate fallback — so a failed refresh
//! is logged and ignored. No `#[tauri::command]` surface yet: the app-startup
//! task drives the refresh and hot-swaps `AppState.skimmers`.

use std::path::{Path, PathBuf};
use std::time::Duration;

use dxcluster_core::reference::SkimmerDb;
use tauri::{AppHandle, Manager};

const SKIMMERS_URL: &str = "https://www.reversebeacon.net/cont_includes/status.php?t=skt";
const MAX_AGE: Duration = Duration::from_secs(7 * 24 * 3600);
const MIN_PLAUSIBLE: usize = 100;

fn local_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("rbn_skimmers.tsv")
}

fn file_age(path: &Path) -> Option<Duration> {
    std::fs::metadata(path)
        .ok()?
        .modified()
        .ok()?
        .elapsed()
        .ok()
}

/// Load the table, preferring a downloaded copy over the bundled snapshot.
/// Returns `(db, source)` where source is `downloaded` / `bundled` / `none`.
pub fn load(app: &AppHandle) -> (SkimmerDb, &'static str) {
    if let Ok(text) = std::fs::read_to_string(local_path(app)) {
        let db = SkimmerDb::parse_tsv(&text);
        if !db.is_empty() {
            log::info!("loaded {} downloaded skimmer positions", db.len());
            return (db, "downloaded");
        }
    }
    let bundled = app
        .path()
        .resolve(
            "resources/rbn_skimmers.tsv",
            tauri::path::BaseDirectory::Resource,
        )
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok());
    match bundled {
        Some(text) => {
            let db = SkimmerDb::parse_tsv(&text);
            log::info!("loaded {} bundled skimmer positions", db.len());
            (db, "bundled")
        }
        None => {
            log::warn!("no rbn_skimmers.tsv found; skimmers plot at DXCC centroids");
            (SkimmerDb::default(), "none")
        }
    }
}

/// Refresh when the local copy is missing or older than a week.
pub async fn maybe_update(app: &AppHandle) -> Result<bool, String> {
    let stale = file_age(&local_path(app))
        .map(|a| a > MAX_AGE)
        .unwrap_or(true);
    if stale {
        force_update(app).await
    } else {
        Ok(false)
    }
}

/// Scrape the RBN status page now and rewrite the local TSV. Returns whether the
/// file's contents changed.
pub async fn force_update(app: &AppHandle) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent(concat!("dx-cluster-desktop/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())?;

    let html = client
        .get(SKIMMERS_URL)
        .send()
        .await
        .map_err(|e| format!("download: {e}"))?
        .error_for_status()
        .map_err(|e| format!("HTTP: {e}"))?
        .text()
        .await
        .map_err(|e| format!("read: {e}"))?;

    let pairs = SkimmerDb::parse_rbn_html(&html);
    if pairs.len() < MIN_PLAUSIBLE {
        return Err(format!(
            "scraped page looks wrong ({} skimmers)",
            pairs.len()
        ));
    }

    // De-dupe by base call, first row wins (the page lists most-recent first).
    let mut seen = std::collections::BTreeMap::new();
    for (call, grid) in pairs {
        let base = call.split('-').next().unwrap_or(&call).to_string();
        seen.entry(base).or_insert(grid);
    }
    let mut body = String::from(
        "# RBN skimmer positions — CALL<TAB>grid. Scraped from\n\
         # reversebeacon.net/cont_includes/status.php?t=skt\n",
    );
    for (call, grid) in &seen {
        body.push_str(call);
        body.push('\t');
        body.push_str(grid);
        body.push('\n');
    }

    let local = local_path(app);
    if let Some(dir) = local.parent() {
        std::fs::create_dir_all(dir).ok();
    }
    let changed = std::fs::read_to_string(&local)
        .map(|old| old.trim() != body.trim())
        .unwrap_or(true);
    std::fs::write(&local, body.as_bytes()).map_err(|e| format!("write: {e}"))?;
    Ok(changed)
}
