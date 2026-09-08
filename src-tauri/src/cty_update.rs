//! Loading and updating the `cty.dat` DXCC country file.
//!
//! A downloaded copy in the app data dir takes precedence over the bundled
//! resource. [`maybe_update`] refreshes it in the background when it is older
//! than a week (with a conditional GET — `If-None-Match` from a saved ETag —
//! so an unchanged file costs one 304); [`force_update`] is the manual
//! "check now". The client pulls the copy committed to this repo (served by
//! GitHub's CDN); the weekly `data-update` workflow re-pulls the canonical
//! file from country-files.com into that copy.

use std::path::{Path, PathBuf};
use std::time::Duration;

use dxcluster_core::reference::CtyDb;
use serde::Serialize;
use tauri::{AppHandle, Manager};

const CTY_URL: &str =
    "https://raw.githubusercontent.com/dacrhu/dx-cluster-desktop/main/src-tauri/resources/cty.dat";
const MAX_AGE: Duration = Duration::from_secs(7 * 24 * 3600);

/// Result of a `cty.dat` update / status check, surfaced to the UI.
#[derive(Debug, Clone, Serialize)]
pub struct CtyStatus {
    pub entities: usize,
    /// `"downloaded"`, `"bundled"`, or `"none"`.
    pub source: String,
    /// Age of the downloaded file in whole days, if present.
    pub age_days: Option<u64>,
    /// Whether this call installed a new file.
    pub updated: bool,
}

fn local_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("cty.dat")
}

fn etag_path(app: &AppHandle) -> PathBuf {
    local_path(app).with_extension("dat.etag")
}

fn file_age(path: &Path) -> Option<Duration> {
    std::fs::metadata(path)
        .ok()?
        .modified()
        .ok()?
        .elapsed()
        .ok()
}

/// Load `cty.dat`, preferring a downloaded copy over the bundled resource.
pub fn load(app: &AppHandle) -> (CtyDb, &'static str) {
    let local = local_path(app);
    if let Ok(text) = std::fs::read_to_string(&local) {
        let db = CtyDb::parse(&text);
        if !db.is_empty() {
            log::info!("loaded downloaded cty.dat with {} entities", db.len());
            return (db, "downloaded");
        }
    }
    let bundled = app
        .path()
        .resolve("resources/cty.dat", tauri::path::BaseDirectory::Resource)
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok());
    match bundled {
        Some(text) => {
            let db = CtyDb::parse(&text);
            log::info!("loaded bundled cty.dat with {} entities", db.len());
            (db, "bundled")
        }
        None => {
            log::warn!("no cty.dat found; DXCC lookups disabled");
            (CtyDb::default(), "none")
        }
    }
}

/// Current status without touching the network.
pub fn status(app: &AppHandle, entities: usize, source: &str) -> CtyStatus {
    CtyStatus {
        entities,
        source: source.to_string(),
        age_days: file_age(&local_path(app)).map(|d| d.as_secs() / 86_400),
        updated: false,
    }
}

/// Download `cty.dat` when the local copy is missing or older than a week.
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

/// Download and install `cty.dat` (conditional on the saved ETag). Returns
/// whether it changed.
pub async fn force_update(app: &AppHandle) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.get(CTY_URL);
    if let Ok(etag) = std::fs::read_to_string(etag_path(app)) {
        let etag = etag.trim();
        if !etag.is_empty() {
            req = req.header(reqwest::header::IF_NONE_MATCH, etag);
        }
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("download: {e}"))?
        .error_for_status()
        .map_err(|e| format!("HTTP: {e}"))?;

    if resp.status() == reqwest::StatusCode::NOT_MODIFIED {
        let _ = touch(&local_path(app));
        return Ok(false);
    }

    let new_etag = resp
        .headers()
        .get(reqwest::header::ETAG)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    let body = resp.text().await.map_err(|e| format!("read: {e}"))?;

    // Sanity check: must parse to a plausible country file.
    let entities = CtyDb::parse(&body).len();
    if entities < 200 {
        return Err(format!("downloaded file looks wrong ({entities} entities)"));
    }

    let local = local_path(app);
    if let Some(dir) = local.parent() {
        std::fs::create_dir_all(dir).ok();
    }
    let changed = std::fs::read_to_string(&local)
        .map(|old| old.trim() != body.trim())
        .unwrap_or(true);
    std::fs::write(&local, body.as_bytes()).map_err(|e| format!("write: {e}"))?;
    match new_etag {
        Some(e) => {
            let _ = std::fs::write(etag_path(app), e);
        }
        None => {
            let _ = std::fs::remove_file(etag_path(app));
        }
    }
    Ok(changed)
}

/// Bump a file's mtime to now (best effort) so we don't re-check for a week.
fn touch(path: &Path) -> std::io::Result<()> {
    let data = std::fs::read(path)?;
    std::fs::write(path, data)
}
