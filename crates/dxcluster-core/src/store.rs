//! SQLite-backed history of received spots.
//!
//! Phase 1 persists spots so the UI can show "what happened since last session"
//! and, later, run offline `SH/DX`-style searches. Announcements / WWV / WCY /
//! mail tables are added in their phases.

use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::band::Mode;
use crate::parser::{Announce, MailMessage, Spot, Wcy, Wwv};

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

/// An announcement / `WX` line as stored.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StoredAnnounce {
    pub id: i64,
    pub node_id: String,
    pub received_at: i64,
    pub sender: String,
    pub target: String,
    pub text: String,
    pub is_wx: bool,
}

/// A WWV broadcast as stored.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StoredWwv {
    pub id: i64,
    pub node_id: String,
    pub received_at: i64,
    pub sender: String,
    pub hour: u8,
    pub sfi: u16,
    pub a: u16,
    pub k: u16,
    pub forecast: String,
}

/// A talk message as stored.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StoredTalk {
    pub id: i64,
    pub node_id: String,
    pub received_at: i64,
    /// True if we sent it, false if we received it.
    pub outgoing: bool,
    /// The other party's callsign.
    pub peer: String,
    pub text: String,
}

/// A cached mail message body (populated when the user reads it).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StoredMail {
    pub node_id: String,
    pub msgno: u32,
    pub from: String,
    pub to: String,
    pub subject: String,
    pub posted: String,
    pub body: String,
    pub fetched_at: i64,
}

/// A chat group message as stored.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StoredChat {
    pub id: i64,
    pub node_id: String,
    pub received_at: i64,
    pub outgoing: bool,
    pub group: String,
    pub sender: String,
    pub text: String,
}

/// A WCY broadcast as stored.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StoredWcy {
    pub id: i64,
    pub node_id: String,
    pub received_at: i64,
    pub sender: String,
    pub hour: u8,
    pub k: u16,
    pub expk: u16,
    pub a: u16,
    pub r: u16,
    pub sfi: u16,
    pub sa: String,
    pub gmf: String,
    pub aurora: String,
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
        // Cheap insurance: with a single Mutex<Connection> nothing else in
        // this process can contend for the lock, but a busy_timeout costs
        // nothing and helps if the file is ever opened externally (e.g. a
        // technical user poking history.sqlite3 with the sqlite3 CLI while
        // the app is running).
        conn.busy_timeout(Duration::from_secs(5))?;
        // Only takes effect on a freshly created database (SQLite requires a
        // full VACUUM to change auto_vacuum on an existing file) — see the
        // comment on `prune_expired` for why we don't run that VACUUM
        // automatically.
        conn.pragma_update(None, "auto_vacuum", "INCREMENTAL")?;
        let store = Self {
            conn: Mutex::new(conn),
        };
        store.migrate()?;
        Ok(store)
    }

    /// Log a warning if `f` (run under the connection lock) takes longer than
    /// this — so a stalled WAL checkpoint or a broad scan shows up by name in
    /// the log instead of the app just going quiet. See the long-session
    /// freeze investigated 2026-09-11.
    const SLOW_QUERY_WARN: Duration = Duration::from_millis(250);

    fn timed<T>(&self, label: &str, f: impl FnOnce(&Connection) -> Result<T>) -> Result<T> {
        let start = Instant::now();
        let conn = self.conn.lock().unwrap();
        let result = f(&conn);
        let elapsed = start.elapsed();
        if elapsed > Self::SLOW_QUERY_WARN {
            log::warn!("store: {label} took {elapsed:?}");
        }
        result
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

            CREATE TABLE IF NOT EXISTS announcements (
                id          INTEGER PRIMARY KEY,
                node_id     TEXT    NOT NULL,
                received_at INTEGER NOT NULL,
                sender      TEXT    NOT NULL,
                target      TEXT    NOT NULL,
                text        TEXT    NOT NULL,
                is_wx       INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_ann_received ON announcements (received_at);

            CREATE TABLE IF NOT EXISTS wwv (
                id          INTEGER PRIMARY KEY,
                node_id     TEXT    NOT NULL,
                received_at INTEGER NOT NULL,
                sender      TEXT    NOT NULL,
                hour        INTEGER NOT NULL,
                sfi         INTEGER NOT NULL,
                a           INTEGER NOT NULL,
                k           INTEGER NOT NULL,
                forecast    TEXT    NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_wwv_received ON wwv (received_at);

            CREATE TABLE IF NOT EXISTS wcy (
                id          INTEGER PRIMARY KEY,
                node_id     TEXT    NOT NULL,
                received_at INTEGER NOT NULL,
                sender      TEXT    NOT NULL,
                hour        INTEGER NOT NULL,
                k           INTEGER NOT NULL,
                expk        INTEGER NOT NULL,
                a           INTEGER NOT NULL,
                r           INTEGER NOT NULL,
                sfi         INTEGER NOT NULL,
                sa          TEXT    NOT NULL,
                gmf         TEXT    NOT NULL,
                aurora      TEXT    NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_wcy_received ON wcy (received_at);

            CREATE TABLE IF NOT EXISTS talk (
                id          INTEGER PRIMARY KEY,
                node_id     TEXT    NOT NULL,
                received_at INTEGER NOT NULL,
                outgoing    INTEGER NOT NULL,
                peer        TEXT    NOT NULL,
                text        TEXT    NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_talk_peer ON talk (peer, received_at);

            CREATE TABLE IF NOT EXISTS chat (
                id          INTEGER PRIMARY KEY,
                node_id     TEXT    NOT NULL,
                received_at INTEGER NOT NULL,
                outgoing    INTEGER NOT NULL,
                chat_group  TEXT    NOT NULL,
                sender      TEXT    NOT NULL,
                text        TEXT    NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_chat_group ON chat (chat_group, received_at);

            CREATE TABLE IF NOT EXISTS mail (
                node_id    TEXT    NOT NULL,
                msgno      INTEGER NOT NULL,
                sender     TEXT    NOT NULL,
                recipient  TEXT    NOT NULL,
                subject    TEXT    NOT NULL,
                posted     TEXT    NOT NULL,
                body       TEXT    NOT NULL,
                fetched_at INTEGER NOT NULL,
                PRIMARY KEY (node_id, msgno)
            );
            "#,
        )
    }

    /// Window (seconds) in which the same spot from another node is a duplicate.
    const DEDUP_WINDOW: i64 = 90;

    /// Default retention for spots + history tables — long enough to keep
    /// offline SH/DX useful, short enough to bound file size across a
    /// long-running or never-restarted session. See [`Self::prune`].
    pub const DEFAULT_RETENTION_SECS: i64 = 30 * 24 * 3600;

    /// Insert a freshly received spot, unless the same spot (same DX call,
    /// frequency and spotter) already arrived within [`Self::DEDUP_WINDOW`]
    /// seconds — e.g. relayed via a second connected node. Returns the new row
    /// id, or `None` if it was a duplicate.
    pub fn insert_spot(&self, node_id: &str, spot: &Spot, received_at: i64) -> Result<Option<i64>> {
        self.timed("insert_spot", |conn| {
            let dup: Option<i64> = conn
                .query_row(
                    "SELECT id FROM spots
                     WHERE dx_call = ?1 AND spotter_base = ?2
                       AND ABS(freq_khz - ?3) < 0.6
                       AND received_at >= ?4
                     LIMIT 1",
                    params![
                        spot.dx_call,
                        spot.spotter_base,
                        spot.freq_khz,
                        received_at - Self::DEDUP_WINDOW
                    ],
                    |r| r.get(0),
                )
                .optional()?;
            if dup.is_some() {
                return Ok(None);
            }

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
            Ok(Some(conn.last_insert_rowid()))
        })
    }

    /// The most recent `limit` spots, newest first.
    pub fn recent_spots(&self, limit: usize) -> Result<Vec<StoredSpot>> {
        self.query(
            "recent_spots",
            "SELECT * FROM spots ORDER BY received_at DESC, id DESC LIMIT ?1",
            params![limit as i64],
        )
    }

    /// All spots received at or after `since` (unix seconds), oldest first.
    pub fn spots_since(&self, since: i64) -> Result<Vec<StoredSpot>> {
        self.query(
            "spots_since",
            "SELECT * FROM spots WHERE received_at >= ?1 ORDER BY received_at ASC, id ASC",
            params![since],
        )
    }

    /// Search stored spots — an offline `SH/DX`. All filters are optional;
    /// prefixes match the start of the callsign.
    pub fn search_spots(
        &self,
        dx_prefix: Option<&str>,
        band: Option<&str>,
        spotter_prefix: Option<&str>,
        since: Option<i64>,
        limit: usize,
    ) -> Result<Vec<StoredSpot>> {
        let mut sql = String::from("SELECT * FROM spots WHERE 1=1");
        let mut args: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        if let Some(p) = dx_prefix.filter(|s| !s.is_empty()) {
            sql.push_str(" AND dx_call LIKE ?");
            args.push(Box::new(format!("{}%", p.to_ascii_uppercase())));
        }
        if let Some(b) = band.filter(|s| !s.is_empty()) {
            sql.push_str(" AND band = ?");
            args.push(Box::new(b.to_string()));
        }
        if let Some(p) = spotter_prefix.filter(|s| !s.is_empty()) {
            sql.push_str(" AND spotter_base LIKE ?");
            args.push(Box::new(format!("{}%", p.to_ascii_uppercase())));
        }
        if let Some(ts) = since {
            sql.push_str(" AND received_at >= ?");
            args.push(Box::new(ts));
        }
        sql.push_str(" ORDER BY received_at DESC, id DESC LIMIT ?");
        args.push(Box::new(limit as i64));

        let params: Vec<&dyn rusqlite::types::ToSql> = args.iter().map(|b| b.as_ref()).collect();
        self.query("search_spots", &sql, params.as_slice())
    }

    /// Delete rows older than `cutoff` (unix seconds) from every history table.
    /// Returns the number of spot rows removed. `mail` is deliberately not
    /// included — it's finite and user-managed (deleting a message is an
    /// explicit user action), not an ever-growing feed like the others.
    ///
    /// This does not shrink the file (SQLite doesn't reclaim freed pages on a
    /// plain DELETE): `from_conn` sets `auto_vacuum = INCREMENTAL` for
    /// *newly created* databases, but changing that setting on an existing
    /// file requires a one-off full `VACUUM` — a blocking, whole-file-copy
    /// operation — which we deliberately do not run automatically here. The
    /// growth this prunes going forward is the actual bug; disk space
    /// already used isn't itself a problem worth that cost.
    pub fn prune(&self, cutoff: i64) -> Result<usize> {
        self.timed("prune", |conn| {
            let spots =
                conn.execute("DELETE FROM spots WHERE received_at < ?1", params![cutoff])?;
            for t in ["announcements", "wwv", "wcy", "talk", "chat"] {
                conn.execute(
                    &format!("DELETE FROM {t} WHERE received_at < ?1"),
                    params![cutoff],
                )?;
            }
            Ok(spots)
        })
    }

    /// Prune everything older than [`Self::DEFAULT_RETENTION_SECS`] relative
    /// to `now`. Called periodically from `src-tauri` so a long-running
    /// session doesn't grow `spots` forever (it previously never did —
    /// verified on a real database: 679,589 rows / 91.7 MB after a single
    /// ~24.5h session).
    pub fn prune_expired(&self, now: i64) -> Result<usize> {
        self.prune(now - Self::DEFAULT_RETENTION_SECS)
    }

    // --- announcements ------------------------------------------------------

    pub fn insert_announce(&self, node_id: &str, a: &Announce, received_at: i64) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO announcements (node_id, received_at, sender, target, text, is_wx)
             VALUES (?1,?2,?3,?4,?5,?6)",
            params![node_id, received_at, a.from, a.to, a.text, a.is_wx as i64],
        )?;
        Ok(conn.last_insert_rowid())
    }

    /// Insert an announcement at an explicit timestamp, skipping exact
    /// duplicates (used when importing `SH/ANN` history). Returns the new row id
    /// or `None` if it was already present.
    pub fn insert_announce_dedup(
        &self,
        node_id: &str,
        a: &Announce,
        received_at: i64,
    ) -> Result<Option<i64>> {
        let conn = self.conn.lock().unwrap();
        let n = conn.execute(
            "INSERT INTO announcements (node_id, received_at, sender, target, text, is_wx)
             SELECT ?1,?2,?3,?4,?5,?6
             WHERE NOT EXISTS (
               SELECT 1 FROM announcements
               WHERE node_id=?1 AND received_at=?2 AND sender=?3 AND text=?5
             )",
            params![node_id, received_at, a.from, a.to, a.text, a.is_wx as i64],
        )?;
        Ok((n > 0).then(|| conn.last_insert_rowid()))
    }

    pub fn recent_announcements(&self, limit: usize) -> Result<Vec<StoredAnnounce>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, node_id, received_at, sender, target, text, is_wx
             FROM announcements ORDER BY received_at DESC, id DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |r| {
            Ok(StoredAnnounce {
                id: r.get(0)?,
                node_id: r.get(1)?,
                received_at: r.get(2)?,
                sender: r.get(3)?,
                target: r.get(4)?,
                text: r.get(5)?,
                is_wx: r.get::<_, i64>(6)? != 0,
            })
        })?;
        rows.collect()
    }

    // --- WWV / WCY ---------------------------------------------------------

    pub fn insert_wwv(&self, node_id: &str, w: &Wwv, received_at: i64) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO wwv (node_id, received_at, sender, hour, sfi, a, k, forecast)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![
                node_id,
                received_at,
                w.from,
                w.hour,
                w.sfi,
                w.a,
                w.k,
                w.forecast
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn recent_wwv(&self, limit: usize) -> Result<Vec<StoredWwv>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, node_id, received_at, sender, hour, sfi, a, k, forecast
             FROM wwv ORDER BY received_at DESC, id DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |r| {
            Ok(StoredWwv {
                id: r.get(0)?,
                node_id: r.get(1)?,
                received_at: r.get(2)?,
                sender: r.get(3)?,
                hour: r.get(4)?,
                sfi: r.get(5)?,
                a: r.get(6)?,
                k: r.get(7)?,
                forecast: r.get(8)?,
            })
        })?;
        rows.collect()
    }

    pub fn insert_wcy(&self, node_id: &str, w: &Wcy, received_at: i64) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO wcy (node_id, received_at, sender, hour, k, expk, a, r, sfi, sa, gmf, aurora)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
            params![
                node_id, received_at, w.from, w.hour, w.k, w.expk, w.a, w.r, w.sfi, w.sa, w.gmf,
                w.aurora
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    // --- talk -------------------------------------------------------------

    pub fn insert_talk(
        &self,
        node_id: &str,
        outgoing: bool,
        peer: &str,
        text: &str,
        received_at: i64,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO talk (node_id, received_at, outgoing, peer, text)
             VALUES (?1,?2,?3,?4,?5)",
            params![
                node_id,
                received_at,
                outgoing as i64,
                peer.to_ascii_uppercase(),
                text
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    /// Recent talk messages, newest first (the UI groups by `peer`).
    pub fn recent_talk(&self, limit: usize) -> Result<Vec<StoredTalk>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, node_id, received_at, outgoing, peer, text
             FROM talk ORDER BY received_at DESC, id DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |r| {
            Ok(StoredTalk {
                id: r.get(0)?,
                node_id: r.get(1)?,
                received_at: r.get(2)?,
                outgoing: r.get::<_, i64>(3)? != 0,
                peer: r.get(4)?,
                text: r.get(5)?,
            })
        })?;
        rows.collect()
    }

    // --- mail ----------------------------------------------------------

    /// Cache (or refresh) a message body read from the node.
    pub fn upsert_mail(&self, node_id: &str, m: &MailMessage, fetched_at: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO mail (node_id, msgno, sender, recipient, subject, posted, body, fetched_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
             ON CONFLICT(node_id, msgno) DO UPDATE SET
               sender=excluded.sender, recipient=excluded.recipient,
               subject=excluded.subject, posted=excluded.posted,
               body=excluded.body, fetched_at=excluded.fetched_at",
            params![
                node_id,
                m.msgno,
                m.from,
                m.to,
                m.subject,
                m.posted,
                m.body,
                fetched_at
            ],
        )?;
        Ok(())
    }

    /// Every message number we have a cached body for on this node — i.e. every
    /// message the operator has opened in the app. Used to keep the directory
    /// list's "read" flags stable across refreshes (the node may keep reporting
    /// a message as unread, especially bulletins).
    pub fn mail_msgnos(&self, node_id: &str) -> Result<Vec<u32>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT msgno FROM mail WHERE node_id=?1")?;
        let rows = stmt.query_map(params![node_id], |r| r.get::<_, u32>(0))?;
        rows.collect::<Result<Vec<_>>>()
    }

    /// Fetch a cached message body.
    pub fn get_mail(&self, node_id: &str, msgno: u32) -> Result<Option<StoredMail>> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT node_id, msgno, sender, recipient, subject, posted, body, fetched_at
             FROM mail WHERE node_id=?1 AND msgno=?2",
            params![node_id, msgno],
            |r| {
                Ok(StoredMail {
                    node_id: r.get(0)?,
                    msgno: r.get(1)?,
                    from: r.get(2)?,
                    to: r.get(3)?,
                    subject: r.get(4)?,
                    posted: r.get(5)?,
                    body: r.get(6)?,
                    fetched_at: r.get(7)?,
                })
            },
        )
        .optional()
    }

    // --- chat ------------------------------------------------------------

    pub fn insert_chat(
        &self,
        node_id: &str,
        outgoing: bool,
        group: &str,
        sender: &str,
        text: &str,
        received_at: i64,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO chat (node_id, received_at, outgoing, chat_group, sender, text)
             VALUES (?1,?2,?3,?4,?5,?6)",
            params![
                node_id,
                received_at,
                outgoing as i64,
                group.to_ascii_uppercase(),
                sender.to_ascii_uppercase(),
                text
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    /// Insert a historic chat row, skipping exact duplicates (for `SH/CHAT`
    /// import). Returns the id, or `None` if already present.
    pub fn insert_chat_dedup(
        &self,
        node_id: &str,
        group: &str,
        sender: &str,
        text: &str,
        received_at: i64,
    ) -> Result<Option<i64>> {
        let conn = self.conn.lock().unwrap();
        let n = conn.execute(
            "INSERT INTO chat (node_id, received_at, outgoing, chat_group, sender, text)
             SELECT ?1,?2,0,?3,?4,?5
             WHERE NOT EXISTS (
               SELECT 1 FROM chat
               WHERE node_id=?1 AND received_at=?2 AND chat_group=?3 AND sender=?4 AND text=?5
             )",
            params![
                node_id,
                received_at,
                group.to_ascii_uppercase(),
                sender.to_ascii_uppercase(),
                text
            ],
        )?;
        Ok((n > 0).then(|| conn.last_insert_rowid()))
    }

    pub fn recent_chat(&self, limit: usize) -> Result<Vec<StoredChat>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, node_id, received_at, outgoing, chat_group, sender, text
             FROM chat ORDER BY received_at DESC, id DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |r| {
            Ok(StoredChat {
                id: r.get(0)?,
                node_id: r.get(1)?,
                received_at: r.get(2)?,
                outgoing: r.get::<_, i64>(3)? != 0,
                group: r.get(4)?,
                sender: r.get(5)?,
                text: r.get(6)?,
            })
        })?;
        rows.collect()
    }

    pub fn recent_wcy(&self, limit: usize) -> Result<Vec<StoredWcy>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, node_id, received_at, sender, hour, k, expk, a, r, sfi, sa, gmf, aurora
             FROM wcy ORDER BY received_at DESC, id DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |r| {
            Ok(StoredWcy {
                id: r.get(0)?,
                node_id: r.get(1)?,
                received_at: r.get(2)?,
                sender: r.get(3)?,
                hour: r.get(4)?,
                k: r.get(5)?,
                expk: r.get(6)?,
                a: r.get(7)?,
                r: r.get(8)?,
                sfi: r.get(9)?,
                sa: r.get(10)?,
                gmf: r.get(11)?,
                aurora: r.get(12)?,
            })
        })?;
        rows.collect()
    }

    fn query(&self, label: &str, sql: &str, p: impl rusqlite::Params) -> Result<Vec<StoredSpot>> {
        self.timed(label, |conn| {
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
        })
    }
}

fn mode_str(m: Mode) -> &'static str {
    match m {
        Mode::Cw => "CW",
        Mode::Ssb => "SSB",
        Mode::Digi => "DIGI",
        Mode::Fm => "FM",
        Mode::Unknown => "UNKNOWN",
    }
}
fn mode_from_str(s: &str) -> Mode {
    match s {
        "CW" => Mode::Cw,
        "SSB" => Mode::Ssb,
        // "FT" is legacy — FT8/FT4 are now folded into DIGI.
        "FT" | "DIGI" => Mode::Digi,
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
        assert_eq!(id, Some(1));

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
    fn prune_expired_uses_default_retention() {
        let store = Store::open_in_memory().unwrap();
        let s = spot("DX de DL1ABC:  14195.0  EA8XYZ  hi   1234Z");
        let now = 2_000_000_000i64;
        store
            .insert_spot("n", &s, now - Store::DEFAULT_RETENTION_SECS - 10)
            .unwrap(); // expired
        store.insert_spot("n", &s, now - 10).unwrap(); // fresh
        assert_eq!(store.prune_expired(now).unwrap(), 1);
        assert_eq!(store.recent_spots(10).unwrap().len(), 1);
    }

    #[test]
    fn dedups_relayed_spots() {
        let store = Store::open_in_memory().unwrap();
        let a = spot("DX de W3LPL:  14195.0  EA8XYZ  nice   1200Z");
        // same spot from node A, then relayed via node B 20s later
        assert_eq!(store.insert_spot("A", &a, 1000).unwrap(), Some(1));
        assert_eq!(store.insert_spot("B", &a, 1020).unwrap(), None);
        // outside the window it is kept
        assert!(store.insert_spot("B", &a, 1200).unwrap().is_some());
        // a different spotter is not a duplicate
        let b = spot("DX de OH2XX:  14195.0  EA8XYZ  hi   1200Z");
        assert!(store.insert_spot("B", &b, 1025).unwrap().is_some());
        assert_eq!(store.recent_spots(10).unwrap().len(), 3);
    }

    #[test]
    fn search_spots_filters() {
        let store = Store::open_in_memory().unwrap();
        store
            .insert_spot("n", &spot("DX de W3LPL:  14195.0  HA5XYZ  hi   1200Z"), 100)
            .unwrap();
        store
            .insert_spot("n", &spot("DX de OH2XX:  7005.0  HA1AB  cw   1201Z"), 200)
            .unwrap();
        store
            .insert_spot(
                "n",
                &spot("DX de W3LPL:  21260.0  DL1ABC  ssb   1202Z"),
                300,
            )
            .unwrap();

        assert_eq!(
            store
                .search_spots(Some("HA"), None, None, None, 10)
                .unwrap()
                .len(),
            2
        );
        assert_eq!(
            store
                .search_spots(Some("HA"), Some("20m"), None, None, 10)
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            store
                .search_spots(None, None, Some("W3"), None, 10)
                .unwrap()
                .len(),
            2
        );
        assert_eq!(
            store
                .search_spots(None, None, None, Some(250), 10)
                .unwrap()
                .len(),
            1
        );
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

    #[test]
    fn announcements_wwv_wcy_roundtrip_and_prune() {
        use crate::parser::{parse_announce, parse_wcy, parse_wwv};
        let store = Store::open_in_memory().unwrap();

        let a = parse_announce("To ALL de OH2BH: test").unwrap();
        store.insert_announce("n", &a, 100).unwrap();
        let w = parse_wwv("WWV de AE5E <21>: SFI=69, A=8, K=2, No Storms -> No Storms").unwrap();
        store.insert_wwv("n", &w, 100).unwrap();
        let c = parse_wcy("WCY de DK0WCY-1 <11> : K=1 expK=0 A=4 R=0 SFI=94 SA=qui GMF=qui Au=no")
            .unwrap();
        store.insert_wcy("n", &c, 300).unwrap();

        assert_eq!(store.recent_announcements(10).unwrap()[0].sender, "OH2BH");

        // dedup import: same content at same time is skipped, new content added
        assert!(store.insert_announce_dedup("n", &a, 100).unwrap().is_none());
        let a2 = parse_announce("To ALL de G3XYZ: different").unwrap();
        assert!(store.insert_announce_dedup("n", &a2, 90).unwrap().is_some());
        assert_eq!(store.recent_announcements(10).unwrap().len(), 2);

        assert_eq!(store.recent_wwv(10).unwrap()[0].sfi, 69);
        assert_eq!(store.recent_wcy(10).unwrap()[0].aurora, "no");

        // prune at 200 drops the announcement + wwv (100), keeps wcy (300)
        store.prune(200).unwrap();
        assert_eq!(store.recent_announcements(10).unwrap().len(), 0);
        assert_eq!(store.recent_wwv(10).unwrap().len(), 0);
        assert_eq!(store.recent_wcy(10).unwrap().len(), 1);
    }

    #[test]
    fn talk_roundtrip() {
        let store = Store::open_in_memory().unwrap();
        store
            .insert_talk("n", false, "g3xyz", "hello", 100)
            .unwrap();
        store
            .insert_talk("n", true, "G3XYZ", "hi back", 101)
            .unwrap();
        let rows = store.recent_talk(10).unwrap();
        assert_eq!(rows.len(), 2);
        assert!(rows[0].outgoing);
        assert_eq!(rows[0].peer, "G3XYZ");
        assert_eq!(rows[1].peer, "G3XYZ"); // lower-cased on insert
        assert_eq!(rows[1].text, "hello");
    }

    #[test]
    fn chat_roundtrip_and_dedup() {
        let store = Store::open_in_memory().unwrap();
        store
            .insert_chat("n", false, "#9000", "g3xyz", "hi", 100)
            .unwrap();
        store
            .insert_chat("n", true, "#9000", "ha5xyz", "hi back", 101)
            .unwrap();
        assert!(store
            .insert_chat_dedup("n", "#9000", "G3XYZ", "hi", 100)
            .unwrap()
            .is_none());
        assert!(store
            .insert_chat_dedup("n", "FOC", "G3XYZ", "new", 90)
            .unwrap()
            .is_some());

        let rows = store.recent_chat(10).unwrap();
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].group, "#9000");
        assert!(rows[0].outgoing);
        store.prune(200).unwrap();
        assert_eq!(store.recent_chat(10).unwrap().len(), 0);
    }

    #[test]
    fn mail_cache_upsert_and_get() {
        use crate::parser::parse_read_message;
        let store = Store::open_in_memory().unwrap();
        let lines: Vec<String> = [
            "Subject: hello",
            "Msg: 7",
            "From: G1TLH",
            "To: ALL",
            "",
            "body text",
        ]
        .iter()
        .map(|s| s.to_string())
        .collect();
        let m = parse_read_message(&lines).unwrap();
        store.upsert_mail("n", &m, 100).unwrap();
        let got = store.get_mail("n", 7).unwrap().unwrap();
        assert_eq!(got.subject, "hello");
        assert_eq!(got.body, "body text");
        assert!(store.get_mail("n", 999).unwrap().is_none());

        store.upsert_mail("n", &m, 100).unwrap(); // re-cache = still one row
        let mut ids = store.mail_msgnos("n").unwrap();
        ids.sort_unstable();
        assert_eq!(ids, vec![7]);
        assert!(store.mail_msgnos("other").unwrap().is_empty());
    }
}
