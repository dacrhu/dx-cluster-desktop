//! Turning bare parsed spots into UI-ready records: DXCC resolution for both
//! callsigns plus beam heading / distance from the operator's home locator.

use dxcluster_core::reference::{great_circle, locator_to_latlon, CtyDb, CtyMatch};
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

/// Enrich a stored spot.
pub fn enrich(cty: &CtyDb, spot: StoredSpot, home_locator: Option<&str>) -> EnrichedSpot {
    let home = home_locator.and_then(locator_to_latlon);
    let dx = cty
        .lookup(&spot.dx_call)
        .map(|m| CallInfo::from_match(m, home));
    let by = cty
        .lookup(&spot.spotter_base)
        .map(|m| CallInfo::from_match(m, home));
    EnrichedSpot { spot, dx, by }
}
