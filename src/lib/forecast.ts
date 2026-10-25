import { geoDistance, geoInterpolate } from "d3-geo";
import type { LonLat } from "./grid";
import { hopCount } from "./reach";
import { mufAt } from "./muf";
import { sunAltitude } from "./grayline";

/**
 * "VOACAP-lite": a band × UTC-hour reliability grid for the path `home → target`.
 * Built from the same sunspot/Sun-geometry MUF model as the map layers plus a
 * Lucas-style D-layer absorption term — an estimate for orientation, **not** a
 * VOACAP prediction (no antennas, power, noise, sporadic-E or season).
 */

const EARTH_KM = 6371.0088;

export const FORECAST_BANDS: { label: string; mhz: number }[] = [
  { label: "10", mhz: 28.5 },
  { label: "12", mhz: 24.94 },
  { label: "15", mhz: 21.2 },
  { label: "17", mhz: 18.1 },
  { label: "20", mhz: 14.2 },
  { label: "30", mhz: 10.12 },
  { label: "40", mhz: 7.1 },
  { label: "60", mhz: 5.357 },
  { label: "80", mhz: 3.65 },
];

export type DayState = "day" | "night";

export interface PathInfo {
  km: number;
  /** Initial bearing home → target, degrees (long path: +180). */
  bearing: number;
  points: LonLat[];
  mid: LonLat;
}

/** Initial great-circle bearing a → b in degrees 0..360. */
export function bearingDeg(a: LonLat, b: LonLat): number {
  const [l1, p1] = [(a[0] * Math.PI) / 180, (a[1] * Math.PI) / 180];
  const [l2, p2] = [(b[0] * Math.PI) / 180, (b[1] * Math.PI) / 180];
  const y = Math.sin(l2 - l1) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(l2 - l1);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Path geometry: hop-midpoint control points along the short or long great-circle arc. */
export function pathInfo(home: LonLat, target: LonLat, long: boolean): PathInfo {
  const d = geoDistance(home, target); // radians
  const shortKm = d * EARTH_KM;
  const interp = geoInterpolate(home, target);
  // geoInterpolate extrapolates for t outside [0,1]: negative t walks the other way round.
  const at = (s: number): LonLat =>
    (long ? geoInterpolate(home, target)(-s * ((2 * Math.PI - d) / d)) : interp(s)) as LonLat;
  const km = long ? 2 * Math.PI * EARTH_KM - shortKm : shortKm;
  const hops = hopCount(km);
  const points: LonLat[] = [];
  for (let i = 0; i < hops; i++) points.push(at((i + 0.5) / hops));
  const b = bearingDeg(home, target);
  return { km, bearing: long ? (b + 180) % 360 : b, points, mid: at(0.5) };
}

const logistic = (x: number) => 1 / (1 + Math.exp(x));

/** Reliability 0..1 of `freqMhz` along `path` at `date`. */
export function pathReliability(path: PathInfo, freqMhz: number, date: Date, ssn: number): number {
  let muf = Infinity;
  let absDb = 0;
  for (const p of path.points) {
    muf = Math.min(muf, mufAt(p, date, ssn));
    const chi = Math.min(90, 90 - sunAltitude(p, date)); // solar zenith, capped at the horizon
    const i =
      (1 + 0.0037 * Math.max(0, ssn)) *
      Math.max(0.05, Math.cos((0.881 * (chi * Math.PI)) / 180)) ** 1.3;
    absDb += (677.2 * i) / (freqMhz + 1.5) ** 2;
  }
  const relMuf = logistic((freqMhz / muf - 0.95) / 0.07); // ≈0.8 at FOT (0.85·MUF), ≈0.3 at MUF
  const relAbs = logistic((absDb - 20) / 4); // ≈0.5 at 20 dB of D-layer loss
  return relMuf * relAbs;
}

/** rows = bands (FORECAST_BANDS order), cols = hours 1..24 (24 = 00 UTC). */
export function forecastGrid(path: PathInfo, ssn: number, day = new Date()): number[][] {
  const y = day.getUTCFullYear();
  const m = day.getUTCMonth();
  const d = day.getUTCDate();
  const dates = Array.from({ length: 24 }, (_, i) => new Date(Date.UTC(y, m, d, (i + 1) % 24, 30)));
  return FORECAST_BANDS.map((b) => dates.map((dt) => pathReliability(path, b.mhz, dt, ssn)));
}

/** Day/night of the TX end, path midpoint and RX end for each hour 1..24. */
export function dayNightStrips(home: LonLat, target: LonLat, path: PathInfo, day = new Date()) {
  const y = day.getUTCFullYear();
  const m = day.getUTCMonth();
  const d = day.getUTCDate();
  const strip = (ll: LonLat): DayState[] =>
    Array.from({ length: 24 }, (_, i) =>
      sunAltitude(ll, new Date(Date.UTC(y, m, d, (i + 1) % 24, 30))) > 0 ? "day" : "night",
    );
  return { tx: strip(home), mp: strip(path.mid), rx: strip(target) };
}

/** Heat colour for a reliability value: red (0) → green (1). */
export function reliabilityColor(r: number): string {
  return `hsl(${Math.round(Math.max(0, Math.min(1, r)) * 120)}, 75%, 50%)`;
}
