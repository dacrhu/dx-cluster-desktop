//! Parsers for `SHOW` command responses (the tabular / log-style output a node
//! sends when you ask for history).
//!
//! Phase 2 covers `SH/ANN` (announcement log). `SH/DX`, `SH/WWV`, `SH/WCY`,
//! `SH/USERS` … land in later phases alongside their panels.

use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};

use super::Announce;
use crate::band::{band_for_khz, guess_mode, Mode};

/// One row of `SH/ANN` output, with the node-supplied timestamp resolved to
/// unix seconds (UTC).
#[derive(Debug, Clone, PartialEq)]
pub struct HistoricAnnounce {
    /// Unix seconds (UTC) the announcement was originally made.
    pub at: i64,
    pub announce: Announce,
}

// `27Aug2026@00:04:16 F4LRR-15 -> LOCAL announce/full text here`
static SH_ANN_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?x)^
        (?P<day>\d{1,2})(?P<mon>[A-Za-z]{3})(?P<year>\d{4})@
        (?P<h>\d{2}):(?P<m>\d{2}):(?P<s>\d{2})\s+
        (?P<from>[A-Z0-9/_-]+)\s+->\s+(?P<to>[A-Z0-9/_-]+)\s+
        (?P<text>.*)$",
    )
    .unwrap()
});

fn month_num(mon: &str) -> Option<u32> {
    match mon.to_ascii_lowercase().as_str() {
        "jan" => Some(1),
        "feb" => Some(2),
        "mar" => Some(3),
        "apr" => Some(4),
        "may" => Some(5),
        "jun" => Some(6),
        "jul" => Some(7),
        "aug" => Some(8),
        "sep" => Some(9),
        "oct" => Some(10),
        "nov" => Some(11),
        "dec" => Some(12),
        _ => None,
    }
}

/// Parse one line of `SH/ANN` output. Returns `None` for headers / blank lines /
/// the trailing prompt.
pub fn parse_sh_announce(line: &str) -> Option<HistoricAnnounce> {
    let c = SH_ANN_RE.captures(line.trim())?;
    let mon = month_num(&c["mon"])?;
    let day: u32 = c["day"].parse().ok()?;
    let year: i32 = c["year"].parse().ok()?;
    let (h, m, s): (u32, u32, u32) = (
        c["h"].parse().ok()?,
        c["m"].parse().ok()?,
        c["s"].parse().ok()?,
    );

    let at = chrono::NaiveDate::from_ymd_opt(year, mon, day)?
        .and_hms_opt(h, m, s)?
        .and_utc()
        .timestamp();

    let to = c["to"].to_ascii_uppercase();
    Some(HistoricAnnounce {
        at,
        announce: Announce {
            from: c["from"].to_ascii_uppercase(),
            is_wx: to == "WX",
            to,
            text: c["text"].trim().to_string(),
        },
    })
}

/// One row of `SH/CHAT` output. `SH/CHAT` uses the same on-the-wire format as
/// `SH/ANN`, with the target being a chat group.
#[derive(Debug, Clone, PartialEq)]
pub struct HistoricChat {
    pub at: i64,
    pub group: String,
    pub from: String,
    pub text: String,
}

/// Parse one line of `SH/CHAT` output.
pub fn parse_sh_chat(line: &str) -> Option<HistoricChat> {
    let h = parse_sh_announce(line)?;
    Some(HistoricChat {
        at: h.at,
        group: h.announce.to,
        from: h.announce.from,
        text: h.announce.text,
    })
}

// --- SH/DX and SH/DXCC -----------------------------------------------------

/// One row of a `SH/DX` (or `SH/DXCC`) historical spot listing.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HistSpot {
    pub freq_khz: f64,
    pub dx_call: String,
    /// Date as printed, e.g. `31-Aug-2026`.
    pub date: String,
    /// `HHMM` UTC.
    pub time: String,
    pub comment: String,
    pub spotter: String,
    pub band: Option<String>,
    pub mode: Mode,
}

// `  14180.0 5Z4VJ       31-Aug-2026 1911Z thanks 73 Andy<IK8FNW>`
static SH_DX_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?x)^\s*
        (?P<freq>\d{1,9}\.\d{1,2})\s+
        (?P<dx>[A-Z0-9/]+)\s+
        (?P<date>\d{1,2}-[A-Za-z]{3}-\d{4})\s+
        (?P<time>\d{3,4})Z\s+
        (?P<comment>.*?)\s*
        <(?P<spotter>[A-Z0-9/\#-]+)>\s*$",
    )
    .unwrap()
});

/// Parse one `SH/DX` / `SH/DXCC` row.
pub fn parse_sh_dx_line(line: &str) -> Option<HistSpot> {
    let c = SH_DX_RE.captures(line.trim())?;
    let freq_khz: f64 = c["freq"].parse().ok()?;
    let comment = c["comment"].trim().to_string();
    let raw_time = &c["time"];
    let time = if raw_time.len() == 3 {
        format!("0{raw_time}")
    } else {
        raw_time.to_string()
    };
    Some(HistSpot {
        band: band_for_khz(freq_khz).map(str::to_string),
        mode: guess_mode(freq_khz, &comment),
        freq_khz,
        dx_call: c["dx"].to_ascii_uppercase(),
        date: c["date"].to_string(),
        time,
        spotter: c["spotter"].to_ascii_uppercase(),
        comment,
    })
}

/// Parse a whole `SH/DX` / `SH/DXCC` response.
pub fn parse_sh_dx(lines: &[String]) -> Vec<HistSpot> {
    lines.iter().filter_map(|l| parse_sh_dx_line(l)).collect()
}

// --- SH/USERS ---------------------------------------------------------------

static CALLSIGN_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^[A-Z0-9]{1,3}[0-9][A-Z0-9]*(?:-\d{1,2})?(?:/[A-Z0-9]+)?$").unwrap());

/// Parse `SH/USERS` output (a header line then a grid of callsigns) into a
/// sorted, de-duplicated list of connected callsigns.
pub fn parse_sh_users(lines: &[String]) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for line in lines {
        let l = line.trim();
        if l.is_empty()
            || l.to_ascii_lowercase().contains("callsigns connected")
            || l.contains(" de ")
        {
            continue;
        }
        for tok in l.split_whitespace() {
            let t = tok.to_ascii_uppercase();
            if CALLSIGN_RE.is_match(&t) && !out.contains(&t) {
                out.push(t);
            }
        }
    }
    out.sort();
    out
}

// --- SH/STATION ------------------------------------------------------------

/// Information about a station from `SH/STATION <call>`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StationInfo {
    /// Callsign the query was about (from the `User :` line).
    pub call: String,
    /// All `Key : Value` fields, in the order the node sent them.
    pub fields: Vec<(String, String)>,
}

impl StationInfo {
    /// Look up a field by (case-insensitive) key prefix.
    pub fn field(&self, key: &str) -> Option<&str> {
        self.fields
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(key))
            .map(|(_, v)| v.as_str())
    }
}

static KV_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^(?P<key>[A-Za-z][A-Za-z /]+?)\s*:\s(?P<val>.+)$").unwrap());

/// Parse `SH/STATION` key/value output. Returns `None` if no fields were found.
pub fn parse_sh_station(lines: &[String]) -> Option<StationInfo> {
    let mut fields: Vec<(String, String)> = Vec::new();
    for line in lines {
        let l = line.trim_end();
        let low = l.to_ascii_lowercase();
        if low.starts_with("dx de ") || (l.contains(" de ") && l.ends_with('>')) {
            continue; // spot / node prompt bleeding into the response
        }
        if let Some(c) = KV_RE.captures(l.trim()) {
            fields.push((c["key"].trim().to_string(), c["val"].trim().to_string()));
        }
    }
    if fields.is_empty() {
        return None;
    }
    // "User : W3LPL (at W3LPL)" -> call = W3LPL
    let call = fields
        .iter()
        .find(|(k, _)| k.eq_ignore_ascii_case("User"))
        .map(|(_, v)| v.split_whitespace().next().unwrap_or(v).to_string())
        .unwrap_or_default();
    Some(StationInfo { call, fields })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_sh_ann_row() {
        let h = parse_sh_announce(
            "27Aug2026@13:45:37 F4LRR-15 -> LOCAL announce/full RI1JFL mic broken?",
        )
        .unwrap();
        assert_eq!(h.announce.from, "F4LRR-15");
        assert_eq!(h.announce.to, "LOCAL");
        assert_eq!(h.announce.text, "announce/full RI1JFL mic broken?");
        // 2026-08-27 13:45:37 UTC
        assert_eq!(h.at, 1_787_838_337);
    }

    #[test]
    fn parses_single_digit_day() {
        let h = parse_sh_announce("3Sep2026@00:00:01 EA5GGU -> ALL FT8 40m").unwrap();
        assert_eq!(h.announce.to, "ALL");
        assert!(h.at > 0);
    }

    #[test]
    fn rejects_headers_and_prompt() {
        assert!(parse_sh_announce("HA5TEST de WA9PIE-2 31-Aug-2026 1633Z dxspider >").is_none());
        assert!(parse_sh_announce("Unknown command").is_none());
        assert!(parse_sh_announce("").is_none());
    }

    #[test]
    fn parses_sh_users_grid() {
        let lines: Vec<String> = [
            "Callsigns connected to WA9PIE-2",
            "2E0ACE-6     2I0WAI-10    W3LPL        AA1BS        4X1HF-11",
            "9A1Z-14      DK0WCY-1     A41CK",
            "HA5TEST de WA9PIE-2 31-Aug-2026 1640Z dxspider >",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect();
        let users = parse_sh_users(&lines);
        assert!(users.contains(&"W3LPL".to_string()));
        assert!(users.contains(&"2E0ACE-6".to_string()));
        assert!(users.contains(&"4X1HF-11".to_string()));
        assert!(!users.iter().any(|u| u.contains("WA9PIE")));
        assert_eq!(users.len(), 8);
    }

    #[test]
    fn parses_sh_station_fields() {
        let lines: Vec<String> = [
            "User         : W3LPL (at W3LPL)",
            "Name         : Frank",
            "Last connect : 28-Aug-2026 2005Z",
            "QTH          : Glenwood MD",
            "Location     : 39 16 N 77 2 W (FM19LG)",
            "Heading      : 64 Deg. 1172 Mi. 1886 Km.",
            "Home Node    : W3LPL",
            "HA5TEST de WA9PIE-2 31-Aug-2026 1640Z dxspider >",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect();
        let st = parse_sh_station(&lines).unwrap();
        assert_eq!(st.call, "W3LPL");
        assert_eq!(st.field("Name"), Some("Frank"));
        assert_eq!(st.field("QTH"), Some("Glenwood MD"));
        assert_eq!(st.field("Home Node"), Some("W3LPL"));
        assert_eq!(st.fields.len(), 7);
    }

    #[test]
    fn sh_station_empty_when_no_kv() {
        let lines = vec!["Sorry, no info".to_string()];
        assert!(parse_sh_station(&lines).is_none());
    }

    #[test]
    fn parses_sh_dx_rows() {
        let a = parse_sh_dx_line(
            "  18073.0 W1AW/2      31-Aug-2026 1912Z                       <W2XS>",
        )
        .unwrap();
        assert_eq!(a.freq_khz, 18073.0);
        assert_eq!(a.dx_call, "W1AW/2");
        assert_eq!(a.comment, "");
        assert_eq!(a.spotter, "W2XS");
        assert_eq!(a.band.as_deref(), Some("17m"));

        // comment running straight into <spotter>
        let b = parse_sh_dx_line("  14180.0 5Z4VJ       31-Aug-2026 1911Z thanks 73 Andy<IK8FNW>")
            .unwrap();
        assert_eq!(b.comment, "thanks 73 Andy");
        assert_eq!(b.spotter, "IK8FNW");
        assert_eq!(b.time, "1911");
        assert_eq!(b.band.as_deref(), Some("20m"));

        assert!(parse_sh_dx_line("HA5TEST de WA9PIE-2 31-Aug-2026 1912Z dxspider >").is_none());
    }
}
