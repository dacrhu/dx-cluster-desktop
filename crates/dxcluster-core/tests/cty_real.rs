//! Smoke test against the real bundled `cty.dat` snapshot.

use std::path::PathBuf;

use dxcluster_core::reference::CtyDb;

fn bundled_cty() -> Option<String> {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../src-tauri/resources/cty.dat");
    std::fs::read_to_string(path).ok()
}

#[test]
fn resolves_well_known_callsigns() {
    let Some(text) = bundled_cty() else {
        eprintln!("bundled cty.dat not found; skipping");
        return;
    };
    let db = CtyDb::parse(&text);
    assert!(
        db.len() > 300,
        "expected a full country file, got {}",
        db.len()
    );

    let ha = db.lookup("HA5KDQ").expect("HA5KDQ resolves");
    assert_eq!(ha.name, "Hungary");
    assert_eq!(ha.continent, "EU");
    assert_eq!(ha.cq_zone, 15);

    let w = db.lookup("W1AW").expect("W1AW resolves");
    assert_eq!(w.name, "United States");
    assert_eq!(w.continent, "NA");

    let ja = db.lookup("JA1YSS").expect("JA1YSS resolves");
    assert_eq!(ja.name, "Japan");

    let vk = db
        .lookup("VK9XX/P")
        .expect("portable VK resolves to something");
    assert_eq!(vk.continent, "OC");

    // Longitude must be East-positive after load (Budapest is ~ +19).
    assert!(ha.lon > 0.0 && ha.lon < 40.0, "HA lon was {}", ha.lon);
    // A US west-coast-ish entity should be negative longitude.
    let k6 = db.lookup("K6XX").expect("K6XX resolves");
    assert!(k6.lon < 0.0, "K6 lon was {}", k6.lon);
}
