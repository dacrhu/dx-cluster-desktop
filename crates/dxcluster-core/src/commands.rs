//! Building outgoing cluster command strings from structured input, and the
//! [`SpotFilter`] type that the GUI filter builder produces.
//!
//! A `SpotFilter` can be turned into a DXSpider `accept/spot` / `reject/spot`
//! command *and* evaluated locally (for fields the node cannot filter on, or
//! when the user wants filtering without touching their node settings).

use serde::{Deserialize, Serialize};

use crate::band::{Mode, BANDS};
use crate::parser::Spot;
use crate::reference::CtyMatch;

/// Post a DX spot: `DX <freq_khz> <call> <comment>`.
pub fn dx_spot(freq_khz: f64, dx_call: &str, comment: &str) -> String {
    let comment = comment.trim();
    let call = dx_call.trim().to_ascii_uppercase();
    if comment.is_empty() {
        format!("DX {freq_khz:.1} {call}")
    } else {
        format!("DX {freq_khz:.1} {call} {comment}")
    }
}

/// Send a talk message: `TALK <call> <text>`.
pub fn talk(to: &str, text: &str) -> String {
    format!("TALK {} {}", to.trim().to_ascii_uppercase(), text.trim())
}

/// How to treat CW/FT skimmer (`-#`) spots — a local-only concern.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SkimmerPref {
    #[default]
    Include,
    Exclude,
    Only,
}

/// A single spot filter rule, as produced by the GUI builder.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct SpotFilter {
    pub action: FilterAction,
    /// Band labels, e.g. `["20m", "40m"]`.
    pub bands: Vec<String>,
    pub dx_call_prefixes: Vec<String>,
    pub spotter_call_prefixes: Vec<String>,
    /// DXCC primary prefixes for the spotted station.
    pub dx_dxcc: Vec<String>,
    /// DXCC primary prefixes for the spotter.
    pub spotter_dxcc: Vec<String>,
    pub dx_cq_zones: Vec<u8>,
    pub spotter_cq_zones: Vec<u8>,
    /// Continents (local-only), e.g. `["EU", "NA"]`.
    pub dx_continents: Vec<String>,
    /// Modes (local-only).
    pub modes: Vec<Mode>,
    /// Skimmer handling (local-only).
    pub skimmer: SkimmerPref,
}

/// Accept or reject; defaults to `Accept` for `#[serde(default)]` structs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FilterAction {
    #[default]
    Accept,
    Reject,
}

fn band_range_khz(label: &str) -> Option<(f64, f64)> {
    BANDS
        .iter()
        .find(|b| b.label == label)
        .map(|b| (b.low_khz, b.high_khz))
}

impl SpotFilter {
    fn verb(&self) -> &'static str {
        match self.action {
            FilterAction::Accept => "accept/spot",
            FilterAction::Reject => "reject/spot",
        }
    }

    /// Build a DXSpider filter command for the node-supported fields, or `None`
    /// if this rule only constrains local-only fields (continent / mode /
    /// skimmer).
    pub fn to_dxspider(&self) -> Option<String> {
        let mut conds: Vec<String> = Vec::new();

        if !self.bands.is_empty() {
            let ranges: Vec<String> = self
                .bands
                .iter()
                .filter_map(|b| band_range_khz(b))
                .map(|(lo, hi)| format!("{lo:.0}/{hi:.0}"))
                .collect();
            if !ranges.is_empty() {
                conds.push(format!("freq {}", ranges.join(",")));
            }
        }
        let list = |v: &[String]| v.join(",").to_ascii_uppercase();
        let zlist = |v: &[u8]| {
            v.iter()
                .map(|z| z.to_string())
                .collect::<Vec<_>>()
                .join(",")
        };

        if !self.dx_call_prefixes.is_empty() {
            conds.push(format!("call {}", list(&self.dx_call_prefixes)));
        }
        if !self.spotter_call_prefixes.is_empty() {
            conds.push(format!("by {}", list(&self.spotter_call_prefixes)));
        }
        if !self.dx_dxcc.is_empty() {
            conds.push(format!("call_dxcc {}", list(&self.dx_dxcc)));
        }
        if !self.spotter_dxcc.is_empty() {
            conds.push(format!("by_dxcc {}", list(&self.spotter_dxcc)));
        }
        if !self.dx_cq_zones.is_empty() {
            conds.push(format!("call_zone {}", zlist(&self.dx_cq_zones)));
        }
        if !self.spotter_cq_zones.is_empty() {
            conds.push(format!("by_zone {}", zlist(&self.spotter_cq_zones)));
        }

        if conds.is_empty() {
            return None;
        }
        Some(format!("{} {}", self.verb(), conds.join(" and ")))
    }

    /// Evaluate every condition (including local-only ones) against a spot.
    /// Returns whether the spot *satisfies the conditions*; the caller applies
    /// accept/reject semantics.
    ///
    /// `dx` / `spotter` are the resolved DXCC matches, when available.
    pub fn conditions_match(
        &self,
        spot: &Spot,
        dx: Option<&CtyMatch>,
        spotter: Option<&CtyMatch>,
    ) -> bool {
        match self.skimmer {
            SkimmerPref::Include => {}
            SkimmerPref::Exclude if spot.is_skimmer => return false,
            SkimmerPref::Only if !spot.is_skimmer => return false,
            _ => {}
        }

        if !self.bands.is_empty()
            && !spot
                .band
                .as_deref()
                .map(|b| self.bands.iter().any(|x| x == b))
                .unwrap_or(false)
        {
            return false;
        }
        if !self.modes.is_empty() && !self.modes.contains(&spot.mode) {
            return false;
        }
        if !self.dx_call_prefixes.is_empty()
            && !starts_with_any(&spot.dx_call, &self.dx_call_prefixes)
        {
            return false;
        }
        if !self.spotter_call_prefixes.is_empty()
            && !starts_with_any(&spot.spotter_base, &self.spotter_call_prefixes)
        {
            return false;
        }
        if !self.dx_dxcc.is_empty()
            && !dx
                .map(|m| eq_any(&m.primary_prefix, &self.dx_dxcc))
                .unwrap_or(false)
        {
            return false;
        }
        if !self.spotter_dxcc.is_empty()
            && !spotter
                .map(|m| eq_any(&m.primary_prefix, &self.spotter_dxcc))
                .unwrap_or(false)
        {
            return false;
        }
        if !self.dx_cq_zones.is_empty()
            && !dx
                .map(|m| self.dx_cq_zones.contains(&m.cq_zone))
                .unwrap_or(false)
        {
            return false;
        }
        if !self.spotter_cq_zones.is_empty()
            && !spotter
                .map(|m| self.spotter_cq_zones.contains(&m.cq_zone))
                .unwrap_or(false)
        {
            return false;
        }
        if !self.dx_continents.is_empty()
            && !dx
                .map(|m| eq_any(&m.continent, &self.dx_continents))
                .unwrap_or(false)
        {
            return false;
        }
        true
    }

    /// Should this spot be shown, given the rule? `Accept` shows matches,
    /// `Reject` hides them.
    pub fn allows(&self, spot: &Spot, dx: Option<&CtyMatch>, spotter: Option<&CtyMatch>) -> bool {
        let m = self.conditions_match(spot, dx, spotter);
        match self.action {
            FilterAction::Accept => m,
            FilterAction::Reject => !m,
        }
    }
}

fn starts_with_any(value: &str, prefixes: &[String]) -> bool {
    let v = value.to_ascii_uppercase();
    prefixes
        .iter()
        .any(|p| v.starts_with(&p.to_ascii_uppercase()))
}
fn eq_any(value: &str, options: &[String]) -> bool {
    let v = value.to_ascii_uppercase();
    options.iter().any(|o| o.to_ascii_uppercase() == v)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse_spot;

    fn spot(line: &str) -> Spot {
        parse_spot(line).expect("spot")
    }

    #[test]
    fn builds_dx_spot() {
        assert_eq!(
            dx_spot(14195.0, "ea8xyz", "  nice sig "),
            "DX 14195.0 EA8XYZ nice sig"
        );
        assert_eq!(dx_spot(7005.0, "JA1ABC", ""), "DX 7005.0 JA1ABC");
    }

    #[test]
    fn dxspider_command_from_bands_and_calls() {
        let f = SpotFilter {
            bands: vec!["20m".into(), "40m".into()],
            dx_dxcc: vec!["ha".into()],
            dx_cq_zones: vec![14, 15],
            ..Default::default()
        };
        assert_eq!(
            f.to_dxspider().unwrap(),
            "accept/spot freq 14000/14350,7000/7300 and call_dxcc HA and call_zone 14,15"
        );
    }

    #[test]
    fn local_only_filter_has_no_command() {
        let f = SpotFilter {
            dx_continents: vec!["EU".into()],
            skimmer: SkimmerPref::Exclude,
            ..Default::default()
        };
        assert!(f.to_dxspider().is_none());
    }

    #[test]
    fn local_matching() {
        let s = spot("DX de W3LPL-#:  14025.0  HA5XYZ  CW 20 dB  1200Z");
        let accept_20m = SpotFilter {
            bands: vec!["20m".into()],
            ..Default::default()
        };
        assert!(accept_20m.allows(&s, None, None));

        let reject_skimmer = SpotFilter {
            action: FilterAction::Reject,
            skimmer: SkimmerPref::Only,
            ..Default::default()
        };
        assert!(!reject_skimmer.allows(&s, None, None));

        let accept_cw = SpotFilter {
            modes: vec![Mode::Cw],
            ..Default::default()
        };
        assert!(accept_cw.allows(&s, None, None));
        let accept_ssb = SpotFilter {
            modes: vec![Mode::Ssb],
            ..Default::default()
        };
        assert!(!accept_ssb.allows(&s, None, None));
    }
}
