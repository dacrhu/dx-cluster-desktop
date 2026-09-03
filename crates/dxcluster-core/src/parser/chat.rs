//! Parser for incoming chat / conference messages.
//!
//! DXSpider delivers a chat message to group members (and echoes your own) as:
//!
//! ```text
//! #9000 de HA5XYZ: hello everyone
//! FOC de G3XYZ: anyone around?
//! ```
//!
//! i.e. `<group> de <from>: <text>` — the same shape as a talk message. We only
//! accept it as chat when the group is a numeric channel (`#9000`) or a group we
//! have joined. This parser is tried *before* [`super::parse_talk`] so a real
//! talk (`<call> de <mycall>: …`) is not mistaken for a chat.

use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};

/// A chat message in a group.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Chat {
    /// Group / channel name, e.g. `#9000`, `FOC`.
    pub group: String,
    /// Sender callsign.
    pub from: String,
    pub text: String,
}

static CHAT_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)^(?P<group>#\d{1,6}|[A-Z][A-Z0-9]{1,14})\s+de\s+(?P<from>[A-Z0-9/-]{3,})\s*:\s?(?P<text>.+)$",
    )
    .unwrap()
});

/// Parse a line as a chat message. `my_groups` are the groups we have joined
/// (matched case-insensitively).
pub fn parse_chat(line: &str, my_groups: &[String]) -> Option<Chat> {
    let c = CHAT_RE.captures(line.trim())?;
    let group = c["group"].to_string();
    let text = c["text"].trim();
    if text.is_empty() {
        return None;
    }

    let accepted =
        group.starts_with('#') || my_groups.iter().any(|g| g.eq_ignore_ascii_case(&group));
    if !accepted {
        return None;
    }

    Some(Chat {
        group: group.to_ascii_uppercase(),
        from: c["from"].to_ascii_uppercase(),
        text: text.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn foc() -> Vec<String> {
        vec!["FOC".to_string()]
    }

    #[test]
    fn numeric_channel_always_accepted() {
        let c = parse_chat("#9000 de G3XYZ: hi all", &[]).unwrap();
        assert_eq!(c.group, "#9000");
        assert_eq!(c.from, "G3XYZ");
        assert_eq!(c.text, "hi all");
    }

    #[test]
    fn joined_group_accepted_others_not() {
        assert!(parse_chat("FOC de G3XYZ: hello", &foc()).is_some());
        assert!(parse_chat("SYSOP de G3XYZ: hello", &foc()).is_none());
    }

    #[test]
    fn own_echo_to_joined_group() {
        let c = parse_chat("FOC de HA5XYZ: my message", &foc()).unwrap();
        assert_eq!(c.from, "HA5XYZ");
    }

    #[test]
    fn rejects_prompt_talk_spot() {
        assert!(parse_chat("HA5XYZ de WA9PIE-2 31-Aug-2026 1711Z dxspider >", &foc()).is_none());
        assert!(parse_chat("DX de DL1ABC: 14195.0 EA8XYZ hi 1200Z", &foc()).is_none());
        // real talk to us — group "G3XYZ" is not joined
        assert!(parse_chat("G3XYZ de HA5XYZ: private hi", &foc()).is_none());
    }
}
