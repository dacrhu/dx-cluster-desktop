import { contours } from "d3-contour";
import { geoDistance, geoInterpolate } from "d3-geo";
import type { LonLat } from "./grid";
import { interpolateMuf, mufAt } from "./muf";
import type { MufStation } from "./types";

/**
 * "Is this band open from my QTH to there?" — a MUF-based estimate, **not** a
 * prediction. The path is cut into 1–3 hops (≤4000 / ≤8000 / longer km); the
 * MUF is read at each hop's control point (hop midpoints) and the *lowest* one
 * limits the path. A band counts as open when its frequency is under ~85 % of
 * that MUF (the usual FOT-ish rule of thumb), marginal up to the MUF itself.
 * Ignores absorption, antennas, power and sporadic-E.
 */

const EARTH_KM = 6371.0088;
/** Open when f ≤ OPEN_FRAC × MUF. */
export const OPEN_FRAC = 0.85;

/** Hops needed for a great-circle path of `km`. */
export function hopCount(km: number): number {
  return km <= 4000 ? 1 : km <= 8000 ? 2 : 3;
}

/** Hop-midpoint control points along the great circle `a → b`. */
export function controlPoints(a: LonLat, b: LonLat): LonLat[] {
  const km = geoDistance(a, b) * EARTH_KM;
  const hops = hopCount(km);
  const interp = geoInterpolate(a, b);
  const pts: LonLat[] = [];
  for (let i = 0; i < hops; i++) pts.push(interp((i + 0.5) / hops) as LonLat);
  return pts;
}

/** Limiting MUF (MHz) of the path `home → target`: the lowest hop-midpoint MUF. */
export function pathMuf(
  home: LonLat,
  target: LonLat,
  date: Date,
  ssn: number,
  stations: MufStation[],
): number {
  let lowest = Infinity;
  for (const p of controlPoints(home, target)) {
    const model = mufAt(p, date, ssn);
    const v = stations.length ? interpolateMuf(stations, p, model).muf : model;
    if (v < lowest) lowest = v;
  }
  return lowest;
}

export type ReachClass = "open" | "marginal" | "closed";

export function reachClass(freqMhz: number, muf: number): ReachClass {
  if (freqMhz <= OPEN_FRAC * muf) return "open";
  if (freqMhz <= muf) return "marginal";
  return "closed";
}

/** Contour thresholds for the `muf / freq` ratio grid: marginal ≥ 1, open ≥ 1/0.85. */
export const REACH_THRESHOLDS = [1, 1 / OPEN_FRAC];

/** Centre frequency (MHz) of a band given its edges in kHz. */
export function bandCenterMhz(lowKhz: number, highKhz: number): number {
  return (lowKhz + highKhz) / 2000;
}

export interface ReachBand {
  /** The `REACH_THRESHOLDS` entry this band starts at (1 = marginal, >1 = open). */
  value: number;
  /** MultiPolygon rings, scaled by `cell` px, ready for an un-projected `geoPath()`. */
  coordinates: number[][][][];
}

/** Filled contour bands from a row-major `muf / freq` ratio grid (`gw × gh`). */
export function reachContours(values: number[], gw: number, gh: number, cell: number): ReachBand[] {
  return contours()
    .size([gw, gh])
    .thresholds(REACH_THRESHOLDS)(values)
    .filter((c) => c.coordinates.length > 0)
    .map((c) => ({
      value: c.value,
      coordinates: c.coordinates.map((poly) =>
        poly.map((ring) => ring.map(([x, y]) => [x * cell, y * cell])),
      ),
    }));
}
