import { ALL_BANDS, ALL_CONTINENTS, type EnrichedSpot } from "./types";

/**
 * Band-activity trend: bucket recent spots by band × DX continent, so the panel
 * can show which band's traffic is picking up or fading toward each part of the
 * world. Pure measured data (the spot stream), no propagation model.
 *
 * "Toward EU / toward NA" = where the *DX* is. The spots are first narrowed to
 * those made by a spotter on the operator's own continent (`from`) — otherwise
 * "40m rising toward NA" is misleading when every skimmer hearing NA also sits
 * in NA and nothing of it is workable from here.
 *
 * The trend is a 15-minute moving average vs. the preceding 15 minutes; the
 * sparkline is the last 2 hours in 15-minute buckets. Both windows are fixed
 * and independent of the global spot age cap.
 */

export const ACT_BUCKET_MIN = 15;
export const ACT_BUCKETS = 8; // 2 hours of history
export const ACT_HISTORY_MIN = ACT_BUCKET_MIN * ACT_BUCKETS;

/** |Δ%| thresholds for the 5-step trend classification. */
const TREND_MILD = 25;
const TREND_STRONG = 100;
/** A cell only counts as a "biggest mover" with at least this much traffic. */
const MOVER_MIN_TOTAL = 4;
const MOVER_MIN_SIDE = 2;

export type Trend = -2 | -1 | 0 | 1 | 2;

export interface BandActivityCell {
  band: string;
  continent: string;
  /** Length `ACT_BUCKETS`, oldest → newest — for the sparkline. */
  buckets: number[];
  /** Spots in the last 15 min. */
  recent: number;
  /** Spots in the 15 min before that. */
  prev: number;
  /** Percent change `recent` vs `prev`; null when there's nothing to compare
   *  against (no prior activity, or a cold cell). */
  deltaPct: number | null;
  trend: Trend;
  /** Spots across the whole 2-hour window (drives the cell's glow). */
  total: number;
  /** Age of the freshest spot in the cell, minutes. */
  lastAgeMin: number | null;
}

export interface BandActivityMatrix {
  /** Bands present, in `ALL_BANDS` order. */
  bands: string[];
  /** DX continents present, in `ALL_CONTINENTS` order. */
  continents: string[];
  cells: Map<string, BandActivityCell>;
  movers: { rising: BandActivityCell[]; falling: BandActivityCell[] };
  /** Spots that fed the matrix (after the `from` filter). */
  sampled: number;
}

export function cellKey(band: string, continent: string): string {
  return `${band}|${continent}`;
}

export function classifyTrend(
  recent: number,
  prev: number,
): { deltaPct: number | null; trend: Trend } {
  if (recent === 0 && prev === 0) return { deltaPct: null, trend: 0 };
  if (prev === 0) return { deltaPct: null, trend: recent >= 3 ? 2 : 1 };
  if (recent === 0) return { deltaPct: -100, trend: prev >= 3 ? -2 : -1 };
  const deltaPct = ((recent - prev) / prev) * 100;
  const mag = Math.abs(deltaPct);
  let trend: Trend = 0;
  if (mag >= TREND_STRONG) trend = deltaPct > 0 ? 2 : -2;
  else if (mag >= TREND_MILD) trend = deltaPct > 0 ? 1 : -1;
  return { deltaPct, trend };
}

/** Sort key for "biggest mover" — real percentage where we have one, else a
 *  large sentinel so brand-new openings still rank near the top. */
function moverMag(c: BandActivityCell): number {
  if (c.deltaPct != null) return Math.abs(c.deltaPct);
  return 150 + c.recent + c.prev;
}

export function bandActivityMatrix(
  spots: EnrichedSpot[],
  from: string | null,
  now = Date.now() / 1000,
): BandActivityMatrix {
  const cutoff = now - ACT_HISTORY_MIN * 60;
  const acc = new Map<string, { buckets: number[]; last: number }>();
  const bandsSeen = new Set<string>();
  const contsSeen = new Set<string>();
  let sampled = 0;

  for (const s of spots) {
    if (!s.band) continue;
    const dxc = s.dx?.continent;
    if (!dxc) continue;
    if (from && s.by?.continent !== from) continue;
    if (s.received_at < cutoff || s.received_at > now + 60) continue;
    const bkt = Math.floor((now - s.received_at) / 60 / ACT_BUCKET_MIN);
    if (bkt < 0 || bkt >= ACT_BUCKETS) continue;

    const key = cellKey(s.band, dxc);
    let e = acc.get(key);
    if (!e) {
      e = { buckets: new Array(ACT_BUCKETS).fill(0), last: 0 };
      acc.set(key, e);
    }
    e.buckets[bkt]++;
    if (s.received_at > e.last) e.last = s.received_at;
    bandsSeen.add(s.band);
    contsSeen.add(dxc);
    sampled++;
  }

  const cells = new Map<string, BandActivityCell>();
  for (const [key, e] of acc) {
    const sep = key.indexOf("|");
    const band = key.slice(0, sep);
    const continent = key.slice(sep + 1);
    const recent = e.buckets[0];
    const prev = e.buckets[1];
    const { deltaPct, trend } = classifyTrend(recent, prev);
    cells.set(key, {
      band,
      continent,
      buckets: [...e.buckets].reverse(), // stored newest-first → sparkline oldest-first
      recent,
      prev,
      deltaPct,
      trend,
      total: e.buckets.reduce((a, b) => a + b, 0),
      lastAgeMin: e.last ? (now - e.last) / 60 : null,
    });
  }

  const bands = ALL_BANDS.filter((b) => bandsSeen.has(b));
  const continents = ALL_CONTINENTS.filter((c) => contsSeen.has(c));

  const movers = [...cells.values()].filter(
    (c) =>
      c.trend !== 0 && c.total >= MOVER_MIN_TOTAL && Math.max(c.recent, c.prev) >= MOVER_MIN_SIDE,
  );
  const rising = movers
    .filter((c) => c.trend > 0)
    .sort((a, b) => moverMag(b) - moverMag(a))
    .slice(0, 3);
  const falling = movers
    .filter((c) => c.trend < 0)
    .sort((a, b) => moverMag(b) - moverMag(a))
    .slice(0, 3);

  return { bands, continents, cells, movers: { rising, falling }, sampled };
}
