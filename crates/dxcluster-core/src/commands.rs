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

/// Post an announcement. `full` sends it to the whole cluster (`ANN/FULL`),
/// otherwise it stays on the local node (`ANN`).
pub fn announce(text: &str, full: bool) -> String {
    let verb = if full { "ANN/FULL" } else { "ANN" };
    format!("{verb} {}", text.trim())
}

/// Post a local weather report: `WX <text>`.
pub fn wx(text: &str) -> String {
    format!("WX {}", text.trim())
}

/// Join a chat / conference group.
pub fn join_group(group: &str) -> String {
    format!("JOIN {}", group.trim().to_ascii_uppercase())
}

/// Leave a chat / conference group.
pub fn leave_group(group: &str) -> String {
    format!("LEAVE {}", group.trim().to_ascii_uppercase())
}

/// Send a message to a chat group: `CHAT <group> <text>`.
pub fn chat(group: &str, text: &str) -> String {
    format!("CHAT {} {}", group.trim().to_ascii_uppercase(), text.trim())
}

/// Add a callsign to the buddy list.
pub fn set_buddy(call: &str) -> String {
    format!("SET/BUDDY {}", call.trim().to_ascii_uppercase())
}

// --- mail / bulletins -------------------------------------------------------

/// Which slice of the mailbox to list.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum DirScope {
    /// `DIRECTORY <n>` — last n messages (0 = plain `DIRECTORY`).
    Last { count: u32 },
    /// `DIRECTORY OWN`.
    Own,
    /// `DIRECTORY NEW`.
    New,
    /// `DIRECTORY ALL <n>`.
    All { count: u32 },
    /// `DIRECTORY TO <call>`.
    To { call: String },
    /// `DIRECTORY FROM <call>`.
    From { call: String },
    /// `DIRECTORY SUBJECT <text>`.
    Subject { text: String },
}

/// Build a `DIRECTORY` command for the given scope.
pub fn directory(scope: &DirScope) -> String {
    match scope {
        DirScope::Last { count: 0 } => "DIRECTORY".to_string(),
        DirScope::Last { count } => format!("DIRECTORY {count}"),
        DirScope::Own => "DIRECTORY OWN".to_string(),
        DirScope::New => "DIRECTORY NEW".to_string(),
        DirScope::All { count } => format!("DIRECTORY ALL {count}"),
        DirScope::To { call } => format!("DIRECTORY TO {}", call.trim().to_ascii_uppercase()),
        DirScope::From { call } => format!("DIRECTORY FROM {}", call.trim().to_ascii_uppercase()),
        DirScope::Subject { text } => format!("DIRECTORY SUBJECT {}", text.trim()),
    }
}

/// Read a message: `READ <msgno>`.
pub fn read_msg(msgno: u32) -> String {
    format!("READ {msgno}")
}

/// Delete a message: `DELETE <msgno>`.
pub fn delete_msg(msgno: u32) -> String {
    format!("DELETE {msgno}")
}

/// The opening command of a compose sequence (subject + body + `/EX` follow,
/// driven by the connection layer).
pub fn send_mail_open(to: &str, private: bool) -> String {
    let to = to.trim().to_ascii_uppercase();
    if private {
        format!("SP {to}")
    } else {
        // Bulletin — `SB <category>` (SEND NOPRIVATE).
        format!("SB {to}")
    }
}

/// Reply to a message: `REPLY <msgno>` (subject/body follow like a new send).
pub fn reply_open(msgno: u32) -> String {
    format!("REPLY {msgno}")
}

// --- SH/DX query ----------------------------------------------------------

/// Options for a `SH/DX` historical spot query.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct DxQuery {
    /// Number of rows to return.
    pub count: Option<u32>,
    /// Band label, e.g. `"20m"`.
    pub band: Option<String>,
    /// DX callsign / prefix filter.
    pub call: Option<String>,
    /// Spotter callsign / prefix filter.
    pub by: Option<String>,
    /// Only spots from the last N hours.
    pub hours: Option<u32>,
}

/// Build a `SH/DX` command from the query options.
pub fn sh_dx(q: &DxQuery) -> String {
    let mut out = String::from("SH/DX");
    if let Some(n) = q.count {
        out.push_str(&format!(" {n}"));
    }
    if let Some(b) = q.band.as_deref().filter(|s| !s.is_empty()) {
        out.push_str(&format!(" on {b}"));
    }
    if let Some(c) = q.call.as_deref().filter(|s| !s.is_empty()) {
        out.push_str(&format!(" {}", c.to_ascii_uppercase()));
    }
    if let Some(by) = q.by.as_deref().filter(|s| !s.is_empty()) {
        out.push_str(&format!(" by {}", by.to_ascii_uppercase()));
    }
    if let Some(h) = q.hours {
        out.push_str(&format!(" {h} hours"));
    }
    out
}

/// Remove a callsign from the buddy list.
pub fn unset_buddy(call: &str) -> String {
    format!("UNSET/BUDDY {}", call.trim().to_ascii_uppercase())
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
    /// Continents of the spotted station (local-only), e.g. `["EU", "NA"]`.
    pub dx_continents: Vec<String>,
    /// Continents of the spotter (local-only).
    #[serde(default)]
    pub spotter_continents: Vec<String>,
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
        if !self.spotter_continents.is_empty()
            && !spotter
                .map(|m| eq_any(&m.continent, &self.spotter_continents))
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
    fn builds_announce_wx_talk() {
        assert_eq!(announce("net at 2000z", false), "ANN net at 2000z");
        assert_eq!(announce(" pileup on 20m ", true), "ANN/FULL pileup on 20m");
        assert_eq!(wx("sunny 20C"), "WX sunny 20C");
        assert_eq!(talk("ha5xyz", " hi "), "TALK HA5XYZ hi");
        assert_eq!(set_buddy("g3xyz"), "SET/BUDDY G3XYZ");
        assert_eq!(unset_buddy(" g3xyz "), "UNSET/BUDDY G3XYZ");
        assert_eq!(join_group("foc"), "JOIN FOC");
        assert_eq!(leave_group("#9000"), "LEAVE #9000");
        assert_eq!(chat("foc", " hi all "), "CHAT FOC hi all");
    }

    #[test]
    fn builds_mail_commands() {
        assert_eq!(directory(&DirScope::Last { count: 0 }), "DIRECTORY");
        assert_eq!(directory(&DirScope::Last { count: 20 }), "DIRECTORY 20");
        assert_eq!(directory(&DirScope::New), "DIRECTORY NEW");
        assert_eq!(
            directory(&DirScope::To {
                call: "g1tlh".into()
            }),
            "DIRECTORY TO G1TLH"
        );
        assert_eq!(
            directory(&DirScope::Subject {
                text: " IOTA ".into()
            }),
            "DIRECTORY SUBJECT IOTA"
        );
        assert_eq!(read_msg(42), "READ 42");
        assert_eq!(delete_msg(42), "DELETE 42");
        assert_eq!(send_mail_open("g1tlh", true), "SP G1TLH");
        assert_eq!(send_mail_open("all", false), "SB ALL");
        assert_eq!(reply_open(42), "REPLY 42");
    }

    #[test]
    fn builds_sh_dx() {
        assert_eq!(sh_dx(&DxQuery::default()), "SH/DX");
        assert_eq!(
            sh_dx(&DxQuery {
                count: Some(20),
                ..Default::default()
            }),
            "SH/DX 20"
        );
        assert_eq!(
            sh_dx(&DxQuery {
                count: Some(10),
                band: Some("20m".into()),
                call: Some("ha".into()),
                by: Some("w3lpl".into()),
                hours: Some(6),
            }),
            "SH/DX 10 on 20m HA by W3LPL 6 hours"
        );
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

    #[test]
    fn spotter_continent_is_local_only() {
        let cty = |cont: &str| CtyMatch {
            name: "x".into(),
            primary_prefix: "X".into(),
            continent: cont.into(),
            cq_zone: 5,
            itu_zone: 8,
            lat: 0.0,
            lon: 0.0,
        };
        let s = spot("DX de W1NT-#:  14025.0  HA5XYZ  CW 20 dB  1200Z");
        let f = SpotFilter {
            spotter_continents: vec!["EU".into()],
            ..Default::default()
        };
        // Local-only — never becomes a node command.
        assert!(f.to_dxspider().is_none());
        // A North-American spotter is rejected, a European one accepted.
        assert!(!f.allows(&s, None, Some(&cty("NA"))));
        assert!(f.allows(&s, None, Some(&cty("EU"))));
    }
}
