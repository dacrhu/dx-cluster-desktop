//! Parser and lookup for `cty.dat` (the "Big CTY" country file from
//! country-files.com), used to resolve a callsign to its DXCC entity, CQ/ITU
//! zones, continent and approximate location.
//!
//! ## File format
//!
//! Each entity is an 8-field header line terminated with `:`, followed by one or
//! more continuation lines listing prefix/callsign aliases separated by `,` and
//! ended with `;`:
//!
//! ```text
//! Hungary:                   15:  28:  EU:   47.16:    19.45:    -1.0:  HA:
//!     HA,HG;
//! ```
//!
//! An alias may carry overrides: `(nn)` = CQ zone, `[nn]` = ITU zone,
//! `<lat/lon>` = coordinates, `{cc}` = continent. A leading `=` means the token
//! is a full callsign, not a prefix.
//!
//! `cty.dat` longitude is **West-positive**; we negate it on load so everything
//! downstream is East-positive (matching [`super::geo`]).

use std::collections::HashMap;

use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};

/// A DXCC entity as described by `cty.dat`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Entity {
    pub name: String,
    pub cq_zone: u8,
    pub itu_zone: u8,
    pub continent: String,
    pub lat: f64,
    /// East-positive longitude.
    pub lon: f64,
    pub primary_prefix: String,
}

/// The result of resolving a callsign, with any alias-level overrides applied.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Match {
    pub name: String,
    pub primary_prefix: String,
    pub continent: String,
    pub cq_zone: u8,
    pub itu_zone: u8,
    pub lat: f64,
    pub lon: f64,
}

#[derive(Debug, Clone)]
struct Alias {
    entity: usize,
    cq: Option<u8>,
    itu: Option<u8>,
    continent: Option<String>,
    latlon: Option<(f64, f64)>,
}

/// A parsed country file ready for lookups.
#[derive(Debug, Default)]
pub struct CtyDb {
    entities: Vec<Entity>,
    /// Prefix (uppercase) -> alias.
    prefixes: HashMap<String, Alias>,
    /// Exact callsign (uppercase, from `=CALL` tokens) -> alias.
    exact: HashMap<String, Alias>,
}

static OVERRIDE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\((\d+)\)|\[(\d+)\]|<([-0-9./]+)>|\{([A-Za-z]+)\}|~[^~]*~").unwrap());

impl CtyDb {
    /// Parse the contents of a `cty.dat` file. Lines beginning with `#` and blank
    /// lines are ignored, so a placeholder file with comments still loads.
    pub fn parse(text: &str) -> Self {
        let mut db = CtyDb::default();
        let mut header: Option<Entity> = None;
        let mut alias_buf = String::new();

        for raw in text.lines() {
            let line = raw.trim_end();
            if line.trim_start().starts_with('#') || line.trim().is_empty() {
                continue;
            }

            if header.is_none() {
                // Expect a header line: 8 colon-separated fields.
                let parts: Vec<&str> = line.split(':').map(str::trim).collect();
                if parts.len() < 8 {
                    continue;
                }
                let entity = Entity {
                    name: parts[0].to_string(),
                    cq_zone: parts[1].parse().unwrap_or(0),
                    itu_zone: parts[2].parse().unwrap_or(0),
                    continent: parts[3].to_string(),
                    lat: parts[4].parse().unwrap_or(0.0),
                    lon: -parts[5].parse().unwrap_or(0.0),
                    primary_prefix: parts[7].trim_start_matches('*').to_string(),
                };
                header = Some(entity);
                alias_buf.clear();
                continue;
            }

            // Continuation line(s) with aliases, ending at `;`.
            alias_buf.push_str(line.trim());
            if line.trim_end().ends_with(';') {
                let entity = header.take().expect("header set");
                let idx = db.entities.len();
                db.entities.push(entity);
                let list = alias_buf.trim_end_matches(';');
                for token in list.split(',') {
                    db.add_alias(idx, token.trim());
                }
                alias_buf.clear();
            }
        }

        db
    }

    fn add_alias(&mut self, entity: usize, token: &str) {
        if token.is_empty() {
            return;
        }
        let mut cq = None;
        let mut itu = None;
        let mut continent = None;
        let mut latlon = None;

        for c in OVERRIDE_RE.captures_iter(token) {
            if let Some(m) = c.get(1) {
                cq = m.as_str().parse().ok();
            } else if let Some(m) = c.get(2) {
                itu = m.as_str().parse().ok();
            } else if let Some(m) = c.get(3) {
                let mut it = m.as_str().split('/');
                if let (Some(a), Some(b)) = (it.next(), it.next()) {
                    if let (Ok(lat), Ok(lon)) = (a.parse::<f64>(), b.parse::<f64>()) {
                        latlon = Some((lat, -lon));
                    }
                }
            } else if let Some(m) = c.get(4) {
                continent = Some(m.as_str().to_ascii_uppercase());
            }
        }

        let key = OVERRIDE_RE
            .replace_all(token, "")
            .trim()
            .to_ascii_uppercase();
        if key.is_empty() {
            return;
        }
        let alias = Alias {
            entity,
            cq,
            itu,
            continent,
            latlon,
        };
        if let Some(call) = key.strip_prefix('=') {
            self.exact.insert(call.to_string(), alias);
        } else {
            self.prefixes.insert(key, alias);
        }
    }

    /// Number of entities loaded.
    pub fn len(&self) -> usize {
        self.entities.len()
    }
    pub fn is_empty(&self) -> bool {
        self.entities.is_empty()
    }

    /// All DXCC entities (for the map's country labels).
    pub fn entities(&self) -> &[Entity] {
        &self.entities
    }

    /// Resolve a callsign. Handles `/P`, `/MM`, `/QRP` … suffixes and
    /// `PREFIX/CALL` portable operation.
    pub fn lookup(&self, callsign: &str) -> Option<Match> {
        let call = normalise_call(callsign);
        if let Some(a) = self.exact.get(&call) {
            return Some(self.resolve(a));
        }

        // Portable prefix handling: pick the segment that identifies a DXCC,
        // then match the longest known prefix of it.
        let effective = effective_call(&call);
        (1..=effective.len().min(8))
            .rev()
            .find_map(|end| self.prefixes.get(&effective[..end]))
            .map(|a| self.resolve(a))
    }

    fn resolve(&self, a: &Alias) -> Match {
        let e = &self.entities[a.entity];
        let (lat, lon) = a.latlon.unwrap_or((e.lat, e.lon));
        Match {
            name: e.name.clone(),
            primary_prefix: e.primary_prefix.clone(),
            continent: a.continent.clone().unwrap_or_else(|| e.continent.clone()),
            cq_zone: a.cq.unwrap_or(e.cq_zone),
            itu_zone: a.itu.unwrap_or(e.itu_zone),
            lat,
            lon,
        }
    }
}

/// Strip whitespace and upper-case.
fn normalise_call(call: &str) -> String {
    call.trim().to_ascii_uppercase()
}

/// Common operational suffixes that do not change the DXCC entity.
const NON_LOCATION_SUFFIXES: &[&str] = &["P", "M", "MM", "AM", "QRP", "A", "LH", "J", "R", "T"];

/// Given a normalised callsign, return the segment to match against prefixes,
/// resolving `DL/HA5XYZ/P` style portable operation to `DL`.
fn effective_call(call: &str) -> String {
    if !call.contains('/') {
        return call.to_string();
    }
    let parts: Vec<&str> = call.split('/').filter(|p| !p.is_empty()).collect();
    let candidates: Vec<&str> = parts
        .iter()
        .copied()
        .filter(|p| {
            !NON_LOCATION_SUFFIXES.contains(&p.to_ascii_uppercase().as_str()) && p.len() != 1
        })
        .collect();
    match candidates.as_slice() {
        [] => parts.first().copied().unwrap_or(call).to_string(),
        [one] => one.to_string(),
        many => {
            // The shortest segment is the added location prefix.
            many.iter()
                .min_by_key(|p| p.len())
                .copied()
                .unwrap_or(call)
                .to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "\
Hungary:                   15:  28:  EU:   47.16:   -19.45:    -1.0:  HA:
    HA,HG;
United States:             05:  08:  NA:   37.53:    91.66:     5.0:  K:
    AA,AB,AC,AD,AE,AF,AG,AI,AJ,AK,K,N,W,W1(05)[08],=W1AW;
Alaska:                    03:  01:  NA:   61.40:   148.87:     9.0:  KL:
    AL,KL,NL,WL;
Germany:                   14:  28:  EU:   51.00:   -10.00:    -1.0:  DL:
    DA,DB,DC,DD,DF,DG,DH,DJ,DK,DL,DM,DO;
";

    #[test]
    fn parses_entities() {
        let db = CtyDb::parse(SAMPLE);
        assert_eq!(db.len(), 4);
    }

    #[test]
    fn resolves_simple_calls() {
        let db = CtyDb::parse(SAMPLE);
        let m = db.lookup("HA5XYZ").unwrap();
        assert_eq!(m.name, "Hungary");
        assert_eq!(m.cq_zone, 15);
        assert_eq!(m.continent, "EU");
        // West-positive in the file, East-positive after load.
        assert!((m.lon - 19.45).abs() < 0.01);

        assert_eq!(db.lookup("DL1ABC").unwrap().name, "Germany");
        assert_eq!(db.lookup("KL7RA").unwrap().name, "Alaska");
    }

    #[test]
    fn exact_call_override_wins() {
        let db = CtyDb::parse(SAMPLE);
        let m = db.lookup("W1AW").unwrap();
        assert_eq!(m.name, "United States");
    }

    #[test]
    fn alias_zone_override() {
        let db = CtyDb::parse(SAMPLE);
        let m = db.lookup("W1ABC").unwrap();
        assert_eq!(m.cq_zone, 5);
        assert_eq!(m.itu_zone, 8);
    }

    #[test]
    fn portable_prefix() {
        let db = CtyDb::parse(SAMPLE);
        assert_eq!(db.lookup("DL/HA5XYZ/P").unwrap().name, "Germany");
        assert_eq!(db.lookup("HA5XYZ/MM").unwrap().name, "Hungary");
    }

    #[test]
    fn placeholder_file_with_comments_loads() {
        let db = CtyDb::parse("# just a comment\n\n# another\n");
        assert!(db.is_empty());
    }
}
