//! Turns raw cluster lines into typed [`ClusterEvent`]s.
//!
//! Recognised: DX spots, announcements / `WX`, real-time WWV / WCY propagation
//! broadcasts, chat/conference messages, and talk messages addressed to us.
//! Everything else falls through to [`ClusterEvent::Raw`]. Mail and most
//! per-command `SHOW` response parsers come in later phases.

mod announce;
mod chat;
mod geomag;
mod mail;
mod show;
mod spot;
mod talk;

pub use announce::{parse_announce, Announce};
pub use chat::{parse_chat, Chat};
pub use geomag::{parse_wcy, parse_wwv, Wcy, Wwv};
pub use mail::{
    parse_directory, parse_directory_line, parse_read_message, MailHeader, MailMessage,
};
pub use show::{
    parse_sh_announce, parse_sh_chat, parse_sh_dx, parse_sh_dx_line, parse_sh_station,
    parse_sh_users, HistSpot, HistoricAnnounce, HistoricChat, StationInfo,
};
pub use spot::{base_call, parse_spot, Spot};
pub use talk::{parse_talk, Talk};

use serde::{Deserialize, Serialize};

/// A single semantic event decoded from the cluster stream.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ClusterEvent {
    /// A `DX de …` spot.
    Spot(Spot),
    /// A `To ALL de …` announcement or `WX de …` weather broadcast.
    Announce(Announce),
    /// A real-time `WWV de …` propagation broadcast.
    Wwv(Wwv),
    /// A real-time `WCY de …` propagation broadcast.
    Wcy(Wcy),
    /// A chat / conference group message.
    Chat(Chat),
    /// A talk message addressed to us.
    Talk(Talk),
    /// Any line we do not (yet) parse into a richer form.
    Raw { line: String },
}

/// Connection context that sharpens ambiguous lines.
#[derive(Debug, Default, Clone)]
pub struct ParseCtx<'a> {
    /// Our callsign — enables talk-message detection.
    pub my_call: Option<&'a str>,
    /// Chat groups we have joined — enables chat-message detection.
    pub my_groups: &'a [String],
}

/// Parse a line without connection context (no talk / chat detection).
pub fn parse_line(line: &str) -> ClusterEvent {
    parse_line_ctx(line, &ParseCtx::default())
}

/// Parse one already-de-framed line into an event, using `ctx` to disambiguate
/// talk and chat lines (which otherwise look like ordinary node chatter).
pub fn parse_line_ctx(line: &str, ctx: &ParseCtx<'_>) -> ClusterEvent {
    if let Some(spot) = parse_spot(line) {
        return ClusterEvent::Spot(spot);
    }
    if let Some(wwv) = parse_wwv(line) {
        return ClusterEvent::Wwv(wwv);
    }
    if let Some(wcy) = parse_wcy(line) {
        return ClusterEvent::Wcy(wcy);
    }
    if let Some(ann) = parse_announce(line) {
        return ClusterEvent::Announce(ann);
    }
    if let Some(chat) = parse_chat(line, ctx.my_groups) {
        return ClusterEvent::Chat(chat);
    }
    if let Some(call) = ctx.my_call {
        if let Some(talk) = parse_talk(line, call) {
            return ClusterEvent::Talk(talk);
        }
    }
    ClusterEvent::Raw {
        line: line.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx<'a>(call: &'a str, groups: &'a [String]) -> ParseCtx<'a> {
        ParseCtx {
            my_call: Some(call),
            my_groups: groups,
        }
    }

    #[test]
    fn dispatches_each_event_kind() {
        assert!(matches!(
            parse_line("DX de DL1ABC:     14195.0  EA8XYZ       hi   1234Z"),
            ClusterEvent::Spot(_)
        ));
        assert!(matches!(
            parse_line("WWV de AE5E <21>:   SFI=69, A=8, K=2, No Storms -> No Storms"),
            ClusterEvent::Wwv(_)
        ));
        assert!(matches!(
            parse_line("WCY de DK0WCY-1 <11> : K=1 expK=0 A=4 R=0 SFI=94 SA=qui GMF=qui Au=no"),
            ClusterEvent::Wcy(_)
        ));
        assert!(matches!(
            parse_line("To ALL de G1ABC: hello"),
            ClusterEvent::Announce(_)
        ));
        assert!(matches!(
            parse_line("random node chatter"),
            ClusterEvent::Raw { .. }
        ));
    }

    #[test]
    fn talk_and_chat_need_context() {
        let groups = vec!["FOC".to_string()];
        let talk = "G3XYZ de HA5XYZ: hi there";
        let chat = "#9000 de G3XYZ: hi all";
        let foc = "FOC de G3XYZ: focsters";

        assert!(matches!(parse_line(talk), ClusterEvent::Raw { .. }));
        assert!(matches!(parse_line(chat), ClusterEvent::Chat(_))); // #channel: no ctx needed

        assert!(matches!(
            parse_line_ctx(talk, &ctx("HA5XYZ", &groups)),
            ClusterEvent::Talk(_)
        ));
        assert!(matches!(
            parse_line_ctx(foc, &ctx("HA5XYZ", &groups)),
            ClusterEvent::Chat(_)
        ));
    }
}
