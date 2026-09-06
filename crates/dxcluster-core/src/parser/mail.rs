//! Parsers for the DXSpider mail / bulletin subsystem: `DIRECTORY` listings and
//! `READ <msgno>` output.
//!
//! `DIRECTORY` rows (real capture, DXSpider V1.57 build 686 — columns are
//! space-padded `msgno size to from date time subject`, any read/personal flag
//! hugs the number):
//!
//! ```text
//!   1814  14505      ALL   IK5PWJ  7-Aug 1823Z 425 DX News #1840
//!   1815   9322      ALL   IK5PWJ  7-Aug 1824Z 425 DX News #1840 [Calendar]
//!   1816-  9854      ALL   IK5PWJ 14-Aug 1926Z 425 DX News #1841 [Calendar]
//! ```
//!
//! A `-` right after the number = already read; a `p` = personal message.
//!
//! `READ <msgno>` starts with a single-line header, then the body straight after
//! (no blank line), ending at the node prompt:
//!
//! ```text
//! Msg: 1821 From: IK5PWJ Date: 28-Aug 1658Z Subj: 425 DX News #1843 [Calendar]
//! 29 August 2026                                           A.R.I. DX Bulletin
//! ...
//! HG7WHD de HG8PRC  6-Sep-2026 1657Z dxspider >
//! ```
//!
//! Older / other builds print one `Key: value` per line (`Subject:`, `Posted:`,
//! `Msg:`, `From:`, `To:`) followed by a blank line — still handled.

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

/// The single-line `READ` header seen on real DXSpider:
/// `Msg: 1821 From: IK5PWJ Date: 28-Aug 1658Z Subj: 425 DX News #1843 [Calendar]`
/// — `Private` after the number and a `To:` field appear on some builds.
static READ_HDR_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?xi)^\s*
        msg:\s*(?P<msgno>\d+)\s+
        (?:private\s+)?
        from:\s*(?P<from>\S+)\s+
        (?:to:\s*(?P<to>\S+)\s+)?
        (?:date|posted):\s*(?P<posted>.+?)\s+
        subj(?:ect)?:\s*(?P<subject>.*?)\s*$",
    )
    .unwrap()
});

/// Parse `READ <msgno>` output into a [`MailMessage`].
pub fn parse_read_message(lines: &[String]) -> Option<MailMessage> {
    let mut msgno = None;
    let mut from = String::new();
    let mut to = String::new();
    let mut subject = String::new();
    let mut posted = String::new();
    let mut body_lines: Vec<String> = Vec::new();
    let mut in_body = false;
    let mut header_seen = false;

    for raw in lines {
        let line = raw.trim_end();
        if !in_body {
            // Combined single-line header — body follows immediately.
            if let Some(c) = READ_HDR_RE.captures(line.trim()) {
                msgno = c["msgno"].parse().ok();
                from = c["from"].to_ascii_uppercase();
                if let Some(t) = c.name("to") {
                    to = t.as_str().to_ascii_uppercase();
                }
                posted = c["posted"].trim().to_string();
                subject = c["subject"].trim().to_string();
                header_seen = true;
                in_body = true;
                continue;
            }
            // Legacy one-`Key: value`-per-line header.
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
                header_seen = true;
                continue;
            }
            // A blank line ends a multi-line header block.
            if line.trim().is_empty() {
                if header_seen {
                    in_body = true;
                }
                continue;
            }
            // Not a header line and no header seen yet — skip (banner/echo).
            if !header_seen {
                continue;
            }
        }

        // Body — stop at the node prompt.
        if line.contains(" de ") && line.ends_with('>') {
            break;
        }
        // Drop blank lines before the first real body line.
        if body_lines.is_empty() && line.trim().is_empty() {
            continue;
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
    fn parses_real_directory_rows() {
        // Real capture, hg8lxl.ham.hu (DXSpider V1.57 build 686).
        let a = parse_directory_line(
            "  1815   9322      ALL   IK5PWJ  7-Aug 1824Z 425 DX News #1840 [Calendar]",
        )
        .unwrap();
        assert_eq!(a.msgno, 1815);
        assert!(!a.read);
        assert!(!a.private);
        assert_eq!(a.size, 9322);
        assert_eq!(a.to, "ALL");
        assert_eq!(a.from, "IK5PWJ");
        assert_eq!(a.date, "7-Aug");
        assert_eq!(a.time, "1824Z");
        assert_eq!(a.subject, "425 DX News #1840 [Calendar]");

        let r =
            parse_directory_line("  1816-  9854      ALL   IK5PWJ 14-Aug 1926Z 425 DX News #1841")
                .unwrap();
        assert_eq!(r.msgno, 1816);
        assert!(r.read);
    }

    #[test]
    fn rejects_non_directory_lines() {
        assert!(parse_directory_line("No messages found").is_none());
        assert!(parse_directory_line("HA5TEST de WA9PIE-2 31-Aug-2026 1815Z dxspider >").is_none());
        assert!(parse_directory_line("Msg   Date   Time  From    To      Subject").is_none());
        // WWV history row — leading date must not read as a msgno.
        assert!(parse_directory_line(
            " 6-Sep-2026   15   111   6   1 Minor w/S1 R1 -> No Storms   <W0MU>"
        )
        .is_none());
        // Connected-users list.
        assert!(parse_directory_line("EA3NP        HA0HV        HA0NAR       HA1AR").is_none());
    }

    #[test]
    fn parses_real_read_message() {
        // Real capture: single-line header, body immediately after, prompt ends it.
        let lines: Vec<String> = [
            "read 1821",
            "Msg: 1821 From: IK5PWJ Date: 28-Aug 1658Z Subj: 425 DX News #1843 [Calendar]",
            "29 August 2026                                           A.R.I. DX Bulletin",
            "                                   No 1843",
            "",
            "PERIOD           CALL                                                   REF",
            "till  30/08      EN35UKR: special callsign                             1839",
            "",
            "HG7WHD de HG8PRC  6-Sep-2026 1657Z dxspider >",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect();
        let m = parse_read_message(&lines).unwrap();
        assert_eq!(m.msgno, 1821);
        assert_eq!(m.from, "IK5PWJ");
        assert_eq!(m.to, "");
        assert_eq!(m.posted, "28-Aug 1658Z");
        assert_eq!(m.subject, "425 DX News #1843 [Calendar]");
        assert!(m.body.starts_with("29 August 2026"));
        assert!(m.body.ends_with("1839"));
        assert!(m.body.contains("PERIOD"));
    }

    #[test]
    fn parses_combined_header_with_private_and_to() {
        let lines: Vec<String> = [
            "Msg: 42 Private From: G1TLH To: HA5TEST Date: 12-Aug-2026 1830Z Subject: re: sked",
            "see you at 1400 on 20m",
            "HA5TEST de GB7DJK 12-Aug-2026 1831Z dxspider >",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect();
        let m = parse_read_message(&lines).unwrap();
        assert_eq!(m.msgno, 42);
        assert_eq!(m.from, "G1TLH");
        assert_eq!(m.to, "HA5TEST");
        assert_eq!(m.posted, "12-Aug-2026 1830Z");
        assert_eq!(m.subject, "re: sked");
        assert_eq!(m.body, "see you at 1400 on 20m");
    }

    #[test]
    fn parses_legacy_multiline_read_message() {
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
