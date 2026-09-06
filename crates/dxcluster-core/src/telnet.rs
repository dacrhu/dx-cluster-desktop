//! Minimal Telnet handling for DX cluster connections.
//!
//! DX cluster nodes are essentially line-oriented plain TCP, but many still open
//! with a short burst of Telnet option negotiation (`IAC DO/WILL …`). We refuse
//! every option except SUPPRESS-GO-AHEAD (which we accept in both directions),
//! strip the control bytes out of the stream, and hand back clean text lines
//! plus any bytes that must be written back to the socket.
//!
//! The decoder also exposes the current unterminated buffer via [`Decoder::pending`]
//! so the connection layer can match prompts like `login: ` that arrive without
//! a trailing newline.

/// Interpret As Command.
const IAC: u8 = 255;
const SE: u8 = 240;
const SB: u8 = 250;
const WILL: u8 = 251;
const WONT: u8 = 252;
const DO: u8 = 253;
const DONT: u8 = 254;

/// Telnet option: Suppress Go Ahead.
const OPT_SGA: u8 = 3;

const MAX_PENDING: usize = 8192;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum State {
    Text,
    Iac,
    Negotiate(u8),
    Subneg,
    SubnegIac,
}

/// Streaming Telnet decoder. Feed it socket bytes; get back lines and replies.
#[derive(Debug)]
pub struct Decoder {
    state: State,
    line: Vec<u8>,
}

/// Result of feeding a chunk of bytes to the [`Decoder`].
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Decoded {
    /// Complete text lines (CR/LF stripped), in order.
    pub lines: Vec<String>,
    /// Bytes that must be written back to the socket (option negotiation).
    pub replies: Vec<u8>,
}

impl Default for Decoder {
    fn default() -> Self {
        Self::new()
    }
}

impl Decoder {
    pub fn new() -> Self {
        Self {
            state: State::Text,
            line: Vec::with_capacity(256),
        }
    }

    /// The current partially-received line (no newline yet). Useful for matching
    /// prompts that the server does not terminate.
    pub fn pending(&self) -> String {
        decode_line(&self.line)
    }

    /// Feed a chunk of bytes read from the socket.
    pub fn feed(&mut self, input: &[u8]) -> Decoded {
        let mut out = Decoded::default();
        for &b in input {
            match self.state {
                State::Text => self.byte_in_text(b, &mut out),
                State::Iac => self.byte_after_iac(b, &mut out),
                State::Negotiate(cmd) => {
                    negotiate(cmd, b, &mut out.replies);
                    self.state = State::Text;
                }
                State::Subneg => {
                    if b == IAC {
                        self.state = State::SubnegIac;
                    }
                }
                State::SubnegIac => {
                    self.state = if b == SE { State::Text } else { State::Subneg };
                }
            }
        }
        out
    }

    fn byte_in_text(&mut self, b: u8, out: &mut Decoded) {
        match b {
            IAC => self.state = State::Iac,
            b'\n' => self.flush_line(out),
            // Drop CR (0x0d) and other C0 control bytes (nodes pepper spot
            // lines with BEL, 0x07); keep TAB (0x09), seen in `SHOW` output.
            0x00..=0x08 | 0x0b..=0x1f | 0x7f => {}
            _ => {
                if self.line.len() < MAX_PENDING {
                    self.line.push(b);
                } else {
                    // Runaway line with no newline — flush what we have.
                    self.flush_line(out);
                    self.line.push(b);
                }
            }
        }
    }

    fn byte_after_iac(&mut self, b: u8, _out: &mut Decoded) {
        match b {
            // Escaped IAC (a literal 0xFF data byte). DX cluster text is ASCII,
            // so we simply drop it rather than inject invalid UTF-8.
            IAC => self.state = State::Text,
            WILL | WONT | DO | DONT => self.state = State::Negotiate(b),
            SB => self.state = State::Subneg,
            _ => self.state = State::Text, // GA / NOP / others: ignore
        }
    }

    fn flush_line(&mut self, out: &mut Decoded) {
        let s = decode_line(&self.line).trim_end().to_string();
        self.line.clear();
        out.lines.push(s);
    }
}

/// Turn a raw line of node bytes into text. A line that is valid UTF-8 is taken
/// as such; otherwise every byte is mapped 1:1 to U+0000..=U+00FF (ISO-8859-1 /
/// Latin-1). Cluster nodes are historically 8-bit Latin-1 at best (and many
/// strip the C1 range 0x80..=0x9F, which mangles UTF-8), so this keeps accented
/// text from collapsing into U+FFFD replacement characters.
fn decode_line(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(s) => s.to_string(),
        Err(_) => bytes.iter().map(|&b| b as char).collect(),
    }
}

/// Decide the reply to an `IAC <cmd> <opt>` negotiation.
fn negotiate(cmd: u8, opt: u8, replies: &mut Vec<u8>) {
    let response = match (cmd, opt) {
        // Accept Suppress-Go-Ahead in both directions.
        (DO, OPT_SGA) => Some(WILL),
        (WILL, OPT_SGA) => Some(DO),
        // Refuse everything else.
        (DO, _) => Some(WONT),
        (WILL, _) => Some(DONT),
        // Peer confirming a refusal/agreement — nothing to send.
        (WONT, _) | (DONT, _) => None,
        _ => None,
    };
    if let Some(r) = response {
        replies.extend_from_slice(&[IAC, r, opt]);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_crlf_lines() {
        let mut d = Decoder::new();
        let out = d.feed(b"hello world\r\nsecond line\r\n");
        assert_eq!(out.lines, vec!["hello world", "second line"]);
        assert!(out.replies.is_empty());
    }

    #[test]
    fn handles_bare_lf_and_partial() {
        let mut d = Decoder::new();
        assert_eq!(d.feed(b"one\ntw").lines, vec!["one"]);
        assert_eq!(d.pending(), "tw");
        assert_eq!(d.feed(b"o\n").lines, vec!["two"]);
    }

    #[test]
    fn refuses_options_and_strips_them() {
        let mut d = Decoder::new();
        // IAC DO ECHO(1), IAC WILL ECHO(1), then text.
        let input = [IAC, DO, 1, IAC, WILL, 1, b'h', b'i', b'\n'];
        let out = d.feed(&input);
        assert_eq!(out.lines, vec!["hi"]);
        assert_eq!(out.replies, vec![IAC, WONT, 1, IAC, DONT, 1]);
    }

    #[test]
    fn accepts_suppress_go_ahead() {
        let mut d = Decoder::new();
        let out = d.feed(&[IAC, DO, OPT_SGA, IAC, WILL, OPT_SGA]);
        assert_eq!(out.replies, vec![IAC, WILL, OPT_SGA, IAC, DO, OPT_SGA]);
    }

    #[test]
    fn skips_subnegotiation() {
        let mut d = Decoder::new();
        // IAC SB TTYPE ... IAC SE  then "ok\n"
        let mut input = vec![IAC, SB, 24, 1, 2, 3, IAC, SE];
        input.extend_from_slice(b"ok\n");
        assert_eq!(d.feed(&input).lines, vec!["ok"]);
    }

    #[test]
    fn escaped_iac_is_dropped() {
        let mut d = Decoder::new();
        let out = d.feed(&[b'a', IAC, IAC, b'b', b'\n']);
        assert_eq!(out.lines, vec!["ab"]);
    }

    #[test]
    fn strips_bel_and_control_bytes_keeps_tab() {
        let mut d = Decoder::new();
        let out = d.feed(b"DX de X: 14195.0 Y hi 1200Z\x07\x07\r\ncol1\tcol2\n");
        assert_eq!(out.lines, vec!["DX de X: 14195.0 Y hi 1200Z", "col1\tcol2"]);
    }

    #[test]
    fn utf8_lines_pass_through() {
        let mut d = Decoder::new();
        let out = d.feed("Árvíztűrő Tükörfúrógép\r\n".as_bytes());
        assert_eq!(out.lines, vec!["Árvíztűrő Tükörfúrógép"]);
    }

    #[test]
    fn latin1_bytes_decode_without_replacement_chars() {
        let mut d = Decoder::new();
        // 0xFC = ü in ISO-8859-1 — not valid UTF-8 on its own.
        let out = d.feed(b"M\xfcller\n");
        assert_eq!(out.lines, vec!["Müller"]);
        assert!(!out.lines[0].contains('\u{fffd}'));
    }

    #[test]
    fn matches_unterminated_prompt_via_pending() {
        let mut d = Decoder::new();
        let out = d.feed(b"Please enter your call: ");
        assert!(out.lines.is_empty());
        assert_eq!(d.pending().trim(), "Please enter your call:");
    }
}
