//! Loading and refreshing the RBN skimmer position table (`rbn_skimmers.tsv`).
//!
//! Same shape as `presets_update.rs`: a downloaded copy in the app data dir wins
//! over the bundled snapshot. [`maybe_update`] refreshes it weekly by scraping
//! the Reverse Beacon Network's public skimmer status page.
//!
//! The scrape lists only *currently active* skimmers (~300), so a plain rewrite
//! would keep losing every skimmer that happens to be off air at scrape time.
//! Instead each refresh **merges** the fresh scrape into the table we already
//! have (fresh grid wins on conflict) — a skimmer's QTH rarely changes, and a
//! week-old grid still beats the DXCC centroid, so coverage only grows. A failed
//! refresh is logged and ignored. No `#[tauri::command]` surface yet: the
//! app-startup task drives the refresh and hot-swaps `AppState.skimmers`.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

use dxcluster_core::reference::SkimmerDb;
use tauri::{AppHandle, Manager};

const TSV_HEADER: &str =
    "# RBN skimmer positions — CALL<TAB>grid. Accumulated across weekly scrapes of\n\
     # reversebeacon.net/cont_includes/status.php?t=skt (fresh grid wins on conflict).\n";

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

/// The bundled snapshot's text, if it can be read.
fn bundled_text(app: &AppHandle) -> Option<String> {
    app.path()
        .resolve(
            "resources/rbn_skimmers.tsv",
            tauri::path::BaseDirectory::Resource,
        )
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
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
    match bundled_text(app) {
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

/// Parse a `CALL<TAB>grid` TSV into a `base call → grid` map (comments / blanks
/// skipped, SSID / `-#` tail stripped).
fn parse_pairs(text: &str) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((call, grid)) = line.split_once('\t') {
            let base = call
                .split('-')
                .next()
                .unwrap_or(call)
                .trim()
                .to_ascii_uppercase();
            if !base.is_empty() && !grid.trim().is_empty() {
                out.insert(base, grid.trim().to_ascii_uppercase());
            }
        }
    }
    out
}

/// Merge a fresh scrape into the existing table. Within the scrape the first row
/// for a call wins (the page is most-recent-first); a scraped grid then wins
/// over the pre-existing one. Returns `(tsv_body, total, added)`.
fn merge_tsv(existing: &str, scraped: &[(String, String)]) -> (String, usize, usize) {
    let mut table = parse_pairs(existing);

    let mut fresh: BTreeMap<String, String> = BTreeMap::new();
    for (call, grid) in scraped {
        let base = call.split('-').next().unwrap_or(call).to_ascii_uppercase();
        fresh
            .entry(base)
            .or_insert_with(|| grid.to_ascii_uppercase());
    }
    let added = fresh.keys().filter(|k| !table.contains_key(*k)).count();
    table.extend(fresh);

    let mut body = String::from(TSV_HEADER);
    for (call, grid) in &table {
        body.push_str(call);
        body.push('\t');
        body.push_str(grid);
        body.push('\n');
    }
    (body, table.len(), added)
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

    let local = local_path(app);
    // Merge the scrape into what we already have (downloaded copy, else the
    // bundled snapshot) so skimmers that are off air today aren't dropped.
    let existing = std::fs::read_to_string(&local)
        .ok()
        .or_else(|| bundled_text(app))
        .unwrap_or_default();
    let (body, total, added) = merge_tsv(&existing, &pairs);
    log::info!(
        "skimmer table: {total} positions ({added} new, {} scraped)",
        pairs.len()
    );

    if let Some(dir) = local.parent() {
        std::fs::create_dir_all(dir).ok();
    }
    let changed = std::fs::read_to_string(&local)
        .map(|old| old.trim() != body.trim())
        .unwrap_or(true);
    std::fs::write(&local, body.as_bytes()).map_err(|e| format!("write: {e}"))?;
    Ok(changed)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p(c: &str, g: &str) -> (String, String) {
        (c.to_string(), g.to_string())
    }

    #[test]
    fn merge_keeps_old_and_adds_new() {
        let existing = "# header\nW3LPL\tFM19\nDL0ABC\tJO31\n";
        let scraped = [p("W3LPL-#", "FM19LW"), p("OH6BG", "KP03QA")];
        let (body, total, added) = merge_tsv(existing, &scraped);
        assert_eq!(added, 1); // OH6BG is new; W3LPL already known
        assert_eq!(total, 3); // W3LPL, DL0ABC (untouched), OH6BG
        assert!(body.contains("DL0ABC\tJO31")); // off-air skimmer NOT dropped
        assert!(body.contains("OH6BG\tKP03QA"));
        assert!(body.contains("W3LPL\tFM19LW")); // fresh grid won
    }

    #[test]
    fn merge_first_scraped_row_wins_within_a_scrape() {
        // The RBN page lists most-recent first.
        let scraped = [p("K1ABC-#", "FN42"), p("K1ABC-2-#", "FN31")];
        let (body, _, added) = merge_tsv("", &scraped);
        assert_eq!(added, 1);
        assert!(body.contains("K1ABC\tFN42"));
        assert!(!body.contains("FN31"));
    }

    #[test]
    fn parse_pairs_strips_ssid_and_skips_comments() {
        let m = parse_pairs("# c\n\nrk3td-2-#\tKO85\nW1AW\tFN31pr\n");
        assert_eq!(m.get("RK3TD").map(String::as_str), Some("KO85"));
        assert_eq!(m.get("W1AW").map(String::as_str), Some("FN31PR"));
        assert_eq!(m.len(), 2);
    }
}
