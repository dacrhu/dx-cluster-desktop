import type { EnrichedSpot, Mode } from "./types";

/**
 * QTH-centred "where is the activity" compass: recent spots binned by bearing
 * from the home station. Each sector reports its spot count and dominant mode
 * so the map can draw a small petal rose. This is the one-point version of the
 * global band-openings layer.
 */

export const ROSE_SECTORS = 12;

/** Fixed order the petal segments stack in (base → tip). */
export const ROSE_MODE_ORDER: Mode[] = ["CW", "SSB", "DIGI", "FM", "UNKNOWN"];

export interface RoseSector {
  /** Sector index, 0 = North, clockwise. */
  index: number;
  count: number;
  dominantMode: Mode;
  /** Per-mode spot counts in this sector, non-zero only, in `ROSE_MODE_ORDER`.
   *  The map stacks these as coloured segments so a digi-heavy sector still
   *  shows its CW / SSB share instead of the whole petal going one colour. */
  modes: { mode: Mode; count: number }[];
  /** Distinct bands seen in this sector, low to high. */
  bands: string[];
}

const BAND_ORDER = [
  "160m",
  "80m",
  "60m",
  "40m",
  "30m",
  "20m",
  "17m",
  "15m",
  "12m",
  "10m",
  "6m",
  "2m",
];

export function bandRose(spots: EnrichedSpot[]): RoseSector[] {
  const sectors: RoseSector[] = Array.from({ length: ROSE_SECTORS }, (_, i) => ({
    index: i,
    count: 0,
    dominantMode: "UNKNOWN" as Mode,
    modes: [],
    bands: [],
  }));
  const modeTally: Record<number, Partial<Record<Mode, number>>> = {};
  const bandSet: Record<number, Set<string>> = {};

  for (const s of spots) {
    const brg = s.dx?.bearing_deg;
    if (brg == null || !Number.isFinite(brg)) continue;
    const i = Math.floor((((brg % 360) + 360) % 360) / (360 / ROSE_SECTORS)) % ROSE_SECTORS;
    const sec = sectors[i];
    sec.count++;
    (modeTally[i] ??= {})[s.mode] = ((modeTally[i] ??= {})[s.mode] ?? 0) + 1;
    if (s.band) (bandSet[i] ??= new Set()).add(s.band);
  }

  for (const sec of sectors) {
    const tally = modeTally[sec.index];
    if (tally) {
      sec.modes = ROSE_MODE_ORDER.filter((m) => (tally[m] ?? 0) > 0).map((m) => ({
        mode: m,
        count: tally[m]!,
      }));
      sec.dominantMode =
        [...sec.modes].sort((a, b) => b.count - a.count)[0]?.mode ?? ("UNKNOWN" as Mode);
    }
    const set = bandSet[sec.index];
    if (set) sec.bands = BAND_ORDER.filter((b) => set.has(b));
  }
  return sectors;
}
