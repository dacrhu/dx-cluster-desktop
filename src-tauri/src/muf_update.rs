//! Measured ionosphere data for the map's MUF layer.
//!
//! Fetches the GIRO/INGV ionosonde station measurements published by
//! prop.kc2g.com (`api/stations.json`, ~119 points, `mufd` = MUF(3000 km),
//! refreshed every 5 minutes). Kept **in memory only** — stale ionosphere data
//! is worse than none, so there is no disk cache and no bundled fallback. The
//! frontend interpolates the points and blends toward its own model where there
//! is no nearby station.
//!
//! Credit: prop.kc2g.com (Andrew Rodland) / GIRO / INGV.

use std::sync::Mutex;
use std::time::{Duration, SystemTime};

use serde::Serialize;

const MUF_URL: &str = "https://prop.kc2g.com/api/stations.json";
const MAX_AGE: Duration = Duration::from_secs(15 * 60);

/// One ionosonde station's latest measurement.
#[derive(Debug, Clone, Serialize)]
pub struct MufStation {
    pub lat: f64,
    /// Normalised to −180..180 (the source publishes 0..360).
    pub lon: f64,
    /// MUF(3000 km) in MHz.
    pub mufd: f64,
    pub fof2: Option<f64>,
    /// Confidence score, 0..100.
    pub cs: f64,
    pub name: String,
}

/// A snapshot handed to the frontend.
#[derive(Debug, Clone, Serialize, Default)]
pub struct MufSnapshot {
    pub stations: Vec<MufStation>,
    /// Age of the data in seconds, or `None` if never fetched.
    pub age_sec: Option<u64>,
    /// `"kc2g"` once loaded, `"none"` before the first successful fetch.
    pub source: String,
}

#[derive(Default)]
pub struct MufCache {
    stations: Vec<MufStation>,
    fetched_at: Option<SystemTime>,
}

impl MufCache {
    pub fn snapshot(&self) -> MufSnapshot {
        MufSnapshot {
            stations: self.stations.clone(),
            age_sec: self
                .fetched_at
                .and_then(|t| t.elapsed().ok())
                .map(|d| d.as_secs()),
            source: if self.stations.is_empty() {
                "none"
            } else {
                "kc2g"
            }
            .to_string(),
        }
    }

    fn stale(&self) -> bool {
        self.fetched_at
            .map(|t| t.elapsed().map(|d| d > MAX_AGE).unwrap_or(true))
            .unwrap_or(true)
    }
}

fn num(v: &serde_json::Value) -> Option<f64> {
    v.as_f64()
        .or_else(|| v.as_str().and_then(|s| s.trim().parse().ok()))
}

fn normalize_lon(lon: f64) -> f64 {
    let mut l = lon % 360.0;
    if l > 180.0 {
        l -= 360.0;
    }
    if l < -180.0 {
        l += 360.0;
    }
    l
}

/// Parse the `stations.json` payload, dropping records with no confidence or no
/// usable MUFD.
pub fn parse_stations(text: &str) -> Result<Vec<MufStation>, String> {
    let raw: serde_json::Value = serde_json::from_str(text).map_err(|e| format!("JSON: {e}"))?;
    let arr = raw.as_array().ok_or("váratlan JSON (nem tömb)")?;
    let mut out = Vec::with_capacity(arr.len());
    for r in arr {
        let cs = r.get("cs").and_then(num).unwrap_or(-1.0);
        let mufd = r.get("mufd").and_then(num).unwrap_or(0.0);
        if cs < 0.0 || mufd <= 0.0 {
            continue;
        }
        let st = match r.get("station") {
            Some(s) => s,
            None => continue,
        };
        let (lat, lon) = match (
            st.get("latitude").and_then(num),
            st.get("longitude").and_then(num),
        ) {
            (Some(a), Some(b)) => (a, b),
            _ => continue,
        };
        out.push(MufStation {
            lat,
            lon: normalize_lon(lon),
            mufd,
            fof2: r.get("fof2").and_then(num),
            cs,
            name: st
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        });
    }
    Ok(out)
}

/// Return the cached snapshot, refreshing first if it is stale (or `force`).
pub async fn refresh(cache: &Mutex<MufCache>, force: bool) -> Result<MufSnapshot, String> {
    if !force && !cache.lock().unwrap().stale() {
        return Ok(cache.lock().unwrap().snapshot());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent(concat!("dx-cluster-desktop/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())?;

    let text = client
        .get(MUF_URL)
        .send()
        .await
        .map_err(|e| format!("letöltés: {e}"))?
        .error_for_status()
        .map_err(|e| format!("HTTP: {e}"))?
        .text()
        .await
        .map_err(|e| format!("olvasás: {e}"))?;

    let stations = parse_stations(&text)?;
    if stations.len() < 10 {
        return Err(format!("gyanús válasz ({} állomás)", stations.len()));
    }

    let mut c = cache.lock().unwrap();
    log::info!("loaded {} ionosonde measurements from kc2g", stations.len());
    c.stations = stations;
    c.fetched_at = Some(SystemTime::now());
    Ok(c.snapshot())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_and_filters() {
        let json = r#"[
          {"cs": 65.0, "mufd": 32.04, "fof2": 10.15,
           "station": {"name": "Cachoeira Paulista, Brazil", "latitude": "-22.7", "longitude": "315"}},
          {"cs": -1, "mufd": 12.0, "station": {"name": "no confidence", "latitude": "0", "longitude": "0"}},
          {"cs": 50.0, "mufd": 0, "station": {"name": "no muf", "latitude": "1", "longitude": "1"}},
          {"cs": 80.0, "mufd": 18.5, "station": {"name": "Roma", "latitude": 41.9, "longitude": 12.5}}
        ]"#;
        let s = parse_stations(json).unwrap();
        assert_eq!(s.len(), 2);
        assert_eq!(s[0].name, "Cachoeira Paulista, Brazil");
        assert!((s[0].lon - (-45.0)).abs() < 1e-9); // 315 -> -45
        assert!((s[0].mufd - 32.04).abs() < 1e-9);
        assert!((s[1].lon - 12.5).abs() < 1e-9);
    }

    #[test]
    fn normalize_lon_wraps() {
        assert!((normalize_lon(315.0) - (-45.0)).abs() < 1e-9);
        assert!((normalize_lon(12.5) - 12.5).abs() < 1e-9);
        assert!((normalize_lon(190.0) - (-170.0)).abs() < 1e-9);
    }
}
