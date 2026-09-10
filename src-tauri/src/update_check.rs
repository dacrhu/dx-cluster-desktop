//! Startup "is there a newer release?" check against the GitHub Releases API.
//!
//! Read-only reference lookup, not a cluster transport (same category as the
//! `cty.dat` / `dxclusters.dat` HTTP updates). One request to
//! `api.github.com/.../releases/latest` per launch; the frontend shows a
//! dismissible popup when the tag is newer than the running version. No
//! auto-download — the popup just links to the releases page.

use std::time::Duration;

use serde::Serialize;

const RELEASES_API: &str = "https://api.github.com/repos/dacrhu/dx-cluster-desktop/releases/latest";
const RELEASES_PAGE: &str = "https://github.com/dacrhu/dx-cluster-desktop/releases/latest";

/// Result of the release check, surfaced to the UI.
#[derive(Debug, Clone, Serialize)]
pub struct UpdateInfo {
    /// The running version (`env!("CARGO_PKG_VERSION")`).
    pub current: String,
    /// Latest release tag with any leading `v` stripped, if the check succeeded.
    pub latest: Option<String>,
    /// `latest` is a strictly higher version than `current`.
    pub newer: bool,
    /// The release page to open in the browser.
    pub url: String,
    /// Release notes body, trimmed (may be long — the UI truncates).
    pub notes: Option<String>,
}

/// Ask GitHub for the latest release and compare it to `current`.
pub async fn check(current: &str) -> Result<UpdateInfo, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent(concat!("dx-cluster-desktop/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())?;

    let body = client
        .get(RELEASES_API)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("request: {e}"))?
        .error_for_status()
        .map_err(|e| format!("HTTP: {e}"))?
        .text()
        .await
        .map_err(|e| format!("read: {e}"))?;
    let json: serde_json::Value = serde_json::from_str(&body).map_err(|e| format!("parse: {e}"))?;

    let latest = json
        .get("tag_name")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().trim_start_matches(['v', 'V']).to_string())
        .filter(|s| !s.is_empty());
    let url = json
        .get("html_url")
        .and_then(|v| v.as_str())
        .filter(|s| s.starts_with("https://"))
        .unwrap_or(RELEASES_PAGE)
        .to_string();
    let notes = json
        .get("body")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let newer = latest
        .as_deref()
        .map(|l| version_gt(l, current))
        .unwrap_or(false);

    Ok(UpdateInfo {
        current: current.to_string(),
        latest,
        newer,
        url,
        notes,
    })
}

/// `a > b`, comparing dotted numeric version parts (so `1.10.0` > `1.9.0`).
/// Any pre-release / build suffix (`-rc1`, `+build`) is treated as `0`, i.e.
/// ignored for ordering — good enough for a "nag me on a real release" check.
fn version_gt(a: &str, b: &str) -> bool {
    fn parts(v: &str) -> Vec<u64> {
        v.split(['.', '-', '+'])
            .map(|p| p.parse::<u64>().unwrap_or(0))
            .collect()
    }
    let (pa, pb) = (parts(a), parts(b));
    for i in 0..pa.len().max(pb.len()) {
        let x = pa.get(i).copied().unwrap_or(0);
        let y = pb.get(i).copied().unwrap_or(0);
        if x != y {
            return x > y;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::version_gt;

    #[test]
    fn compares_numeric_parts() {
        assert!(version_gt("1.1.0", "1.0.0"));
        assert!(version_gt("1.10.0", "1.9.0"));
        assert!(version_gt("2.0.0", "1.99.99"));
        assert!(!version_gt("1.0.0", "1.0.0"));
        assert!(!version_gt("1.0.0", "1.0.1"));
    }

    #[test]
    fn tolerates_short_and_suffixed() {
        assert!(version_gt("1.1", "1.0.5"));
        assert!(!version_gt("1.0.0-rc1", "1.0.0"));
        // A pre-release suffix is ignored, so these rank equal (no nag).
        assert!(!version_gt("1.2.0", "1.2.0-rc1"));
    }
}
