//! Parser for `DX de …` spot lines.
//!
//! DXSpider / AR-Cluster deliver spots to a user terminal in a fixed-column but
//! not strictly delimited layout, e.g.
//!
//! ```text
//! DX de DL1ABC:     14195.0  EA8XYZ       Nice signal here             1234Z
//! DX de W3LPL-#:     7005.0  JA1ABC       CW  18 dB  24 WPM  CQ        1830Z FM19
//! ```
//!
//! The spotter ends in `:`; the frequency is in kHz; the DX call follows; then a
//! free-form comment; then a `HHMMZ` timestamp; then an optional Maidenhead
//! grid. The comment can contain anything (including colons and digits), so we
//! anchor on the trailing `\d{3,4}Z` token and treat everything between the DX
//! call and that token as the comment.

use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::band::{band_for_khz, guess_mode, Mode};

/// A parsed DX spot.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Spot {
    /// Spotter callsign exactly as sent (may carry a `-#` or `-7` suffix).
    pub spotter: String,
    /// Spotter callsign with any node/skimmer suffix stripped.
    pub spotter_base: String,
    /// Frequency in kHz.
    pub freq_khz: f64,
    /// Spotted DX callsign (upper-cased).
    pub dx_call: String,
    /// Free-form comment, trimmed.
    pub comment: String,
    /// `HHMM` UTC as sent by the node (no date — the caller adds one).
    pub time_hhmm: String,
    /// Maidenhead locator if the node appended one.
    pub grid: Option<String>,
    /// Band label (e.g. `"20m"`) if the frequency is in a known allocation.
    pub band: Option<String>,
    /// Coarse mode guess from frequency + comment.
    pub mode: Mode,
    /// True when the spot came from a CW/FT skimmer (`-#` suffix).
    pub is_skimmer: bool,
}

static SPOT_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?ix)
        ^DX\s+de\s+
        (?P<spotter>[A-Z0-9/\-\#]+?):\s+
        (?P<freq>\d{1,9}(?:\.\d{1,3})?)\s+
        (?P<dx>[A-Z0-9/]+)\s+
        (?P<comment>.*?)\s*
        (?P<time>\d{3,4})Z
        (?:\s+(?P<grid>[A-R]{2}\d{2}(?:[A-X]{2})?))?
        \s*$",
    )
    .expect("spot regex")
});

/// Strip a trailing `-#`, `-7`, `-11` … node/skimmer suffix from a callsign.
fn base_call(call: &str) -> &str {
    match call.rfind('-') {
        Some(idx) => &call[..idx],
        None => call,
    }
}

/// Try to parse a line as a DX spot. Returns `None` if it is not one.
pub fn parse_spot(line: &str) -> Option<Spot> {
    let caps = SPOT_RE.captures(line.trim())?;

    let spotter = caps["spotter"].to_ascii_uppercase();
    let freq_khz: f64 = caps["freq"].parse().ok()?;
    let dx_call = caps["dx"].to_ascii_uppercase();
    let comment = caps["comment"].trim().to_string();
    let grid = caps.name("grid").map(|m| m.as_str().to_ascii_uppercase());

    // Normalise a 3-digit "830" to "0830".
    let raw_time = &caps["time"];
    let time_hhmm = if raw_time.len() == 3 {
        format!("0{raw_time}")
    } else {
        raw_time.to_string()
    };

    let is_skimmer = spotter.ends_with("-#");
    let spotter_base = base_call(&spotter).to_string();

    Some(Spot {
        spotter_base,
        freq_khz,
        dx_call,
        band: band_for_khz(freq_khz).map(str::to_string),
        mode: guess_mode(freq_khz, &comment),
        grid,
        time_hhmm,
        is_skimmer,
        comment,
        spotter,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_ssb_spot() {
        let s = parse_spot(
            "DX de DL1ABC:     14195.0  EA8XYZ       Nice signal here             1234Z",
        )
        .expect("parsed");
        assert_eq!(s.spotter, "DL1ABC");
        assert_eq!(s.spotter_base, "DL1ABC");
        assert_eq!(s.freq_khz, 14195.0);
        assert_eq!(s.dx_call, "EA8XYZ");
        assert_eq!(s.comment, "Nice signal here");
        assert_eq!(s.time_hhmm, "1234");
        assert_eq!(s.band.as_deref(), Some("20m"));
        assert_eq!(s.mode, Mode::Ssb);
        assert!(!s.is_skimmer);
        assert_eq!(s.grid, None);
    }

    #[test]
    fn skimmer_spot_with_grid() {
        let s = parse_spot(
            "DX de W3LPL-#:     7005.0  JA1ABC       CW  18 dB  24 WPM  CQ        1830Z FM19",
        )
        .expect("parsed");
        assert_eq!(s.spotter, "W3LPL-#");
        assert_eq!(s.spotter_base, "W3LPL");
        assert!(s.is_skimmer);
        assert_eq!(s.dx_call, "JA1ABC");
        assert_eq!(s.comment, "CW  18 dB  24 WPM  CQ");
        assert_eq!(s.mode, Mode::Cw);
        assert_eq!(s.grid.as_deref(), Some("FM19"));
        assert_eq!(s.band.as_deref(), Some("40m"));
    }

    #[test]
    fn ft8_spot() {
        let s = parse_spot(
            "DX de EA4XYZ:      14074.0  VK9XYZ      FT8 -15dB                    0301Z",
        )
        .expect("parsed");
        assert_eq!(s.mode, Mode::Ft);
        assert_eq!(s.freq_khz, 14074.0);
        assert_eq!(s.time_hhmm, "0301");
    }

    #[test]
    fn portable_and_three_digit_time() {
        let s =
            parse_spot("DX de F5ABC/P:   3510.0  GB2XYZ/P   test                          830Z")
                .expect("parsed");
        assert_eq!(s.spotter, "F5ABC/P");
        assert_eq!(s.dx_call, "GB2XYZ/P");
        assert_eq!(s.time_hhmm, "0830");
        assert_eq!(s.band.as_deref(), Some("80m"));
    }

    #[test]
    fn empty_comment() {
        let s = parse_spot(
            "DX de OH2XYZ:     21260.0  3B8ABC                                    1500Z",
        )
        .expect("parsed");
        assert_eq!(s.comment, "");
        assert_eq!(s.dx_call, "3B8ABC");
    }

    #[test]
    fn real_dxspider_lines() {
        // Captured from hrd.wa9pie.net (BEL bytes already stripped by the decoder).
        let s = parse_spot(
            "DX de IT9ISA:     7163.0  IU0KNS       QSL QSO 73                     1519Z",
        )
        .expect("parsed");
        assert_eq!(s.spotter, "IT9ISA");
        assert_eq!(s.dx_call, "IU0KNS");
        assert_eq!(s.comment, "QSL QSO 73");
        assert_eq!(s.band.as_deref(), Some("40m"));

        let s = parse_spot(
            "DX de TF4WD:     14170.0  JL1GBE       USB IP05er -> PM86tf           1519Z",
        )
        .expect("parsed");
        assert_eq!(s.dx_call, "JL1GBE");
        assert_eq!(s.comment, "USB IP05er -> PM86tf");
        assert_eq!(s.mode, Mode::Ssb);
    }

    #[test]
    fn rejects_non_spot() {
        assert!(parse_spot("To ALL de G1ABC: hello there").is_none());
        assert!(parse_spot("login: ").is_none());
        assert!(parse_spot("").is_none());
    }
}
