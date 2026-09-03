//! Parser for cluster announcements and weather (`WX`) broadcasts.
//!
//! ```text
//! To ALL de OH2BH: Test announcement
//! To LOCAL de G3XYZ: local net at 2000z
//! WX de DL1ABC: overcast, 12C, wind SW 15kmh
//! ```

use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};

/// A parsed announcement / weather line.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Announce {
    /// Who sent it.
    pub from: String,
    /// Target audience, e.g. `ALL`, `LOCAL`, or a sysop callsign. `WX` for
    /// weather broadcasts.
    pub to: String,
    /// The message text.
    pub text: String,
    /// True for `WX de …` weather broadcasts.
    pub is_wx: bool,
}

static ANNOUNCE_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)^To\s+(?P<to>[A-Z0-9/_-]+)\s+de\s+(?P<from>[A-Z0-9/_-]+)\s*:\s?(?P<text>.*)$")
        .unwrap()
});
static WX_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)^WX(?:\s+de)?\s+(?P<from>[A-Z0-9/_-]+)\s*:\s?(?P<text>.*)$").unwrap()
});

/// Try to parse a line as an announcement or `WX` broadcast.
pub fn parse_announce(line: &str) -> Option<Announce> {
    let line = line.trim();
    if let Some(c) = ANNOUNCE_RE.captures(line) {
        return Some(Announce {
            from: c["from"].to_ascii_uppercase(),
            to: c["to"].to_ascii_uppercase(),
            text: c["text"].trim().to_string(),
            is_wx: false,
        });
    }
    if let Some(c) = WX_RE.captures(line) {
        return Some(Announce {
            from: c["from"].to_ascii_uppercase(),
            to: "WX".to_string(),
            text: c["text"].trim().to_string(),
            is_wx: true,
        });
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_announcement() {
        let a = parse_announce("To ALL de OH2BH: Test announcement").unwrap();
        assert_eq!(a.from, "OH2BH");
        assert_eq!(a.to, "ALL");
        assert_eq!(a.text, "Test announcement");
        assert!(!a.is_wx);
    }

    #[test]
    fn local_target_and_colon_in_text() {
        let a = parse_announce("To LOCAL de G3XYZ: net at 20:00z tonight").unwrap();
        assert_eq!(a.to, "LOCAL");
        assert_eq!(a.text, "net at 20:00z tonight");
    }

    #[test]
    fn weather() {
        let a = parse_announce("WX de DL1ABC: overcast, 12C").unwrap();
        assert!(a.is_wx);
        assert_eq!(a.to, "WX");
        assert_eq!(a.from, "DL1ABC");
        assert_eq!(a.text, "overcast, 12C");
    }

    #[test]
    fn rejects_spots_and_prompts() {
        assert!(parse_announce("DX de DL1ABC: 14195.0 EA8XYZ hi 1200Z").is_none());
        assert!(parse_announce("HA5TEST de WA9PIE-2 dxspider >").is_none());
    }
}
