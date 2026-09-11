//! Building outgoing cluster command strings from structured input, and the
//! [`SpotFilter`] type that the GUI filter builder produces.
//!
//! A `SpotFilter` can be turned into a DXSpider `accept/spot` / `reject/spot`
//! command *and* evaluated locally (for fields the node cannot filter on, or
//! when the user wants filtering without touching their node settings).

use serde::{Deserialize, Serialize};

use crate::band::{Mode, BANDS};
use crate::connection::NodeSoftware;
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

/// Build a `SH/DX` historical-spot query in the target node's dialect.
pub fn sh_dx(q: &DxQuery, software: NodeSoftware) -> String {
    match software {
        NodeSoftware::DxSpider => sh_dx_dxspider(q),
        NodeSoftware::ArCluster => sh_dx_arcluster(q),
    }
}

/// DXSpider `SH/DX` — positional: `SH/DX <n> on <band> <call> by <spotter> <h> hours`.
fn sh_dx_dxspider(q: &DxQuery) -> String {
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

/// AR-Cluster V6 — `SHOW/DX/<n>` with `field=value` conditions joined by `and`
/// (`show/dx/25 call=HA and band=20 and spotter=W3LPL`). The `hours` window has
/// no simple equivalent (AR takes an absolute `dts>` timestamp), so it's
/// dropped — the row count already bounds the result. Historical-row output is
/// the common AK1A layout, so `parser::show::parse_sh_dx` handles both dialects.
fn sh_dx_arcluster(q: &DxQuery) -> String {
    let mut cmd = String::from("show/dx");
    if let Some(n) = q.count {
        cmd.push_str(&format!("/{n}"));
    }
    let mut conds: Vec<String> = Vec::new();
    if let Some(m) = q.band.as_deref().and_then(band_meters) {
        conds.push(format!("band={m}"));
    }
    if let Some(c) = q.call.as_deref().filter(|s| !s.is_empty()) {
        conds.push(format!("call={}", c.to_ascii_uppercase()));
    }
    if let Some(by) = q.by.as_deref().filter(|s| !s.is_empty()) {
        conds.push(format!("spotter={}", by.to_ascii_uppercase()));
    }
    if !conds.is_empty() {
        cmd.push(' ');
        cmd.push_str(&conds.join(" and "));
    }
    cmd
}

/// Remove a callsign from the buddy list.
pub fn unset_buddy(call: &str) -> String {
    format!("UNSET/BUDDY {}", call.trim().to_ascii_uppercase())
}

/// Ask the node to start/stop relaying skimmer (RBN-sourced) spots to us.
/// DXSpider only — verified command pair `SET/SKIMMER` / `UNSET/SKIMMER`.
/// Callers are expected to gate this on `NodeSoftware::DxSpider` themselves
/// (see `skimmer_command` in the Tauri layer and `NodeProfile::skimmer`).
pub fn set_skimmer(enabled: bool) -> &'static str {
    if enabled {
        "SET/SKIMMER"
    } else {
        "UNSET/SKIMMER"
    }
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

/// A band label's plain integer meters (`"20m"` -> `20`), for AR-Cluster's
/// `Band=<meters>` filter field. `None` for labels that aren't a bare integer
/// of meters (`"1.25m"`, any `"...cm"` VHF/UHF band) — AR-Cluster's
/// documented examples only cover HF-style meter bands.
fn band_meters(label: &str) -> Option<u32> {
    label.strip_suffix('m').and_then(|n| n.parse().ok())
}

/// `field=A*` / `field=B*` … for each prefix (wildcarded so it matches a
/// callsign starting with it, not just an exact one).
fn prefix_terms(field: &str, prefixes: &[String]) -> Vec<String> {
    prefixes
        .iter()
        .map(|p| format!("{field}={}*", p.to_ascii_uppercase()))
        .collect()
}

/// `field=A` / `field=B` … for each exact value.
fn eq_terms(field: &str, values: &[String]) -> Vec<String> {
    values
        .iter()
        .map(|v| format!("{field}={}", v.to_ascii_uppercase()))
        .collect()
}

/// `field=1` / `field=2` … for each zone number.
fn zone_terms(field: &str, zones: &[u8]) -> Vec<String> {
    zones.iter().map(|z| format!("{field}={z}")).collect()
}

/// Join alternatives with `or`, parenthesized once there's more than one term
/// (a lone term needs no grouping).
fn or_group(terms: &[String]) -> String {
    match terms {
        [one] => one.clone(),
        many => format!("({})", many.join(" or ")),
    }
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

    /// Build the node-push command for this rule in a profile's dialect, or
    /// `None` if it only constrains local-only fields — see `to_dxspider`
    /// and `to_arcluster`.
    pub fn to_command(&self, software: NodeSoftware) -> Option<String> {
        match software {
            NodeSoftware::DxSpider => self.to_dxspider(),
            NodeSoftware::ArCluster => self.to_arcluster(),
        }
    }

    /// Build an AR-Cluster `SET/DX/FILTER <expr>` command for the same
    /// node-supported fields as `to_dxspider` (bands, call/spotter prefixes,
    /// DX/spotter DXCC, DX/spotter CQ zone), or `None` if the rule only
    /// constrains local-only fields (continent / mode / skimmer — AR-Cluster
    /// *can* filter on `Cont` and `Skimmer` too, but those stay local-only
    /// here to match `to_dxspider`'s scope).
    ///
    /// AR-Cluster keeps exactly one active filter per session — there's no
    /// numbered-slot chaining like DXSpider's `accept/spot N` — so, like
    /// `to_dxspider`, applying a second rule replaces the filter rather than
    /// adding to it; `FiltersPanel`'s per-rule "apply to node" button already
    /// treats each push as a single overwrite, so this needs no special
    /// handling on the frontend side. A `Reject` rule wraps the whole
    /// expression in `not (...)` — the parens are mandatory because `not`
    /// binds tighter than `or` (manual, "Compound Filters": `and` before
    /// `or`, left to right; `NOT Skimmer or (...)` parses as `(NOT Skimmer)
    /// or (...)`).
    ///
    /// Built to the AR-Cluster V6 Telnet User Manual ("DX Spots" / "Set DX
    /// Filter"). **Verified against the manual** (field names in the DX Filter
    /// field table, `=`, `and`/`or`, parentheses grouping, empty `set/dx/filter`
    /// to clear, `Band=<meters>` e.g. `Band=20`, `Cty`/`SpotterCty` take a
    /// cty.dat prefix token like `Cty=JA` / `SpotterCty=K`). **Still unverified
    /// on a live node** (only `show/dx options` readback was exercised on V6
    /// 6.1.5123): whether a trailing `*` does a prefix match on `Call=` /
    /// `Spotter=` — the manual only documents `*` for `Comment`
    /// (`comment=*iota*`) and shows `Call <> *BUST*` (infix). An exact call/
    /// spotter (no trailing wildcard) would be `Call=EXACT`.
    pub fn to_arcluster(&self) -> Option<String> {
        let mut conds: Vec<String> = Vec::new();

        if !self.bands.is_empty() {
            let terms: Vec<String> = self
                .bands
                .iter()
                .filter_map(|b| band_meters(b))
                .map(|m| format!("Band={m}"))
                .collect();
            if !terms.is_empty() {
                conds.push(or_group(&terms));
            }
        }
        if !self.dx_call_prefixes.is_empty() {
            conds.push(or_group(&prefix_terms("Call", &self.dx_call_prefixes)));
        }
        if !self.spotter_call_prefixes.is_empty() {
            conds.push(or_group(&prefix_terms(
                "Spotter",
                &self.spotter_call_prefixes,
            )));
        }
        if !self.dx_dxcc.is_empty() {
            conds.push(or_group(&eq_terms("Cty", &self.dx_dxcc)));
        }
        if !self.spotter_dxcc.is_empty() {
            conds.push(or_group(&eq_terms("SpotterCty", &self.spotter_dxcc)));
        }
        if !self.dx_cq_zones.is_empty() {
            conds.push(or_group(&zone_terms("CqZone", &self.dx_cq_zones)));
        }
        if !self.spotter_cq_zones.is_empty() {
            conds.push(or_group(&zone_terms(
                "SpotterCqZone",
                &self.spotter_cq_zones,
            )));
        }

        if conds.is_empty() {
            return None;
        }
        let expr = conds.join(" and ");
        let expr = match self.action {
            FilterAction::Accept => expr,
            // `not` needs the whole expression parenthesised, but a single
            // `or`-group condition is already wrapped — reuse its parens
            // instead of emitting `not ((A or B))`.
            FilterAction::Reject if conds.len() == 1 && expr.starts_with('(') => {
                format!("not {expr}")
            }
            FilterAction::Reject => format!("not ({expr})"),
        };
        Some(format!("set/dx/filter {expr}"))
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
        assert_eq!(set_skimmer(true), "SET/SKIMMER");
        assert_eq!(set_skimmer(false), "UNSET/SKIMMER");
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
        use NodeSoftware::*;
        assert_eq!(sh_dx(&DxQuery::default(), DxSpider), "SH/DX");
        assert_eq!(
            sh_dx(
                &DxQuery {
                    count: Some(20),
                    ..Default::default()
                },
                DxSpider
            ),
            "SH/DX 20"
        );
        let full = DxQuery {
            count: Some(10),
            band: Some("20m".into()),
            call: Some("ha".into()),
            by: Some("w3lpl".into()),
            hours: Some(6),
        };
        assert_eq!(
            sh_dx(&full, DxSpider),
            "SH/DX 10 on 20m HA by W3LPL 6 hours"
        );
        // AR-Cluster: `show/dx/<n> field=value and …`, hours dropped.
        assert_eq!(
            sh_dx(&full, ArCluster),
            "show/dx/10 band=20 and call=HA and spotter=W3LPL"
        );
        assert_eq!(sh_dx(&DxQuery::default(), ArCluster), "show/dx");
        assert_eq!(
            sh_dx(
                &DxQuery {
                    count: Some(30),
                    call: Some("p5".into()),
                    ..Default::default()
                },
                ArCluster
            ),
            "show/dx/30 call=P5"
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
        assert!(f.to_arcluster().is_none());
        assert!(f.to_command(NodeSoftware::ArCluster).is_none());
    }

    #[test]
    fn arcluster_command_from_bands_and_calls() {
        let f = SpotFilter {
            bands: vec!["20m".into(), "40m".into()],
            dx_dxcc: vec!["ha".into()],
            dx_cq_zones: vec![14, 15],
            ..Default::default()
        };
        assert_eq!(
            f.to_arcluster().unwrap(),
            "set/dx/filter (Band=20 or Band=40) and Cty=HA and (CqZone=14 or CqZone=15)"
        );
        assert_eq!(f.to_command(NodeSoftware::ArCluster), f.to_arcluster());
        assert_eq!(f.to_command(NodeSoftware::DxSpider), f.to_dxspider());
    }

    #[test]
    fn arcluster_single_prefix_and_reject() {
        let accept = SpotFilter {
            dx_call_prefixes: vec!["p5".into()],
            ..Default::default()
        };
        assert_eq!(accept.to_arcluster().unwrap(), "set/dx/filter Call=P5*");

        // Single `or`-group reject: reuse the group's parens, don't double them.
        let reject = SpotFilter {
            action: FilterAction::Reject,
            spotter_call_prefixes: vec!["w3lpl".into(), "k1ttt".into()],
            ..Default::default()
        };
        assert_eq!(
            reject.to_arcluster().unwrap(),
            "set/dx/filter not (Spotter=W3LPL* or Spotter=K1TTT*)"
        );

        // Single bare-term reject still gets one wrapping pair (harmless, and
        // keeps `not` scoped explicitly).
        let reject_one = SpotFilter {
            action: FilterAction::Reject,
            dx_dxcc: vec!["k".into()],
            ..Default::default()
        };
        assert_eq!(
            reject_one.to_arcluster().unwrap(),
            "set/dx/filter not (Cty=K)"
        );
    }

    #[test]
    fn arcluster_reject_multiple_conditions() {
        // Reject spots that are (20m or 40m) AND from a P5* call — the whole
        // conjunction must sit inside `not (...)`.
        let f = SpotFilter {
            action: FilterAction::Reject,
            bands: vec!["20m".into(), "40m".into()],
            dx_call_prefixes: vec!["p5".into()],
            ..Default::default()
        };
        assert_eq!(
            f.to_arcluster().unwrap(),
            "set/dx/filter not ((Band=20 or Band=40) and Call=P5*)"
        );
    }

    #[test]
    fn arcluster_combines_two_or_groups_with_zone() {
        let f = SpotFilter {
            dx_call_prefixes: vec!["p5".into(), "p6".into()],
            spotter_cq_zones: vec![14, 15],
            ..Default::default()
        };
        assert_eq!(
            f.to_arcluster().unwrap(),
            "set/dx/filter (Call=P5* or Call=P6*) and (SpotterCqZone=14 or SpotterCqZone=15)"
        );
    }

    #[test]
    fn arcluster_ignores_unmappable_bands() {
        // "1.25m" and any "...cm" VHF/UHF label have no AR-Cluster `Band=`
        // equivalent in the documented examples — dropped, like a DXSpider
        // rule with no matching `BANDS` entry.
        let f = SpotFilter {
            bands: vec!["1.25m".into(), "70cm".into()],
            spotter_dxcc: vec!["k".into()],
            ..Default::default()
        };
        assert_eq!(f.to_arcluster().unwrap(), "set/dx/filter SpotterCty=K");
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
