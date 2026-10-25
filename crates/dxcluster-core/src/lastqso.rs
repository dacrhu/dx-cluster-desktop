//! "Last QSO" — the most recent contact from the operator's logger, so the
//! post-a-spot form can be pre-filled with one click instead of copy/paste.
//!
//! Three feeds produce a [`LastQso`]: WSJT-X `QSO Logged` / `Logged ADIF` UDP
//! messages (see [`crate::wsjtx`]), a bare ADIF record in a UDP datagram, and
//! the tail of an ADIF file ([`last_from_adif_file`]). This module owns the
//! ADIF side.

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct LastQso {
    pub call: String,
    pub freq_khz: Option<f64>,
    pub mode: Option<String>,
    pub band: Option<String>,
    /// ADIF `SUBMODE` (e.g. `FT4` under `MODE=MFSK`), only when the log defines it.
    pub submode: Option<String>,
}

/// A UDP datagram from a logger: QLog's "QSO Changes" JSON envelope
/// (`{"msgtype":"qso","data":{"operation":"insert","type":"adif","value":"<call:…"}}`,
/// deletes ignored) or a bare ADIF record.
pub fn parse_datagram(text: &str) -> Option<LastQso> {
    let t = text.trim_start();
    if t.starts_with('{') {
        let v: serde_json::Value = serde_json::from_str(t).ok()?;
        let data = v.get("data")?;
        if data.get("operation").and_then(|o| o.as_str()) == Some("delete") {
            return None;
        }
        return parse_adif_records(data.get("value")?.as_str()?).pop();
    }
    parse_adif_records(t).pop()
}

/// How much of the end of an ADIF file we look at for the last record.
const TAIL_BYTES: u64 = 64 * 1024;

/// Parse every `<EOR>`-terminated record of `text` that has a `CALL`. ADIF
/// `FREQ` is MHz; the result is kHz.
pub fn parse_adif_records(text: &str) -> Vec<LastQso> {
    let upper = text.to_ascii_uppercase();
    let mut out = Vec::new();
    let mut call = None;
    let mut freq_khz = None;
    let mut mode = None;
    let mut band = None;
    let mut submode = None;
    let mut pos = 0;
    while let Some(rel) = text[pos..].find('<') {
        let start = pos + rel;
        let Some(end_rel) = text[start..].find('>') else {
            break;
        };
        let end = start + end_rel;
        let tag = &upper[start + 1..end];
        pos = end + 1;
        if tag == "EOR" {
            if let Some(c) = call.take() {
                out.push(LastQso {
                    call: c,
                    freq_khz: freq_khz.take(),
                    mode: mode.take(),
                    band: band.take(),
                    submode: submode.take(),
                });
            }
            freq_khz = None;
            mode = None;
            band = None;
            submode = None;
            continue;
        }
        let mut parts = tag.split(':');
        let name = parts.next().unwrap_or("");
        let Some(len) = parts.next().and_then(|l| l.parse::<usize>().ok()) else {
            continue; // <EOH> and friends
        };
        let Some(raw) = text.get(pos..pos + len) else {
            break;
        };
        pos += len;
        let v = raw.trim();
        match name {
            "CALL" if !v.is_empty() => call = Some(v.to_ascii_uppercase()),
            "FREQ" => freq_khz = v.parse::<f64>().ok().map(|mhz| mhz * 1000.0),
            "MODE" if !v.is_empty() => mode = Some(v.to_ascii_uppercase()),
            "SUBMODE" if !v.is_empty() => submode = Some(v.to_ascii_uppercase()),
            "BAND" if !v.is_empty() => band = Some(v.to_ascii_lowercase()),
            _ => {}
        }
    }
    out
}

/// The last record of the ADIF file at `path`, reading only its tail.
pub fn last_from_adif_file(path: &Path) -> std::io::Result<Option<LastQso>> {
    let mut f = File::open(path)?;
    let len = f.metadata()?.len();
    let start = len.saturating_sub(TAIL_BYTES);
    f.seek(SeekFrom::Start(start))?;
    let mut bytes = Vec::new();
    f.read_to_end(&mut bytes)?;
    let mut text: String = bytes.iter().map(|&b| b as char).collect(); // Latin-1 safe
    if start > 0 {
        // The window may begin mid-record; drop everything up to the first <EOR>.
        let idx = text.to_ascii_uppercase().find("<EOR>").map(|i| i + 5);
        text = idx.map(|i| text[i..].to_string()).unwrap_or_default();
    }
    Ok(parse_adif_records(&text).pop())
}

#[cfg(test)]
mod tests {
    use super::*;

    const LOG: &str = "ADIF export\n<ADIF_VER:5>3.1.4\n<EOH>\n\
<CALL:5>DL1AB <FREQ:8>14.07400 <MODE:4>MFSK <SUBMODE:3>FT4 <BAND:3>20M <EOR>\n\
<call:6>JA1XYZ<qso_date:8>20260101<freq:6>7.0305<mode:2>CW<eor>\n";

    #[test]
    fn parses_records_and_converts_mhz_to_khz() {
        let r = parse_adif_records(LOG);
        assert_eq!(r.len(), 2);
        assert_eq!(r[0].call, "DL1AB");
        assert_eq!(r[0].freq_khz, Some(14074.0));
        assert_eq!(r[0].mode.as_deref(), Some("MFSK"));
        assert_eq!(r[0].submode.as_deref(), Some("FT4"));
        assert_eq!(r[0].band.as_deref(), Some("20m"));
        assert_eq!(r[1].call, "JA1XYZ");
        assert_eq!(r[1].freq_khz, Some(7030.5));
    }

    #[test]
    fn qlog_json_notification() {
        let j = r#"{"appid":"QLog","msgtype":"qso","time":1,"logid":"x","data":{"operation":"insert","rowid":3,"type":"adif","value":"<call:5>K1ABC<qso_date:8:D>20260101<freq:6>14.025<eor>"}}"#;
        let q = parse_datagram(j).unwrap();
        assert_eq!(q.call, "K1ABC");
        assert_eq!(q.freq_khz, Some(14025.0));
        assert!(parse_datagram(&j.replace("insert", "delete")).is_none());
        assert_eq!(parse_datagram("<CALL:3>AB1<EOR>").unwrap().call, "AB1");
    }

    #[test]
    fn bare_partial_record_and_missing_call() {
        let r = parse_adif_records("<CALL:5>K1ABC<FREQ:6>14.025<EOR>");
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].freq_khz, Some(14025.0));
        assert!(parse_adif_records("<FREQ:6>14.025<EOR>").is_empty());
        assert!(parse_adif_records("junk").is_empty());
    }

    #[test]
    fn reads_last_record_from_file() {
        let dir = std::env::temp_dir().join(format!("dxcd-adif-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let p = dir.join("log.adi");
        std::fs::write(&p, LOG).unwrap();
        let q = last_from_adif_file(&p).unwrap().unwrap();
        assert_eq!(q.call, "JA1XYZ");
        assert!(last_from_adif_file(&dir.join("nope.adi")).is_err());
        std::fs::remove_dir_all(&dir).ok();
    }
}
