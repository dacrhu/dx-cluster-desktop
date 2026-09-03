import type { LonLat } from "./grid";

/**
 * Auroral-oval overlay for the map, driven by the planetary K index (from
 * WWV/WCY). A centred circular cap around each geomagnetic pole is a rough
 * statistical stand-in for the real (midnight-offset) oval — good enough to
 * show "the poles are lit up, expect absorption on polar paths".
 */

/** Geomagnetic poles, ~2020 epoch (`[lon, lat]`). */
export const GEOMAG_NORTH: LonLat = [-72.7, 80.7];
export const GEOMAG_SOUTH: LonLat = [108.2, -74.5];

/**
 * Equatorward edge of the auroral oval as a colatitude (degrees from the
 * geomagnetic pole): ~18° in quiet conditions (K0) widening to ~35° during a
 * severe storm (K9), when aurora is seen down to ~mid latitudes.
 */
export function auroraColatitude(k: number): number {
  const kk = Math.max(0, Math.min(9, k));
  return 18 + kk * 1.9;
}

export interface AuroraOval {
  center: LonLat;
  /** d3 `geoCircle` radius, in degrees. */
  radius: number;
}

/** North + south oval caps for a given K index. */
export function auroraOvals(k: number): AuroraOval[] {
  const radius = auroraColatitude(k);
  return [
    { center: GEOMAG_NORTH, radius },
    { center: GEOMAG_SOUTH, radius },
  ];
}
