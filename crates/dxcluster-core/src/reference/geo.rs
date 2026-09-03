//! Maidenhead locators and great-circle math.
//!
//! Coordinates are decimal degrees, latitude North-positive, longitude
//! East-positive.

/// Convert a Maidenhead locator (4, 6 or 8 chars) to the latitude/longitude of
/// the *centre* of that square. Returns `None` on malformed input.
pub fn locator_to_latlon(grid: &str) -> Option<(f64, f64)> {
    let g = grid.trim().to_ascii_uppercase();
    let b = g.as_bytes();
    if !(b.len() == 4 || b.len() == 6 || b.len() == 8) {
        return None;
    }

    let field_lon = b[0] as i32 - b'A' as i32;
    let field_lat = b[1] as i32 - b'A' as i32;
    if !(0..18).contains(&field_lon) || !(0..18).contains(&field_lat) {
        return None;
    }
    if !b[2].is_ascii_digit() || !b[3].is_ascii_digit() {
        return None;
    }
    let sq_lon = (b[2] - b'0') as f64;
    let sq_lat = (b[3] - b'0') as f64;

    let mut lon = field_lon as f64 * 20.0 + sq_lon * 2.0 - 180.0;
    let mut lat = field_lat as f64 * 10.0 + sq_lat * 1.0 - 90.0;
    // width of the current cell
    let mut lon_size = 2.0;
    let mut lat_size = 1.0;

    if b.len() >= 6 {
        let sub_lon = b[4].to_ascii_uppercase();
        let sub_lat = b[5].to_ascii_uppercase();
        if !(b'A'..=b'X').contains(&sub_lon) || !(b'A'..=b'X').contains(&sub_lat) {
            return None;
        }
        lon += (sub_lon - b'A') as f64 * (2.0 / 24.0);
        lat += (sub_lat - b'A') as f64 * (1.0 / 24.0);
        lon_size = 2.0 / 24.0;
        lat_size = 1.0 / 24.0;
    }

    if b.len() == 8 {
        if !b[6].is_ascii_digit() || !b[7].is_ascii_digit() {
            return None;
        }
        lon += (b[6] - b'0') as f64 * (2.0 / 24.0 / 10.0);
        lat += (b[7] - b'0') as f64 * (1.0 / 24.0 / 10.0);
        lon_size = 2.0 / 24.0 / 10.0;
        lat_size = 1.0 / 24.0 / 10.0;
    }

    Some((lat + lat_size / 2.0, lon + lon_size / 2.0))
}

/// Convert latitude/longitude to a Maidenhead locator with the requested number
/// of character pairs (2 = field, 3 = 6-char, 4 = 8-char). Values outside 2..=4
/// are clamped.
pub fn latlon_to_locator(lat: f64, lon: f64, pairs: usize) -> String {
    let pairs = pairs.clamp(2, 4);
    let mut lon = (lon + 180.0).clamp(0.0, 359.999_999);
    let mut lat = (lat + 90.0).clamp(0.0, 179.999_999);
    let mut out = String::with_capacity(pairs * 2);

    // Pair 1: field (A-R)
    out.push((b'A' + (lon / 20.0) as u8) as char);
    out.push((b'A' + (lat / 10.0) as u8) as char);
    lon %= 20.0;
    lat %= 10.0;

    // Pair 2: square (0-9)
    out.push((b'0' + (lon / 2.0) as u8) as char);
    out.push((b'0' + lat as u8) as char);
    lon %= 2.0;
    lat %= 1.0;

    if pairs >= 3 {
        out.push((b'a' + (lon / (2.0 / 24.0)) as u8) as char);
        out.push((b'a' + (lat / (1.0 / 24.0)) as u8) as char);
        lon %= 2.0 / 24.0;
        lat %= 1.0 / 24.0;
    }
    if pairs >= 4 {
        out.push((b'0' + (lon / (2.0 / 240.0)) as u8) as char);
        out.push((b'0' + (lat / (1.0 / 240.0)) as u8) as char);
    }
    out
}

const EARTH_RADIUS_KM: f64 = 6371.0088;

/// Great-circle distance (km) and initial bearing (degrees, 0..360 clockwise
/// from North) from `from` to `to`. Distance uses the haversine formula, which
/// stays accurate (and returns exactly 0) for coincident points.
pub fn great_circle(from: (f64, f64), to: (f64, f64)) -> (f64, f64) {
    let (lat1, lon1) = (from.0.to_radians(), from.1.to_radians());
    let (lat2, lon2) = (to.0.to_radians(), to.1.to_radians());
    let dlat = lat2 - lat1;
    let dlon = lon2 - lon1;

    let a = (dlat / 2.0).sin().powi(2) + lat1.cos() * lat2.cos() * (dlon / 2.0).sin().powi(2);
    let distance = 2.0 * a.sqrt().min(1.0).asin() * EARTH_RADIUS_KM;

    let y = dlon.sin() * lat2.cos();
    let x = lat1.cos() * lat2.sin() - lat1.sin() * lat2.cos() * dlon.cos();
    let bearing = (y.atan2(x).to_degrees() + 360.0) % 360.0;

    (distance, bearing)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn approx(a: f64, b: f64, eps: f64) {
        assert!((a - b).abs() < eps, "{a} vs {b}");
    }

    #[test]
    fn locator_roundtrip() {
        // JN97mn — Budapest area. Square centre ≈ 47.56 N, 19.04 E.
        let (lat, lon) = locator_to_latlon("JN97mn").unwrap();
        approx(lat, 47.5625, 0.02);
        approx(lon, 19.0417, 0.02);
        assert_eq!(latlon_to_locator(lat, lon, 3), "JN97mn");
    }

    #[test]
    fn locator_four_char() {
        let (lat, lon) = locator_to_latlon("FN31").unwrap();
        approx(lat, 41.5, 0.01);
        approx(lon, -73.0, 0.01);
    }

    #[test]
    fn rejects_bad_locators() {
        assert!(locator_to_latlon("").is_none());
        assert!(locator_to_latlon("ZZ99").is_none());
        assert!(locator_to_latlon("JN9").is_none());
        assert!(locator_to_latlon("JNX7").is_none());
    }

    #[test]
    fn distance_and_bearing() {
        // Budapest (JN97) to New York (FN30) — ~7000 km, bearing ~300°.
        let bud = locator_to_latlon("JN97mn").unwrap();
        let ny = (40.7, -74.0);
        let (dist, brg) = great_circle(bud, ny);
        approx(dist, 7000.0, 250.0);
        assert!((290.0..=320.0).contains(&brg), "bearing was {brg}");
    }

    #[test]
    fn zero_distance() {
        let (dist, _) = great_circle((47.0, 19.0), (47.0, 19.0));
        assert_eq!(dist, 0.0);
    }
}
