//! Transport-agnostic core for DX Cluster Desktop.
//!
//! This crate has no Tauri/webview dependency so its logic can be unit-tested
//! quickly on any platform. The Tauri app in `src-tauri` is a thin shell over
//! it.
//!
//! Module map (filled in across phases):
//! - `telnet`     — minimal Telnet IAC handling + line framing
//! - `connection` — per-node login state machine + session task
//! - `parser`     — incoming line -> typed [`parser::ClusterEvent`]
//! - `band`       — frequency (kHz) -> ham band + coarse mode guess
//! - `commands`   — structured input -> outgoing cluster command strings
//! - `reference`  — cty.dat, Maidenhead / great-circle geo math
//! - `store`      — SQLite spot / announcement / wwv history

pub mod band;
pub mod commands;
pub mod connection;
pub mod parser;
pub mod reference;
pub mod store;
pub mod telnet;

/// Crate version, surfaced to the app for diagnostics.
pub fn core_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
