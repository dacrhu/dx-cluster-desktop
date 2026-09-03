//! Parsers for the DXSpider mail / bulletin subsystem: `DIRECTORY` listings and
//! `READ <msgno>` output.
//!
//! `DIRECTORY` rows look like (columns are space-padded, flags hug the number):
//!
//! ```text
//!    12     1234 GB7DJK   G1TLH    12-Aug 1830Z test bulletin
//!    13-p    567 G1TLH    G0RDI    12-Aug 1835Z re: sked
//!    14 p    890 N1XYZ    G1TLH    11-Aug 0900Z personal, unread
//! ```
//!
//! A `-` right after the number = already read; a `p` = personal message.

use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};

/// One row of a `DIRECTORY` listing.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MailHeader {
    pub msgno: u32,
    pub read: bool,
    pub private: bool,
    pub size: u32,
    pub to: String,
    pub from: String,
    /// Date as the node prints it, e.g. `12-Aug`.
    pub date: String,
    /// Time as the node prints it, e.g. `1830Z`.
    pub time: String,
    pub subject: String,
}

/// A message body from `READ <msgno>`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MailMessage {
    pub msgno: u32,
    pub from: String,
    pub to: String,
    pub subject: String,
    /// `Posted:` line, verbatim.
    pub posted: String,
    pub body: String,
}

static DIR_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?x)^\s*
        (?P<msgno>\d{1,7})
        (?P<flags>-?\ ?p?)\s+
        (?P<size>\d{1,9})\s+
        (?P<to>[A-Z0-9/_-]+)\s+
        (?P<from>[A-Z0-9/_-]+)\s+
        (?P<date>\d{1,2}[-/]?[A-Za-z]{3}(?:[-/]\d{2,4})?)\s+
        (?P<time>\d{3,4}Z?)\s+
        (?P<subject>.*?)\s*$",
    )
    .unwrap()
});

/// Parse one `DIRECTORY` row. Returns `None` for headers / prompts / blanks.
pub fn parse_directory_line(line: &str) -> Option<MailHeader> {
    let c = DIR_RE.captures(line.trim_end())?;
    let flags = &c["flags"];
    Some(MailHeader {
        msgno: c["msgno"].parse().ok()?,
        read: flags.contains('-'),
        private: flags.contains('p'),
        size: c["size"].parse().ok()?,
        to: c["to"].to_ascii_uppercase(),
        from: c["from"].to_ascii_uppercase(),
        date: c["date"].to_string(),
        time: c["time"].to_string(),
        subject: c["subject"].trim().to_string(),
    })
}

/// Parse a whole `DIRECTORY` response.
pub fn parse_directory(lines: &[String]) -> Vec<MailHeader> {
    lines
        .iter()
        .filter_map(|l| parse_directory_line(l))
        .collect()
}

static READ_KV_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)^(subject|posted|msg|from|to|read)\s*:\s*(.+)$").unwrap());

/// Parse `READ <msgno>` output into a [`MailMessage`].
pub fn parse_read_message(lines: &[String]) -> Option<MailMessage> {
    let mut msgno = None;
    let mut from = String::new();
    let mut to = String::new();
    let mut subject = String::new();
    let mut posted = String::new();
    let mut body_lines: Vec<String> = Vec::new();
    let mut in_body = false;

    for raw in lines {
        let line = raw.trim_end();
        if !in_body {
            if let Some(c) = READ_KV_RE.captures(line.trim()) {
                let val = c[2].trim().to_string();
                match c[1].to_ascii_lowercase().as_str() {
                    "subject" => subject = val,
                    "posted" => posted = val,
                    "msg" => msgno = val.split_whitespace().next().and_then(|s| s.parse().ok()),
                    "from" => from = val.to_ascii_uppercase(),
                    "to" => to = val.to_ascii_uppercase(),
                    _ => {}
                }
                continue;
            }
            // A blank line ends the header block.
            if line.trim().is_empty() && (!subject.is_empty() || msgno.is_some()) {
                in_body = true;
                continue;
            }
            // Not a header line and no header seen yet — skip (banner/echo).
            if subject.is_empty() && msgno.is_none() {
                continue;
            }
        }

        // Body — stop at the node prompt.
        if line.contains(" de ") && line.ends_with('>') {
            break;
        }
        body_lines.push(line.to_string());
    }

    let msgno = msgno?;
    // trim trailing blank lines
    while body_lines
        .last()
        .map(|l| l.trim().is_empty())
        .unwrap_or(false)
    {
        body_lines.pop();
    }
    Some(MailMessage {
        msgno,
        from,
        to,
        subject,
        posted,
        body: body_lines.join("\n"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_directory_rows() {
        let d = parse_directory_line("   12     1234 ALL      GB7DJK   12-Aug 1830Z test bulletin")
            .unwrap();
        assert_eq!(d.msgno, 12);
        assert!(!d.read);
        assert!(!d.private);
        assert_eq!(d.to, "ALL");
        assert_eq!(d.from, "GB7DJK");
        assert_eq!(d.subject, "test bulletin");

        let p =
            parse_directory_line("   13-p    567 G1TLH    G0RDI    12-Aug 1835Z re: sked").unwrap();
        assert_eq!(p.msgno, 13);
        assert!(p.read);
        assert!(p.private);

        let u =
            parse_directory_line("   14 p    890 G1TLH    N1XYZ    11-Aug 0900Z unread personal")
                .unwrap();
        assert!(!u.read);
        assert!(u.private);
    }

    #[test]
    fn rejects_non_directory_lines() {
        assert!(parse_directory_line("No messages found").is_none());
        assert!(parse_directory_line("HA5TEST de WA9PIE-2 31-Aug-2026 1815Z dxspider >").is_none());
        assert!(parse_directory_line("Msg   Date   Time  From    To      Subject").is_none());
    }

    #[test]
    fn parses_read_message() {
        let lines: Vec<String> = [
            "Subject: test bulletin",
            "Posted: 12-Aug-2026 1830Z",
            "Msg: 12",
            "From: GB7DJK",
            "To: ALL",
            "",
            "hello everyone",
            "this is line two",
            "",
            "HA5TEST de WA9PIE-2 31-Aug-2026 1900Z dxspider >",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect();
        let m = parse_read_message(&lines).unwrap();
        assert_eq!(m.msgno, 12);
        assert_eq!(m.from, "GB7DJK");
        assert_eq!(m.to, "ALL");
        assert_eq!(m.subject, "test bulletin");
        assert_eq!(m.body, "hello everyone\nthis is line two");
    }
}
