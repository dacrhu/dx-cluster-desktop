//! Turning bare parsed spots into UI-ready records: DXCC resolution for both
//! callsigns plus beam heading / distance from the operator's home locator.

use dxcluster_core::reference::{great_circle, locator_to_latlon, CtyDb, CtyMatch, SkimmerDb};
use dxcluster_core::store::StoredSpot;
use serde::Serialize;

/// DXCC + geometry for one callsign.
#[derive(Debug, Clone, Serialize)]
pub struct CallInfo {
    pub dxcc_name: String,
    pub primary_prefix: String,
    pub continent: String,
    pub cq_zone: u8,
    pub itu_zone: u8,
    pub lat: f64,
    pub lon: f64,
    /// Initial bearing from the home locator, degrees.
    pub bearing_deg: Option<f64>,
    /// Great-circle distance from the home locator, km.
    pub distance_km: Option<f64>,
}

impl CallInfo {
    fn from_match(m: CtyMatch, home: Option<(f64, f64)>) -> Self {
        let (bearing_deg, distance_km) = match home {
            Some(h) => {
                let (d, b) = great_circle(h, (m.lat, m.lon));
                (Some(b.round()), Some(d.round()))
            }
            None => (None, None),
        };
        Self {
            dxcc_name: m.name,
            primary_prefix: m.primary_prefix,
            continent: m.continent,
            cq_zone: m.cq_zone,
            itu_zone: m.itu_zone,
            lat: m.lat,
            lon: m.lon,
            bearing_deg,
            distance_km,
        }
    }
}

/// A stored spot plus resolved DXCC info for the DX and spotter callsigns.
/// `by` is the spotter's DXCC info (`spotter` on the flattened spot is the
/// callsign string, so the info field uses the cluster term `by`).
#[derive(Debug, Clone, Serialize)]
pub struct EnrichedSpot {
    #[serde(flatten)]
    pub spot: StoredSpot,
    pub dx: Option<CallInfo>,
    pub by: Option<CallInfo>,
}

/// Resolve a single callsign against the country file.
pub fn lookup(cty: &CtyDb, call: &str, home_locator: Option<&str>) -> Option<CallInfo> {
    let home = home_locator.and_then(locator_to_latlon);
    cty.lookup(call).map(|m| CallInfo::from_match(m, home))
}

/// Override the spotter (`by`) position with an exact Maidenhead locator — used
/// for PSK Reporter reports, which carry the receiver's grid (far more precise
/// than a DXCC-entity centroid). Recomputes bearing/distance from home.
pub fn place_by_at_locator(spot: &mut EnrichedSpot, locator: &str, home_locator: Option<&str>) {
    // PSK Reporter sometimes carries 10+ char extended locators; fall back to
    // the 6- then 4-char prefix, which `locator_to_latlon` accepts.
    let Some((lat, lon)) = locator_to_latlon(locator)
        .or_else(|| locator.get(..6).and_then(locator_to_latlon))
        .or_else(|| locator.get(..4).and_then(locator_to_latlon))
    else {
        return;
    };
    let (bearing_deg, distance_km) = match home_locator.and_then(locator_to_latlon) {
        Some(h) => {
            let (d, b) = great_circle(h, (lat, lon));
            (Some(b.round()), Some(d.round()))
        }
        None => (None, None),
    };
    match spot.by.as_mut() {
        Some(by) => {
            by.lat = lat;
            by.lon = lon;
            by.bearing_deg = bearing_deg;
            by.distance_km = distance_km;
        }
        None => {
            spot.by = Some(CallInfo {
                dxcc_name: String::new(),
                primary_prefix: String::new(),
                continent: String::new(),
                cq_zone: 0,
                itu_zone: 0,
                lat,
                lon,
                bearing_deg,
                distance_km,
            });
        }
    }
}

/// Enrich a stored spot. When the spot came from a skimmer whose exact grid we
/// know (`skimmers`), the spotter position is that grid rather than the DXCC
/// centroid — a US skimmer plots in Maryland, not the geographic middle of the
/// country.
pub fn enrich(
    cty: &CtyDb,
    skimmers: &SkimmerDb,
    spot: StoredSpot,
    home_locator: Option<&str>,
) -> EnrichedSpot {
    let home = home_locator.and_then(locator_to_latlon);
    let dx = cty
        .lookup(&spot.dx_call)
        .map(|m| CallInfo::from_match(m, home));
    let mut by = cty
        .lookup(&spot.spotter_base)
        .map(|m| CallInfo::from_match(m, home));

    if spot.is_skimmer {
        if let Some((lat, lon)) = skimmers.lookup(&spot.spotter_base) {
            let (bearing_deg, distance_km) = match home {
                Some(h) => {
                    let (d, b) = great_circle(h, (lat, lon));
                    (Some(b.round()), Some(d.round()))
                }
                None => (None, None),
            };
            match by.as_mut() {
                Some(info) => {
                    info.lat = lat;
                    info.lon = lon;
                    info.bearing_deg = bearing_deg;
                    info.distance_km = distance_km;
                }
                None => {
                    by = Some(CallInfo {
                        dxcc_name: String::new(),
                        primary_prefix: String::new(),
                        continent: String::new(),
                        cq_zone: 0,
                        itu_zone: 0,
                        lat,
                        lon,
                        bearing_deg,
                        distance_km,
                    });
                }
            }
        }
    }

    EnrichedSpot { spot, dx, by }
}

#[cfg(test)]
mod tests {
    use super::*;
    use dxcluster_core::band::Mode;
    use dxcluster_core::reference::CtyDb;

    fn spot(spotter: &str, is_skimmer: bool) -> StoredSpot {
        StoredSpot {
            id: 1,
            node_id: "n".into(),
            received_at: 0,
            spotter: spotter.into(),
            spotter_base: dxcluster_core::parser::base_call(spotter).into(),
            freq_khz: 14025.0,
            dx_call: "HA5XYZ".into(),
            comment: "CW 20 dB 25 WPM".into(),
            time_hhmm: "1200".into(),
            grid: None,
            band: Some("20m".into()),
            mode: Mode::Cw,
            is_skimmer,
        }
    }

    #[test]
    fn skimmer_spot_uses_the_skimmer_grid() {
        let cty = CtyDb::parse("");
        let sk = SkimmerDb::parse_tsv("W3LPL\tFM19\n");
        let e = enrich(&cty, &sk, spot("W3LPL-#", true), Some("JN97PM"));
        let by = e.by.expect("by position synthesised from the grid");
        assert!((38.0..40.0).contains(&by.lat), "FM19 lat, got {}", by.lat);
        assert!((-78.0..-76.0).contains(&by.lon), "FM19 lon, got {}", by.lon);
        assert!(by.distance_km.unwrap() > 6000.0); // JN97PM → Maryland
    }

    #[test]
    fn non_skimmer_spot_is_untouched_by_the_table() {
        let cty = CtyDb::parse("");
        let sk = SkimmerDb::parse_tsv("W3LPL\tFM19\n");
        // Same call but not flagged as a skimmer — no position without cty.
        assert!(enrich(&cty, &sk, spot("W3LPL", false), None).by.is_none());
    }

    #[test]
    fn skimmer_not_in_table_falls_through() {
        let cty = CtyDb::parse("");
        let sk = SkimmerDb::default();
        assert!(enrich(&cty, &sk, spot("N0BODY-#", true), None).by.is_none());
    }
}
