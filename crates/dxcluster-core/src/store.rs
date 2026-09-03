//! SQLite-backed history of received spots.
//!
//! Phase 1 persists spots so the UI can show "what happened since last session"
//! and, later, run offline `SH/DX`-style searches. Announcements / WWV / WCY /
//! mail tables are added in their phases.

use std::path::Path;
use std::sync::Mutex;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::band::Mode;
use crate::parser::Spot;

pub type Result<T> = std::result::Result<T, rusqlite::Error>;

/// A spot as stored, with its database id and ingestion metadata.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StoredSpot {
    pub id: i64,
    /// Which connection profile received it.
    pub node_id: String,
    /// Unix seconds when we received the line.
    pub received_at: i64,
    pub spotter: String,
    pub spotter_base: String,
    pub freq_khz: f64,
    pub dx_call: String,
    pub comment: String,
    pub time_hhmm: String,
    pub grid: Option<String>,
    pub band: Option<String>,
    pub mode: Mode,
    pub is_skimmer: bool,
}

/// Handle to the on-disk (or in-memory) history database.
#[derive(Debug)]
pub struct Store {
    conn: Mutex<Connection>,
}

impl Store {
    /// Open (creating if needed) the database at `path`.
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let conn = Connection::open(path)?;
        Self::from_conn(conn)
    }

    /// Open a throwaway in-memory database (used in tests).
    pub fn open_in_memory() -> Result<Self> {
        Self::from_conn(Connection::open_in_memory()?)
    }

    fn from_conn(conn: Connection) -> Result<Self> {
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        let store = Self {
            conn: Mutex::new(conn),
        };
        store.migrate()?;
        Ok(store)
    }

    fn migrate(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS spots (
                id           INTEGER PRIMARY KEY,
                node_id      TEXT    NOT NULL,
                received_at  INTEGER NOT NULL,
                spotter      TEXT    NOT NULL,
                spotter_base TEXT    NOT NULL,
                freq_khz     REAL    NOT NULL,
                dx_call      TEXT    NOT NULL,
                comment      TEXT    NOT NULL,
                time_hhmm    TEXT    NOT NULL,
                grid         TEXT,
                band         TEXT,
                mode         TEXT    NOT NULL,
                is_skimmer   INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_spots_received  ON spots (received_at);
            CREATE INDEX IF NOT EXISTS idx_spots_dx_call   ON spots (dx_call);
            CREATE INDEX IF NOT EXISTS idx_spots_band      ON spots (band);
            "#,
        )
    }

    /// Insert a freshly received spot; returns its row id.
    pub fn insert_spot(&self, node_id: &str, spot: &Spot, received_at: i64) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            r#"INSERT INTO spots
               (node_id, received_at, spotter, spotter_base, freq_khz, dx_call,
                comment, time_hhmm, grid, band, mode, is_skimmer)
               VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)"#,
            params![
                node_id,
                received_at,
                spot.spotter,
                spot.spotter_base,
                spot.freq_khz,
                spot.dx_call,
                spot.comment,
                spot.time_hhmm,
                spot.grid,
                spot.band,
                mode_str(spot.mode),
                spot.is_skimmer as i64,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    /// The most recent `limit` spots, newest first.
    pub fn recent_spots(&self, limit: usize) -> Result<Vec<StoredSpot>> {
        self.query(
            "SELECT * FROM spots ORDER BY received_at DESC, id DESC LIMIT ?1",
            params![limit as i64],
        )
    }

    /// All spots received at or after `since` (unix seconds), oldest first.
    pub fn spots_since(&self, since: i64) -> Result<Vec<StoredSpot>> {
        self.query(
            "SELECT * FROM spots WHERE received_at >= ?1 ORDER BY received_at ASC, id ASC",
            params![since],
        )
    }

    /// Delete spots older than `cutoff` (unix seconds). Returns rows removed.
    pub fn prune(&self, cutoff: i64) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM spots WHERE received_at < ?1", params![cutoff])
    }

    fn query(&self, sql: &str, p: impl rusqlite::Params) -> Result<Vec<StoredSpot>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map(p, |r| {
            Ok(StoredSpot {
                id: r.get("id")?,
                node_id: r.get("node_id")?,
                received_at: r.get("received_at")?,
                spotter: r.get("spotter")?,
                spotter_base: r.get("spotter_base")?,
                freq_khz: r.get("freq_khz")?,
                dx_call: r.get("dx_call")?,
                comment: r.get("comment")?,
                time_hhmm: r.get("time_hhmm")?,
                grid: r.get("grid")?,
                band: r.get("band")?,
                mode: mode_from_str(&r.get::<_, String>("mode")?),
                is_skimmer: r.get::<_, i64>("is_skimmer")? != 0,
            })
        })?;
        rows.collect()
    }
}

fn mode_str(m: Mode) -> &'static str {
    match m {
        Mode::Cw => "CW",
        Mode::Ssb => "SSB",
        Mode::Ft => "FT",
        Mode::Digi => "DIGI",
        Mode::Fm => "FM",
        Mode::Unknown => "UNKNOWN",
    }
}
fn mode_from_str(s: &str) -> Mode {
    match s {
        "CW" => Mode::Cw,
        "SSB" => Mode::Ssb,
        "FT" => Mode::Ft,
        "DIGI" => Mode::Digi,
        "FM" => Mode::Fm,
        _ => Mode::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse_spot;

    fn spot(line: &str) -> Spot {
        parse_spot(line).unwrap()
    }

    #[test]
    fn insert_and_read_back() {
        let store = Store::open_in_memory().unwrap();
        let s = spot("DX de DL1ABC:  14195.0  EA8XYZ  hi   1234Z");
        let id = store.insert_spot("node1", &s, 1_000).unwrap();
        assert_eq!(id, 1);

        let recent = store.recent_spots(10).unwrap();
        assert_eq!(recent.len(), 1);
        assert_eq!(recent[0].dx_call, "EA8XYZ");
        assert_eq!(recent[0].node_id, "node1");
        assert_eq!(recent[0].band.as_deref(), Some("20m"));
        assert_eq!(recent[0].mode, Mode::Ssb);
    }

    #[test]
    fn since_and_prune() {
        let store = Store::open_in_memory().unwrap();
        let s = spot("DX de DL1ABC:  14195.0  EA8XYZ  hi   1234Z");
        store.insert_spot("n", &s, 100).unwrap();
        store.insert_spot("n", &s, 200).unwrap();
        store.insert_spot("n", &s, 300).unwrap();

        assert_eq!(store.spots_since(200).unwrap().len(), 2);
        assert_eq!(store.prune(200).unwrap(), 1);
        assert_eq!(store.recent_spots(10).unwrap().len(), 2);
    }

    #[test]
    fn newest_first_ordering() {
        let store = Store::open_in_memory().unwrap();
        for (i, call) in ["AA1A", "BB2B", "CC3C"].iter().enumerate() {
            let line = format!("DX de DL1ABC:  14195.0  {call}  hi   1234Z");
            store
                .insert_spot("n", &spot(&line), 100 + i as i64)
                .unwrap();
        }
        let recent = store.recent_spots(2).unwrap();
        assert_eq!(recent[0].dx_call, "CC3C");
        assert_eq!(recent[1].dx_call, "BB2B");
    }
}
