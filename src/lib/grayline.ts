import type { LonLat } from "./grid";

const RAD = Math.PI / 180;

/**
 * The sub-solar point — `[lon, lat]` where the Sun is directly overhead at
 * `date` (UTC). Low-precision astronomy (NOAA-style), good to well under a
 * degree, which is plenty for a grayline overlay.
 */
export function subsolarPoint(date: Date): LonLat {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0; // days since J2000.0

  const meanLon = (280.46 + 0.9856474 * n) % 360;
  const meanAnom = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const eclLon = (meanLon + 1.915 * Math.sin(meanAnom) + 0.02 * Math.sin(2 * meanAnom)) * RAD;
  const obliq = (23.439 - 0.0000004 * n) * RAD;

  const decl = Math.asin(Math.sin(obliq) * Math.sin(eclLon)) / RAD;
  const ra = Math.atan2(Math.cos(obliq) * Math.sin(eclLon), Math.cos(eclLon)) / RAD;
  const gmstHours = (18.697374558 + 24.06570982441908 * n) % 24;

  let lon = -(((gmstHours * 15 - ra) % 360) + 360) % 360;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return [lon, decl];
}

/** Antipode of a `[lon, lat]` point. */
export function antipode([lon, lat]: LonLat): LonLat {
  return [lon > 0 ? lon - 180 : lon + 180, -lat];
}

/** Great-circle angular separation between two `[lon, lat]` points, in degrees. */
export function angularSepDeg(a: LonLat, b: LonLat): number {
  const la1 = a[1] * RAD;
  const la2 = b[1] * RAD;
  const dLa = (b[1] - a[1]) * RAD;
  const dLo = (b[0] - a[0]) * RAD;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLo / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / RAD;
}

/**
 * Sun altitude (degrees above the local horizon) at `ll` for `date` (UTC).
 * The angular distance from the sub-solar point is the solar zenith angle, so
 * altitude = 90 − that. Positive = Sun up, negative = Sun down.
 */
export function sunAltitude(ll: LonLat, date: Date): number {
  return 90 - angularSepDeg(ll, subsolarPoint(date));
}

/**
 * True when `ll` sits in the grey-line band — the Sun within ±`halfDeg`° of the
 * horizon, i.e. the sunrise/sunset terminator zone where low-band DX peaks.
 */
export function inGreyline(ll: LonLat, date: Date, halfDeg = 9): boolean {
  return Math.abs(sunAltitude(ll, date)) <= halfDeg;
}
