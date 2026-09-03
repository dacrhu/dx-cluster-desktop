//! Parsers for the real-time WWV and WCY propagation broadcasts.
//!
//! ```text
//! WWV de AE5E <21>:   SFI=69, A=8, K=2, No Storms -> No Storms
//! WCY de DK0WCY-1 <11> : K=1 expK=0 A=4 R=0 SFI=94 SA=qui GMF=qui Au=no
//! ```

use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};

/// A WWV geomagnetic / solar broadcast.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Wwv {
    pub from: String,
    /// UTC hour the readings are for (0..23).
    pub hour: u8,
    /// Solar Flux Index.
    pub sfi: u16,
    /// A index.
    pub a: u16,
    /// K index.
    pub k: u16,
    /// Free-text forecast, e.g. `"No Storms -> No Storms"`.
    pub forecast: String,
}

/// A WCY broadcast (DK0WCY), a superset of WWV.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Wcy {
    pub from: String,
    pub hour: u8,
    pub k: u16,
    pub expk: u16,
    pub a: u16,
    /// Sunspot number (`R`).
    pub r: u16,
    pub sfi: u16,
    /// Solar activity, e.g. `qui`, `eru`.
    pub sa: String,
    /// Geomagnetic field, e.g. `qui`, `act`.
    pub gmf: String,
    /// Aurora, e.g. `no`, `yes`.
    pub aurora: String,
}

static WWV_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?ix)^WWV\s+de\s+(?P<from>\S+?)\s*<(?P<hour>\d{1,2})>\s*:?\s*
          SFI\s*=\s*(?P<sfi>\d+),?\s*
          A\s*=\s*(?P<a>\d+),?\s*
          K\s*=\s*(?P<k>\d+),?\s*
          (?P<forecast>.*)$",
    )
    .unwrap()
});

static WCY_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?ix)^WCY\s+de\s+(?P<from>\S+?)\s*<(?P<hour>\d{1,2})>\s*:?\s*
          K\s*=\s*(?P<k>\d+)\s+
          expK\s*=\s*(?P<expk>\d+)\s+
          A\s*=\s*(?P<a>\d+)\s+
          R\s*=\s*(?P<r>\d+)\s+
          SFI\s*=\s*(?P<sfi>\d+)\s+
          SA\s*=\s*(?P<sa>\S+)\s+
          GMF\s*=\s*(?P<gmf>\S+)\s+
          Au\s*=\s*(?P<au>\S+)",
    )
    .unwrap()
});

/// Parse a real-time `WWV de …` line.
pub fn parse_wwv(line: &str) -> Option<Wwv> {
    let c = WWV_RE.captures(line.trim())?;
    Some(Wwv {
        from: c["from"].to_ascii_uppercase(),
        hour: c["hour"].parse().ok()?,
        sfi: c["sfi"].parse().ok()?,
        a: c["a"].parse().ok()?,
        k: c["k"].parse().ok()?,
        forecast: c["forecast"].trim().to_string(),
    })
}

/// Parse a real-time `WCY de …` line.
pub fn parse_wcy(line: &str) -> Option<Wcy> {
    let c = WCY_RE.captures(line.trim())?;
    Some(Wcy {
        from: c["from"].to_ascii_uppercase(),
        hour: c["hour"].parse().ok()?,
        k: c["k"].parse().ok()?,
        expk: c["expk"].parse().ok()?,
        a: c["a"].parse().ok()?,
        r: c["r"].parse().ok()?,
        sfi: c["sfi"].parse().ok()?,
        sa: c["sa"].to_string(),
        gmf: c["gmf"].to_string(),
        aurora: c["au"].to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wwv_broadcast() {
        let w = parse_wwv("WWV de AE5E <21>:   SFI=69, A=8, K=2, No Storms -> No Storms").unwrap();
        assert_eq!(w.from, "AE5E");
        assert_eq!(w.hour, 21);
        assert_eq!(w.sfi, 69);
        assert_eq!(w.a, 8);
        assert_eq!(w.k, 2);
        assert_eq!(w.forecast, "No Storms -> No Storms");
    }

    #[test]
    fn wwv_without_commas() {
        let w = parse_wwv("WWV de W0MU <3>: SFI=107 A=15 K=3 No Storms -> No Storms").unwrap();
        assert_eq!(w.sfi, 107);
        assert_eq!(w.k, 3);
    }

    #[test]
    fn wcy_broadcast() {
        let w = parse_wcy("WCY de DK0WCY-1 <11> : K=1 expK=0 A=4 R=0 SFI=94 SA=qui GMF=qui Au=no")
            .unwrap();
        assert_eq!(w.from, "DK0WCY-1");
        assert_eq!(w.hour, 11);
        assert_eq!(w.k, 1);
        assert_eq!(w.expk, 0);
        assert_eq!(w.r, 0);
        assert_eq!(w.sfi, 94);
        assert_eq!(w.sa, "qui");
        assert_eq!(w.gmf, "qui");
        assert_eq!(w.aurora, "no");
    }

    #[test]
    fn rejects_other_lines() {
        assert!(parse_wwv("To ALL de G0ABC: hi").is_none());
        assert!(parse_wcy("DX de X: 14000 Y z 1200Z").is_none());
        assert!(parse_wwv("31-Aug-2026   15   107  15   2 No Storms").is_none());
    }
}
