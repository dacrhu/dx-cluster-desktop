import type { LonLat } from "./grid";
import type { MufStation } from "./types";
import { subsolarPoint, angularSepDeg } from "./grayline";

/**
 * A smooth, model-based midpoint-MUF field for the map — **not** a real
 * prediction. It takes only the sunspot number (from the cluster's WWV/WCY
 * broadcast) plus Sun geometry, so it renders offline with no external data.
 * No sporadic-E, no storms, no seasonal anomaly; treat it as "roughly how high
 * the bands should open where the Sun is up", ±a band.
 */

/** Rough sunspot number from the 10.7 cm solar flux, when no WCY `R` is known. */
export function sfiToSsn(sfi: number | undefined | null): number {
  if (sfi == null || !Number.isFinite(sfi)) return 0;
  return Math.max(0, (sfi - 63.7) / 0.728);
}

/**
 * Estimated MUF(3000 km) in MHz for the ionosphere above `ll` at `date`,
 * driven by sunspot number `ssn`.
 */
export function mufAt(ll: LonLat, date: Date, ssn: number): number {
  const zenith = angularSepDeg(ll, subsolarPoint(date)); // 0 = Sun overhead
  const day = Math.max(0, Math.cos((zenith * Math.PI) / 180)); // 1 under the Sun, 0 past the terminator
  const solar = 1 + Math.max(0, ssn) / 250; // ~1 at min, ~2 at ssn 250
  const foF2 = (2.4 + 5.8 * Math.sqrt(day)) * solar; // MHz: ~2.4 night, ~8 day, ×solar
  return 3.0 * foF2; // M(3000)F2 factor ≈ 3
}

export interface MufCell {
  ll: LonLat;
  muf: number;
}

/** Sample `mufAt` on a lon/lat grid for a dot-field overlay. */
export function mufGrid(date: Date, ssn: number, stepDeg = 9): MufCell[] {
  const out: MufCell[] = [];
  for (let lat = -80; lat <= 80; lat += stepDeg) {
    for (let lon = -180; lon < 180; lon += stepDeg) {
      const ll: LonLat = [lon, lat];
      out.push({ ll, muf: mufAt(ll, date, ssn) });
    }
  }
  return out;
}

/** MUF colour scale, low → high; `from` is the lower MHz bound of each step. */
export const MUF_SCALE: { color: string; from: number; label: string }[] = [
  { color: "#b91c1c", from: 0, label: "<7" }, // 80 m / closed
  { color: "#ef4444", from: 7, label: "7" }, // 40 m
  { color: "#f97316", from: 10, label: "10" }, // 30 m
  { color: "#f59e0b", from: 14, label: "14" }, // 20 m
  { color: "#eab308", from: 18, label: "18" }, // 17 m
  { color: "#84cc16", from: 21, label: "21" }, // 15 m
  { color: "#22c55e", from: 28, label: "28+" }, // 10 m and up
];

/**
 * Blend measured ionosonde MUFD (kc2g / GIRO) with the model estimate: an
 * inverse-distance weighting of nearby stations (weight = confidence × a
 * Gaussian in angular distance), fading to `model` where coverage is thin.
 * `coverage` 0..1 says how measurement-backed the result is (drives the map
 * dot's opacity). With no stations it's just the model.
 */
export function interpolateMuf(
  stations: MufStation[],
  ll: LonLat,
  model: number,
): { muf: number; coverage: number } {
  const SCALE = 12; // degrees; ~1300 km e-folding
  let wsum = 0;
  let vsum = 0;
  for (const s of stations) {
    const d = angularSepDeg(ll, [s.lon, s.lat]);
    if (d > 45) continue;
    const w = (Math.max(0, Math.min(100, s.cs)) / 100) * Math.exp(-((d / SCALE) ** 2));
    wsum += w;
    vsum += w * s.mufd;
  }
  if (wsum <= 0) return { muf: model, coverage: 0 };
  const measured = vsum / wsum;
  const coverage = 1 - Math.exp(-wsum / 0.4);
  return { muf: measured * coverage + model * (1 - coverage), coverage };
}

/** Colour bucket for a MUF value — keyed to the band it would open. */
export function mufColor(muf: number): string {
  let c = MUF_SCALE[0].color;
  for (const step of MUF_SCALE) if (muf >= step.from) c = step.color;
  return c;
}
