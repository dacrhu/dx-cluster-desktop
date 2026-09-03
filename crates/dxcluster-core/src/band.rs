//! Frequency helpers: map a spot frequency (in kHz) to a ham band, and make a
//! coarse guess at the operating mode from the frequency and the spot comment.
//!
//! These are deliberately simple heuristics — DX cluster spots do not carry a
//! structured mode field, so the UI treats the result as a hint, not truth.

use serde::{Deserialize, Serialize};

/// A ham radio band, identified by its common wavelength label.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Band {
    /// e.g. `"20m"`, `"70cm"`.
    pub label: &'static str,
    /// Inclusive lower bound in kHz.
    pub low_khz: f64,
    /// Inclusive upper bound in kHz.
    pub high_khz: f64,
}

/// All bands we recognise, ordered low to high. Ranges follow the widest common
/// allocation so spots near band edges still classify.
pub const BANDS: &[Band] = &[
    Band {
        label: "2200m",
        low_khz: 135.7,
        high_khz: 137.8,
    },
    Band {
        label: "630m",
        low_khz: 472.0,
        high_khz: 479.0,
    },
    Band {
        label: "160m",
        low_khz: 1800.0,
        high_khz: 2000.0,
    },
    Band {
        label: "80m",
        low_khz: 3500.0,
        high_khz: 4000.0,
    },
    Band {
        label: "60m",
        low_khz: 5250.0,
        high_khz: 5450.0,
    },
    Band {
        label: "40m",
        low_khz: 7000.0,
        high_khz: 7300.0,
    },
    Band {
        label: "30m",
        low_khz: 10100.0,
        high_khz: 10150.0,
    },
    Band {
        label: "20m",
        low_khz: 14000.0,
        high_khz: 14350.0,
    },
    Band {
        label: "17m",
        low_khz: 18068.0,
        high_khz: 18168.0,
    },
    Band {
        label: "15m",
        low_khz: 21000.0,
        high_khz: 21450.0,
    },
    Band {
        label: "12m",
        low_khz: 24890.0,
        high_khz: 24990.0,
    },
    Band {
        label: "10m",
        low_khz: 28000.0,
        high_khz: 29700.0,
    },
    Band {
        label: "6m",
        low_khz: 50000.0,
        high_khz: 54000.0,
    },
    Band {
        label: "4m",
        low_khz: 70000.0,
        high_khz: 70500.0,
    },
    Band {
        label: "2m",
        low_khz: 144000.0,
        high_khz: 148000.0,
    },
    Band {
        label: "1.25m",
        low_khz: 222000.0,
        high_khz: 225000.0,
    },
    Band {
        label: "70cm",
        low_khz: 420000.0,
        high_khz: 450000.0,
    },
    Band {
        label: "33cm",
        low_khz: 902000.0,
        high_khz: 928000.0,
    },
    Band {
        label: "23cm",
        low_khz: 1240000.0,
        high_khz: 1300000.0,
    },
    Band {
        label: "13cm",
        low_khz: 2300000.0,
        high_khz: 2450000.0,
    },
    Band {
        label: "9cm",
        low_khz: 3300000.0,
        high_khz: 3500000.0,
    },
    Band {
        label: "6cm",
        low_khz: 5650000.0,
        high_khz: 5925000.0,
    },
    Band {
        label: "3cm",
        low_khz: 10000000.0,
        high_khz: 10500000.0,
    },
];

/// Return the band label for a frequency in kHz, or `None` if it falls outside
/// every known allocation.
pub fn band_for_khz(khz: f64) -> Option<&'static str> {
    BANDS
        .iter()
        .find(|b| khz >= b.low_khz && khz <= b.high_khz)
        .map(|b| b.label)
}

/// Coarse operating mode guess.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Mode {
    Cw,
    Ssb,
    /// FT8/FT4/JT and other weak-signal digital.
    Ft,
    /// RTTY/PSK and other keyboard digital.
    Digi,
    Fm,
    Unknown,
}

/// Tokens that appear in spot comments and pin the mode unambiguously.
fn mode_from_comment(comment: &str) -> Option<Mode> {
    let c = comment.to_ascii_uppercase();
    // Order matters: check the more specific tokens first.
    const FT: [&str; 4] = ["FT8", "FT4", "JT65", "JT9"];
    const DIGI: [&str; 6] = ["RTTY", "PSK31", "PSK63", "PSK", "OLIVIA", "MFSK"];
    const CW: [&str; 2] = ["CW", "MORSE"];
    const SSB: [&str; 4] = ["SSB", "LSB", "USB", "PHONE"];
    const FM: [&str; 2] = ["FM", "C4FM"];
    if FT.iter().any(|t| c.contains(t)) {
        return Some(Mode::Ft);
    }
    if DIGI.iter().any(|t| c.contains(t)) {
        return Some(Mode::Digi);
    }
    if FM.iter().any(|t| c.contains(t)) {
        return Some(Mode::Fm);
    }
    if CW.iter().any(|t| c.contains(t)) {
        return Some(Mode::Cw);
    }
    if SSB.iter().any(|t| c.contains(t)) {
        return Some(Mode::Ssb);
    }
    None
}

/// Well-known FT8 dial frequencies (kHz). A spot within 3 kHz is treated as FT8.
const FT8_DIALS: &[f64] = &[
    1840.0, 3573.0, 5357.0, 7074.0, 10136.0, 14074.0, 18100.0, 21074.0, 24915.0, 28074.0, 50313.0,
    50323.0, 70154.0, 144174.0,
];

/// Guess the mode from a frequency in kHz plus the spot comment. The comment
/// wins when it carries an explicit token.
pub fn guess_mode(khz: f64, comment: &str) -> Mode {
    if let Some(m) = mode_from_comment(comment) {
        return m;
    }
    if FT8_DIALS.iter().any(|d| (d - khz).abs() <= 3.0) {
        return Mode::Ft;
    }
    // Sub-band heuristic: the lowest slice of each HF band is CW, then a digital
    // slice, then phone. Expressed as kHz offset from the band's lower edge.
    let Some(band) = BANDS.iter().find(|b| khz >= b.low_khz && khz <= b.high_khz) else {
        return Mode::Unknown;
    };
    let offset = khz - band.low_khz;
    match band.label {
        // HF bands with a conventional CW / digital / phone layout.
        "160m" | "80m" | "40m" | "20m" | "17m" | "15m" | "12m" | "10m" => {
            if offset < 30.0 {
                Mode::Cw
            } else if offset < 100.0 {
                Mode::Digi
            } else {
                Mode::Ssb
            }
        }
        // CW/digital-only narrow bands.
        "30m" | "2200m" | "630m" | "60m" => {
            if offset < 20.0 {
                Mode::Cw
            } else {
                Mode::Digi
            }
        }
        // VHF/UHF: CW/weak-signal at the bottom, FM higher up.
        "6m" | "4m" | "2m" | "1.25m" | "70cm" => {
            if offset < 200.0 {
                Mode::Cw
            } else {
                Mode::Fm
            }
        }
        _ => Mode::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_common_bands() {
        assert_eq!(band_for_khz(14205.0), Some("20m"));
        assert_eq!(band_for_khz(7005.0), Some("40m"));
        assert_eq!(band_for_khz(1825.0), Some("160m"));
        assert_eq!(band_for_khz(144300.0), Some("2m"));
        assert_eq!(band_for_khz(432100.0), Some("70cm"));
    }

    #[test]
    fn rejects_out_of_band() {
        assert_eq!(band_for_khz(12000.0), None);
        assert_eq!(band_for_khz(0.0), None);
    }

    #[test]
    fn comment_tokens_win() {
        assert_eq!(guess_mode(14205.0, "CQ CW"), Mode::Cw);
        assert_eq!(guess_mode(14074.0, "calling CQ SSB"), Mode::Ssb);
        assert_eq!(guess_mode(7005.0, "RTTY contest"), Mode::Digi);
    }

    #[test]
    fn ft8_dial_detected() {
        assert_eq!(guess_mode(14074.0, "-12 dB"), Mode::Ft);
        assert_eq!(guess_mode(7074.0, ""), Mode::Ft);
    }

    #[test]
    fn subband_heuristic() {
        assert_eq!(guess_mode(14010.0, ""), Mode::Cw);
        assert_eq!(guess_mode(14085.0, ""), Mode::Digi);
        assert_eq!(guess_mode(14250.0, ""), Mode::Ssb);
    }
}
