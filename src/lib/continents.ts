import type { LonLat } from "./grid";

/**
 * Very rough continent of a point, by bounding box. Coarse on purpose — its
 * only job is to seed the Band Activity panel's default "from" continent from
 * the operator's QTH; the panel lets the user override it. Boxes are checked in
 * order, so an earlier match wins where they overlap.
 */
export function lonLatToContinent(ll: LonLat | null): string | null {
  if (!ll) return null;
  const lat = ll[1];
  const lon = ((((ll[0] + 180) % 360) + 360) % 360) - 180; // → -180..180

  if (lat < -60) return "AN";

  // Europe, incl. European Russia to the Urals. Cut the SE corner (Turkey /
  // Caucasus / Levant) off to Asia, and stay north of the Mediterranean.
  if (lon >= -25 && lon <= 60 && lat >= 34 && lat <= 82 && !(lon >= 28 && lat < 41)) {
    return "EU";
  }

  // North America — mainland + Central America + Greenland + the Caribbean,
  // plus the Alaska / Aleutian wrap on the far side of the antimeridian.
  if (lon >= -170 && lon <= -50 && lat >= 7 && lat <= 84) return "NA";
  if (lon <= -140 && lat >= 15 && lat <= 74) return "NA";

  if (lon >= -93 && lon <= -32 && lat >= -60 && lat < 14) return "SA";

  if (lon >= -30 && lon <= 52 && lat >= -40 && lat < 38) return "AF";

  // Oceania — Australia / NZ / the Pacific, both sides of the antimeridian.
  if (lon >= 110 && lat >= -50 && lat <= 12) return "OC";
  if (lon <= -120 && lat >= -50 && lat <= 12) return "OC";

  // Everything else in the eastern hemisphere falls to Asia.
  if (lon >= 25 && lat >= -12 && lat <= 82) return "AS";

  return null;
}
