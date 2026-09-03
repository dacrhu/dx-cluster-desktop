//! Parser for incoming talk messages.
//!
//! DXSpider delivers a talk message to the recipient as:
//!
//! ```text
//! G3XYZ de HA5XYZ: hello there
//! ```
//!
//! where the first call is the sender and the call after `de` is *you*. That
//! shape also matches ordinary node-to-node status chatter, so we only accept a
//! line as talk when the `de` target equals our own callsign.

use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};

/// A talk message addressed to us.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Talk {
    /// Who sent it.
    pub from: String,
    /// Who it was addressed to (our callsign).
    pub to: String,
    /// The message text.
    pub text: String,
}

static TALK_RE: Lazy<Regex> = Lazy::new(|| {
    // `from` must look like a callsign (contain a digit) so a chat group name
    // like `SYSOP` is not treated as a talk sender.
    Regex::new(
        r"(?i)^(?P<from>[A-Z0-9/-]*[0-9][A-Z0-9/-]*)\s+de\s+(?P<to>[A-Z0-9/-]{3,})\s*:\s?(?P<text>.*)$",
    )
    .unwrap()
});

/// Parse a line as a talk message addressed to `my_call`. Returns `None` if the
/// line is not a talk message or is addressed to someone else.
pub fn parse_talk(line: &str, my_call: &str) -> Option<Talk> {
    let c = TALK_RE.captures(line.trim())?;
    let to = c["to"].to_ascii_uppercase();
    if !to.eq_ignore_ascii_case(my_call.trim()) {
        return None;
    }
    let text = c["text"].trim();
    // A bare "X de Y:" with no text is a talk-mode entry notice, not a message.
    if text.is_empty() {
        return None;
    }
    Some(Talk {
        from: c["from"].to_ascii_uppercase(),
        to,
        text: text.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_talk_to_me() {
        let t = parse_talk("G3XYZ de HA5XYZ: hello there", "HA5XYZ").unwrap();
        assert_eq!(t.from, "G3XYZ");
        assert_eq!(t.to, "HA5XYZ");
        assert_eq!(t.text, "hello there");
    }

    #[test]
    fn case_insensitive_own_call() {
        assert!(parse_talk("g3xyz de ha5xyz: hi", "HA5XYZ").is_some());
    }

    #[test]
    fn rejects_talk_to_others() {
        assert!(parse_talk("W3LPL de GB7DJK: node status ok", "HA5XYZ").is_none());
    }

    #[test]
    fn rejects_non_talk() {
        assert!(parse_talk("DX de DL1ABC: 14195.0 EA8XYZ hi 1200Z", "HA5XYZ").is_none());
        assert!(parse_talk("To ALL de G1ABC: hello", "HA5XYZ").is_none());
        assert!(parse_talk("HA5XYZ de WA9PIE-2 31-Aug-2026 1640Z dxspider >", "HA5XYZ").is_none());
    }

    #[test]
    fn rejects_empty_talk_notice() {
        assert!(parse_talk("G3XYZ de HA5XYZ:", "HA5XYZ").is_none());
    }
}
