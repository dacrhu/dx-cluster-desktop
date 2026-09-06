//! Reading the DX station's transmit ("listening") frequency out of a spot
//! comment, for split operation.
//!
//! Spotters write it as `QSX 14195`, `UP 2`, `up1.5`, `UP 1-3`, `DWN 5`,
//! `DN 3`, `DOWN 2`, or just a bare `UP` (no number). We turn the parseable
//! ones into an absolute TX frequency in kHz; a bare `UP`/`DWN` or a signal
//! report (`QSX 599`) yields `None`.
//!
//! Token-based like [`crate::band::mode_from_comment`]. Mirrored in TS by
//! `src/lib/split.ts::qsxFromComment` — keep the two in lockstep.

use once_cell::sync::Lazy;
use regex::Regex;

use crate::band::band_for_khz;

/// `QSX <freq>` — an explicit absolute frequency (kHz), possibly fractional.
static QSX_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)QSX\s*([0-9]+(?:\.[0-9]+)?)").expect("qsx regex"));

/// `UP`/`DOWN`/`DWN`/`DN` + an optional offset (kHz), possibly a `1-3` range
/// (the trailing number is captured only so the range doesn't confuse parsing —
/// we take the low end). The leading `(?:^|[^A-Za-z])` stops `GROUP` / `PICKUP`
/// matching; no trailing boundary, so `UP2` / `up1.5` still match.
static UPDN_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(?:^|[^A-Za-z])(UP|DOWN|DWN|DN)\s*([0-9]+(?:\.[0-9]+)?)?(?:\s*-\s*[0-9]+(?:\.[0-9]+)?)?")
        .expect("up/down regex")
});

/// The DX's TX frequency in kHz implied by a split / QSX token in `comment`, or
/// `None` when there's no usable hint. `rx_khz` is the spotted (receive)
/// frequency, used to resolve relative offsets.
pub fn qsx_from_comment(comment: &str, rx_khz: f64) -> Option<f64> {
    // Explicit absolute frequency wins, but only if it's a plausible band
    // frequency — `QSX 599` is a signal report, not a QSX.
    if let Some(c) = QSX_RE.captures(comment) {
        if let Ok(v) = c[1].parse::<f64>() {
            if v >= 1800.0 && band_for_khz(v).is_some() {
                return Some(v);
            }
        }
    }

    if let Some(c) = UPDN_RE.captures(comment) {
        let n: f64 = c.get(2)?.as_str().parse().ok()?; // bare UP / DWN → None
        let dir = if c[1].to_ascii_uppercase().starts_with('U') {
            1.0
        } else {
            -1.0
        };
        let tx = rx_khz + dir * n;
        // Guard against a report or a garbled token producing an absurd jump.
        if (tx - rx_khz).abs() <= 50.0 {
            return Some(tx);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn q(comment: &str, rx: f64) -> Option<f64> {
        qsx_from_comment(comment, rx)
    }

    #[test]
    fn relative_offsets() {
        assert_eq!(q("UP 2", 14020.0), Some(14022.0));
        assert_eq!(q("up1.5", 7005.0), Some(7006.5));
        assert_eq!(q("UP 1-3", 14020.0), Some(14021.0)); // low end of the range
        assert_eq!(q("DWN 5", 14200.0), Some(14195.0));
        assert_eq!(q("DN 3", 7100.0), Some(7097.0));
        assert_eq!(q("DOWN 2", 7100.0), Some(7098.0));
        assert_eq!(q("QRV up 2, tnx", 21005.0), Some(21007.0));
    }

    #[test]
    fn absolute_qsx() {
        assert_eq!(q("QSX 14195", 14020.0), Some(14195.0));
        assert_eq!(q("QSX 14195.5", 14020.0), Some(14195.5));
        assert_eq!(q("qsx7178 listening", 7005.0), Some(7178.0));
    }

    #[test]
    fn no_usable_hint() {
        assert_eq!(q("UP", 14020.0), None); // no number
        assert_eq!(q("CQ CW TEST", 14020.0), None);
        assert_eq!(q("GROUP CALL", 14020.0), None); // "UP" inside a word
        assert_eq!(q("QSX 599 TU", 14020.0), None); // signal report, not a QSX
        assert_eq!(q("listening 200 up", 14020.0), None); // bare trailing "up"
        assert_eq!(q("UP 200", 14020.0), None); // > 50 kHz jump → rejected
    }
}
