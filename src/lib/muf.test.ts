import { describe, expect, it } from "vitest";
import { interpolateMuf, mufAt, mufColor, mufGrid, sfiToSsn } from "./muf";
import type { MufStation } from "./types";

const stn = (lat: number, lon: number, mufd: number, cs = 80): MufStation => ({
  lat,
  lon,
  mufd,
  fof2: mufd / 3,
  cs,
  name: `s${lat},${lon}`,
});

// Equinox 12:00 UTC → sub-solar point ~ (0°E, 0°N).
const noon = new Date("2024-03-20T12:00:00Z");

describe("mufAt", () => {
  it("is much higher under the Sun than on the night side", () => {
    const day = mufAt([0, 0], noon, 100);
    const night = mufAt([180, 0], noon, 100);
    expect(day).toBeGreaterThan(night * 1.8);
  });

  it("rises with the sunspot number", () => {
    expect(mufAt([0, 0], noon, 200)).toBeGreaterThan(mufAt([0, 0], noon, 10));
  });

  it("stays in a physically plausible HF range", () => {
    const day = mufAt([0, 0], noon, 150);
    expect(day).toBeGreaterThan(15);
    expect(day).toBeLessThan(60);
    expect(mufAt([180, 0], noon, 0)).toBeGreaterThan(3);
  });
});

describe("sfiToSsn", () => {
  it("maps quiet flux near zero and high flux to a large SSN", () => {
    expect(sfiToSsn(64)).toBeLessThan(5);
    expect(sfiToSsn(200)).toBeGreaterThan(150);
    expect(sfiToSsn(null)).toBe(0);
  });
});

describe("the colour scale actually spreads (not all-red, not all-green)", () => {
  it("ssn 90: day green, night not green, dusk in between", () => {
    expect(mufColor(mufAt([0, 0], noon, 90))).toBe("#22c55e"); // 10 m+ under the Sun
    expect(mufColor(mufAt([180, 0], noon, 90))).not.toBe("#22c55e"); // night is lower
    expect(mufAt([180, 0], noon, 90)).toBeGreaterThan(9); // ...but not fully closed
    const dusk = mufAt([88, 0], noon, 90);
    expect(dusk).toBeGreaterThan(mufAt([180, 0], noon, 90));
    expect(dusk).toBeLessThan(mufAt([0, 0], noon, 90));
  });

  it("solar minimum keeps a strong day/night contrast", () => {
    expect(mufAt([0, 0], noon, 8)).toBeGreaterThan(mufAt([180, 0], noon, 8) * 2);
    expect(mufColor(mufAt([180, 0], noon, 8))).toMatch(/#(ef4444|b91c1c)/); // red-ish night
  });
});

describe("interpolateMuf (measured / model blend)", () => {
  it("no stations → pure model, zero coverage", () => {
    expect(interpolateMuf([], [10, 50], 25)).toEqual({ muf: 25, coverage: 0 });
  });

  it("on top of a station → that station's MUFD, high coverage", () => {
    const r = interpolateMuf([stn(50, 10, 12, 100)], [10, 50], 30);
    expect(r.muf).toBeGreaterThan(11);
    expect(r.muf).toBeLessThan(14);
    expect(r.coverage).toBeGreaterThan(0.7);
  });

  it("far from every station → falls back to the model, ~zero coverage", () => {
    const r = interpolateMuf([stn(50, 10, 12)], [-140, -30], 28);
    expect(r.muf).toBeCloseTo(28, 1);
    expect(r.coverage).toBeLessThan(0.05);
  });

  it("between two stations → a value between them", () => {
    const r = interpolateMuf([stn(0, 0, 10, 100), stn(0, 10, 30, 100)], [5, 0], 50);
    expect(r.muf).toBeGreaterThan(12);
    expect(r.muf).toBeLessThan(28);
  });

  it("coverage stays in [0,1]", () => {
    const many = [stn(0, 0, 20), stn(1, 1, 20), stn(-1, -1, 20), stn(0, 1, 20)];
    const r = interpolateMuf(many, [0, 0], 15);
    expect(r.coverage).toBeGreaterThanOrEqual(0);
    expect(r.coverage).toBeLessThanOrEqual(1);
  });
});

describe("mufGrid / mufColor", () => {
  it("covers the globe and every cell gets a colour", () => {
    const g = mufGrid(noon, 100, 20);
    expect(g.length).toBeGreaterThan(100);
    for (const c of g) expect(mufColor(c.muf)).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
