import { BANDMAP_BANDS } from "./bands";

/**
 * Read the DX station's transmit ("listening") frequency out of a spot comment,
 * for split operation. Spotters write it as `QSX 14195`, `UP 2`, `up1.5`,
 * `UP 1-3`, `DWN 5`, `DN 3`, `DOWN 2`, or a bare `UP` with no number.
 *
 * Returns the absolute TX frequency in kHz, or `null` when there's no usable
 * hint (a bare `UP`/`DWN`, or a signal report like `QSX 599`).
 *
 * Mirror of Rust `crates/dxcluster-core/src/split.rs::qsx_from_comment` — keep
 * the two in lockstep.
 */
const QSX_RE = /QSX\s*(\d+(?:\.\d+)?)/i;
const UPDN_RE = /(?:^|[^A-Za-z])(UP|DOWN|DWN|DN)\s*(\d+(?:\.\d+)?)?(?:\s*-\s*\d+(?:\.\d+)?)?/i;

function inSomeBand(khz: number): boolean {
  return BANDMAP_BANDS.some((b) => khz >= b.lowKhz && khz <= b.highKhz);
}

export function qsxFromComment(comment: string, rxKhz: number): number | null {
  const qsx = QSX_RE.exec(comment);
  if (qsx) {
    const v = Number(qsx[1]);
    if (Number.isFinite(v) && v >= 1800 && inSomeBand(v)) return v;
  }

  const rel = UPDN_RE.exec(comment);
  if (rel && rel[2] != null) {
    const n = Number(rel[2]);
    if (Number.isFinite(n)) {
      const dir = rel[1].toUpperCase().startsWith("U") ? 1 : -1;
      const tx = rxKhz + dir * n;
      if (Math.abs(tx - rxKhz) <= 50) return tx;
    }
  }

  return null;
}
