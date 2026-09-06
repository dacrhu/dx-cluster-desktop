//! Known positions of RBN / CW-Skimmer stations, so a spot from a skimmer lands
//! at the skimmer's real grid square instead of its DXCC-entity centroid (which
//! is far off for large countries — a US skimmer would otherwise plot in Kansas).
//!
//! The bundled snapshot is a plain `CALL<TAB>GRID` table
//! (`src-tauri/resources/rbn_skimmers.tsv`), distilled from the Reverse Beacon
//! Network's public skimmer status list. [`SkimmerDb::parse_rbn_html`] recovers
//! the same pairs straight from that HTML page for the data-update job.

use std::collections::HashMap;

use super::geo::locator_to_latlon;
use once_cell::sync::Lazy;
use regex::Regex;

/// Callsign → `(lat, lon)` for stations whose location we know precisely.
#[derive(Debug, Clone, Default)]
pub struct SkimmerDb {
    by_call: HashMap<String, (f64, f64)>,
}

/// Strip any `-SSID` / `-#` tail — `RK3TD-2-#` and `RK3TD-#` both key as `RK3TD`,
/// matching how a spot's `spotter_base` is keyed downstream.
fn key_of(call: &str) -> String {
    call.split('-').next().unwrap_or(call).to_ascii_uppercase()
}

impl SkimmerDb {
    /// Parse the bundled `CALL<TAB>GRID` snapshot. Blank lines and `#` comments
    /// are skipped; a row with an unparseable grid is dropped.
    pub fn parse_tsv(text: &str) -> Self {
        let mut by_call = HashMap::new();
        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            let mut it = line.split('\t');
            let (Some(call), Some(grid)) = (it.next(), it.next()) else {
                continue;
            };
            if let Some((lat, lon)) = locator_to_latlon(grid.trim()) {
                by_call.entry(key_of(call.trim())).or_insert((lat, lon));
            }
        }
        Self { by_call }
    }

    /// Extract `(call, grid)` pairs from the RBN skimmer status page
    /// (`reversebeacon.net/cont_includes/status.php?t=skt`): each `<tr>` has a
    /// `?c=<CALL>&t=de` link and, a few cells later, a bare `<td>GRID</td>`.
    /// Split on `<tr` first so a grid-less row can't borrow the next row's grid.
    pub fn parse_rbn_html(html: &str) -> Vec<(String, String)> {
        static CALL: Lazy<Regex> =
            Lazy::new(|| Regex::new(r"(?i)[?&]c=([A-Za-z0-9]+(?:-\d+)?)&t=de").unwrap());
        static GRID: Lazy<Regex> =
            Lazy::new(|| Regex::new(r"(?i)<td>\s*([A-R]{2}\d{2}(?:[A-X]{2})?)\s*</td>").unwrap());
        let mut out = Vec::new();
        for row in html.split("<tr") {
            if let (Some(c), Some(g)) = (CALL.captures(row), GRID.captures(row)) {
                out.push((c[1].to_ascii_uppercase(), g[1].to_ascii_uppercase()));
            }
        }
        out
    }

    /// Build straight from the scraped HTML (used when a fresh copy is fetched).
    pub fn from_rbn_html(html: &str) -> Self {
        let mut by_call = HashMap::new();
        for (call, grid) in Self::parse_rbn_html(html) {
            if let Some(ll) = locator_to_latlon(&grid) {
                by_call.entry(key_of(&call)).or_insert(ll);
            }
        }
        Self { by_call }
    }

    pub fn len(&self) -> usize {
        self.by_call.len()
    }

    pub fn is_empty(&self) -> bool {
        self.by_call.is_empty()
    }

    /// `(lat, lon)` for a skimmer callsign, if known. Accepts the raw or the
    /// base callsign.
    pub fn lookup(&self, call: &str) -> Option<(f64, f64)> {
        self.by_call.get(&key_of(call)).copied()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_tsv_and_strips_ssid() {
        let db = SkimmerDb::parse_tsv(
            "# comment\n\
             W3LPL\tFM19\n\
             RK3TD\tKO85\n\
             BADCALL\tZZ99zz\n",
        );
        assert_eq!(db.len(), 2); // BADCALL's grid is invalid → dropped
        let (lat, lon) = db.lookup("W3LPL-#").unwrap();
        assert!((38.0..40.0).contains(&lat), "FM19 ~39N, got {lat}");
        assert!((-78.0..-76.0).contains(&lon), "FM19 ~77W, got {lon}");
        // SSID + node suffix both stripped
        assert_eq!(db.lookup("RK3TD-2-#"), db.lookup("RK3TD"));
        assert!(db.lookup("N0BODY").is_none());
    }

    #[test]
    fn parses_rbn_status_html() {
        let html = r#"
            <tr class="online online1h online24h online7d total">
            <td><a href="/dxsd1.php?f=0&c=OH6BG&t=de" title="show spots sent from this skimmer">
            OH6BG </a> </td>
            <td class="right"> 20m,40m</a></td>
            <td>KP03QA</td>
            <td><a href="/dxsd1.php?t=x&id_dxcc_de=224">OH</a></td>
            </tr>
            <tr class="online">
            <td><a href="/dxsd1.php?f=0&c=VU2CPL-8&t=de" title="x">VU2CPL-8 </a></td>
            <td class="right"></a></td>
            <td>MK83TE</td>
            </tr>"#;
        let pairs = SkimmerDb::parse_rbn_html(html);
        assert_eq!(
            pairs,
            vec![
                ("OH6BG".to_string(), "KP03QA".to_string()),
                ("VU2CPL-8".to_string(), "MK83TE".to_string()),
            ]
        );
        let db = SkimmerDb::from_rbn_html(html);
        assert!(db.lookup("VU2CPL").is_some());
        assert!(db.lookup("OH6BG").is_some());
    }
}
