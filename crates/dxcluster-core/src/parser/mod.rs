//! Turns raw cluster lines into typed [`ClusterEvent`]s.
//!
//! Phase 1 recognises DX spots; every other line falls through to
//! [`ClusterEvent::Raw`]. Later phases add announce / WWV / WCY / talk / mail
//! and per-command `SHOW` response parsers here.

mod spot;

pub use spot::{parse_spot, Spot};

use serde::{Deserialize, Serialize};

/// A single semantic event decoded from the cluster stream.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ClusterEvent {
    /// A `DX de …` spot.
    Spot(Spot),
    /// Any line we do not (yet) parse into a richer form.
    Raw { line: String },
}

/// Parse one already-de-framed line (no trailing CR/LF) into an event.
pub fn parse_line(line: &str) -> ClusterEvent {
    if let Some(spot) = parse_spot(line) {
        return ClusterEvent::Spot(spot);
    }
    ClusterEvent::Raw {
        line: line.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dispatches_spot_vs_raw() {
        match parse_line("DX de DL1ABC:     14195.0  EA8XYZ       hi   1234Z") {
            ClusterEvent::Spot(s) => assert_eq!(s.dx_call, "EA8XYZ"),
            other => panic!("expected spot, got {other:?}"),
        }
        match parse_line("To ALL de G1ABC: hello") {
            ClusterEvent::Raw { line } => assert!(line.contains("hello")),
            other => panic!("expected raw, got {other:?}"),
        }
    }
}
