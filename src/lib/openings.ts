import type { EnrichedSpot, Mode } from "./types";
import type { LonLat } from "./grid";
import { distanceKm, spotLonLat, spotterLonLat } from "./grid";

/**
 * Empirical band-openness: every recent spot is proof that its band is open
 * along the spotter→DX great circle *right now*. Drawn as faint arcs coloured
 * by mode — overlapping paths stack into a heat map of where each band is
 * working. Pure measured data (the spot stream); coverage is biased to where
 * hams are active.
 */

export interface OpeningArc {
  a: LonLat;
  b: LonLat;
  band: string | null;
  mode: Mode;
  /** Age in minutes, for fade. */
  ageMin: number;
}

/** Restrict openings to those heard by a spotter within `radiusKm` of `home`. */
export interface OpeningsNear {
  home: LonLat;
  radiusKm: number;
}

/** Slider max for the "near me" radius — at/above this the filter is a no-op
 *  (it exceeds any possible great-circle distance on Earth, max ≈ 20015 km),
 *  so the UI treats it as "no limit" without needing a separate on/off toggle. */
export const OPENINGS_RADIUS_MAX_KM = 20000;

export function bandOpenings(
  spots: EnrichedSpot[],
  sinceMin = 30,
  near: OpeningsNear | null = null,
): OpeningArc[] {
  const now = Date.now() / 1000;
  const cutoff = now - sinceMin * 60;
  const out: OpeningArc[] = [];
  for (const s of spots) {
    if (s.received_at < cutoff) continue;
    const a = spotterLonLat(s);
    const b = spotLonLat(s);
    if (!a || !b) continue;
    if (near && distanceKm(a, near.home) > near.radiusKm) continue;
    out.push({ a, b, band: s.band, mode: s.mode, ageMin: (now - s.received_at) / 60 });
  }
  return out;
}
