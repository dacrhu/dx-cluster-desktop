import { contours } from "d3-contour";
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

/** Filled-contour band edges (MHz) — the `MUF_SCALE` step boundaries, plus 0 so
 *  the "closed" zone gets its own filled band too. */
export const MUF_THRESHOLDS = [0, 7, 10, 14, 18, 21, 28];

export interface MufBand {
  /** Lower MHz bound of the band (one of `MUF_THRESHOLDS`). */
  value: number;
  /** Fill / stroke colour (the `MUF_SCALE` bucket at this value). */
  color: string;
  /** GeoJSON MultiPolygon rings, scaled by `cell` (px), ready for `geoPath()`. */
  coordinates: number[][][][];
}

/**
 * Filled MUF contour bands from a row-major `values` grid (`gw × gh`, MHz) via
 * marching squares (`d3-contour`). Ring coordinates are scaled by `cell` — the
 * grid pitch in screen px — so they render straight through an un-projected
 * `geoPath()`. Bands come back low → high; drawn in that order each higher band
 * paints over the previous one, giving a clean choropleth (no alpha stacking).
 * Empty thresholds are dropped.
 */
export function mufContours(values: number[], gw: number, gh: number, cell = 1): MufBand[] {
  return contours()
    .size([gw, gh])
    .thresholds(MUF_THRESHOLDS)(values)
    .filter((c) => c.coordinates.length > 0)
    .map((c) => ({
      value: c.value,
      color: mufColor(c.value),
      coordinates:
        cell === 1
          ? (c.coordinates as number[][][][])
          : c.coordinates.map((poly) =>
              poly.map((ring) => ring.map(([x, y]) => [x * cell, y * cell])),
            ),
    }));
}

export interface MufLabel {
  /** Anchor in the same px space as `mufContours` (grid px × `cell`). */
  x: number;
  y: number;
  /** Lower MHz bound of the band this region sits in (a `MUF_THRESHOLDS` entry). */
  value: number;
}

/** Which `MUF_THRESHOLDS` band a MUF value falls in (index, 0 = "<7 / closed"). */
function bandIndex(v: number): number {
  let k = 0;
  for (let t = 1; t < MUF_THRESHOLDS.length; t++) if (v >= MUF_THRESHOLDS[t]) k = t;
  return k;
}

/**
 * One label anchor per sizeable contiguous MUF band on the sampled `values`
 * grid (4-connected components). The closed `<7 MHz` band (index 0) is skipped.
 * The anchor is the component's *most interior* cell — the one farthest (in
 * grid steps) from any edge of the region — with the centroid distance as a
 * tie-break, so the number sits in the meat of its band, not on a boundary
 * with the neighbouring one. Coords scaled by `cell` like `mufContours`.
 */
export function mufBandLabels(
  values: number[],
  gw: number,
  gh: number,
  cell = 1,
  minCells = 6,
): MufLabel[] {
  const band = values.map(bandIndex);
  const seen = new Uint8Array(gw * gh);
  const out: MufLabel[] = [];
  const neighbours = (p: number): number[] => {
    const px = p % gw;
    const py = (p / gw) | 0;
    return [
      px + 1 < gw ? p + 1 : -1,
      px - 1 >= 0 ? p - 1 : -1,
      py + 1 < gh ? p + gw : -1,
      py - 1 >= 0 ? p - gw : -1,
    ];
  };
  for (let start = 0; start < band.length; start++) {
    if (seen[start] || band[start] < 1) continue;
    const b = band[start];
    const members: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop() as number;
      members.push(p);
      for (const np of neighbours(p)) {
        if (np < 0 || seen[np] || band[np] !== b) continue;
        seen[np] = 1;
        stack.push(np);
      }
    }
    if (members.length < minCells) continue;

    let sx = 0;
    let sy = 0;
    for (const m of members) {
      sx += m % gw;
      sy += (m / gw) | 0;
    }
    const cx = sx / members.length;
    const cy = sy / members.length;

    // Distance transform: BFS inward from every edge cell (a member touching
    // the grid border or a cell of another band). `depth` = steps to the edge.
    const depth = new Map<number, number>();
    const queue: number[] = [];
    for (const m of members) {
      const nb = neighbours(m);
      if (nb.some((np) => np < 0 || band[np] !== b)) {
        depth.set(m, 1);
        queue.push(m);
      }
    }
    for (let head = 0; head < queue.length; head++) {
      const p = queue[head];
      const d = depth.get(p) as number;
      for (const np of neighbours(p)) {
        if (np < 0 || band[np] !== b || depth.has(np)) continue;
        depth.set(np, d + 1);
        queue.push(np);
      }
    }

    let best = members[0];
    let bestScore = -Infinity;
    for (const m of members) {
      const d = depth.get(m) ?? 1;
      const centreD = Math.hypot((m % gw) - cx, ((m / gw) | 0) - cy);
      const score = d * 100 - centreD; // deepest wins; centre breaks ties
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    out.push({ x: (best % gw) * cell, y: ((best / gw) | 0) * cell, value: MUF_THRESHOLDS[b] });
  }
  return out;
}
