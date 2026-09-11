import { geoDistance } from "d3-geo";
import type { EnrichedSpot } from "./types";

/** `[lon, lat]` — the order d3-geo wants. */
export type LonLat = [number, number];

/** Earth radius, km — matches `crates/dxcluster-core/src/reference/geo.rs::EARTH_RADIUS_KM`. */
export const EARTH_RADIUS_KM = 6371.0088;

/** Great-circle distance between two `[lon, lat]` points, km. */
export function distanceKm(a: LonLat, b: LonLat): number {
  return geoDistance(a, b) * EARTH_RADIUS_KM;
}

/**
 * Maidenhead locator (4 / 6 / 8 chars) → `[lon, lat]` of the square centre.
 * Port of `crates/dxcluster-core/src/reference/geo.rs::locator_to_latlon`.
 */
export function locatorToLonLat(grid: string): LonLat | null {
  const g = grid.trim().toUpperCase();
  if (!(g.length === 4 || g.length === 6 || g.length === 8)) return null;
  const c = (i: number) => g.charCodeAt(i);

  const fLon = c(0) - 65;
  const fLat = c(1) - 65;
  if (fLon < 0 || fLon > 17 || fLat < 0 || fLat > 17) return null;
  if (g[2] < "0" || g[2] > "9" || g[3] < "0" || g[3] > "9") return null;

  let lon = fLon * 20 + (c(2) - 48) * 2 - 180;
  let lat = fLat * 10 + (c(3) - 48) * 1 - 90;
  let lonSize = 2;
  let latSize = 1;

  if (g.length >= 6) {
    const sLon = c(4);
    const sLat = c(5);
    if (sLon < 65 || sLon > 88 || sLat < 65 || sLat > 88) return null;
    lon += (sLon - 65) * (2 / 24);
    lat += (sLat - 65) * (1 / 24);
    lonSize = 2 / 24;
    latSize = 1 / 24;
  }
  if (g.length === 8) {
    if (g[6] < "0" || g[6] > "9" || g[7] < "0" || g[7] > "9") return null;
    lon += (c(6) - 48) * (2 / 24 / 10);
    lat += (c(7) - 48) * (1 / 24 / 10);
    lonSize = 2 / 24 / 10;
    latSize = 1 / 24 / 10;
  }
  return [lon + lonSize / 2, lat + latSize / 2];
}

/**
 * Strip portable prefixes/suffixes to the "real" callsign, mirroring
 * `cty.rs::base_call` (`DL/HA5XYZ/P` → `HA5XYZ`, `S53A-#` → `S53A`).
 */
export function baseCall(call: string): string {
  const noSsid = call.split("-")[0];
  const parts = noSsid.split("/").filter(Boolean);
  if (parts.length <= 1) return noSsid.toUpperCase();
  // The longest part is the operator's own call; a trailing 1-3 char token is a
  // suffix (P, MM, QRP, 9), a short leading token is a prefix.
  const longest = parts.reduce((a, b) => (b.length > a.length ? b : a));
  return longest.toUpperCase();
}

/**
 * Small deterministic per-callsign offset (degrees) so stations that fall back
 * to the same DXCC centroid (no grid on the spot) don't all stack on the exact
 * same pixel — and don't sit exactly under the country's prefix label. Same
 * input always gives the same offset, so a station's dot stays put across
 * re-renders.
 */
function jitterDeg(seed: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h >>>= 0;
  const angle = ((h % 3600) / 3600) * Math.PI * 2;
  const radius = 0.35 + (((h >>> 12) % 1000) / 1000) * 0.55; // 0.35°–0.9°
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function jitteredCentroid(lon: number, lat: number, seed: string): LonLat {
  const [dLon, dLat] = jitterDeg(seed);
  const lonScale = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  return [lon + dLon / lonScale, lat + dLat];
}

/** Best available position for a spotted station: its grid square (exact), else
 *  the DXCC-entity centroid from cty.dat, jittered by callsign. `null` when
 *  neither is known. */
export function spotLonLat(s: EnrichedSpot): LonLat | null {
  if (s.grid) {
    const g = locatorToLonLat(s.grid);
    if (g) return g;
  }
  return s.dx ? jitteredCentroid(s.dx.lon, s.dx.lat, s.dx_call) : null;
}

/** Position of the spotter / skimmer. The backend already resolves this to the
 *  skimmer's real grid (`rbn_skimmers.tsv`) or a PSK Reporter receiver's exact
 *  locator where known, else the DXCC-entity centroid; either way it's jittered
 *  by spotter callsign so co-located skimmers / ops don't stack on one pixel. */
export function spotterLonLat(s: EnrichedSpot): LonLat | null {
  return s.by ? jitteredCentroid(s.by.lon, s.by.lat, s.spotter_base) : null;
}
