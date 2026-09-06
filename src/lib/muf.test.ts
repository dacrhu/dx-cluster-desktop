import { describe, expect, it } from "vitest";
import {
  interpolateMuf,
  mufAt,
  mufBandLabels,
  mufColor,
  mufContours,
  MUF_THRESHOLDS,
  sfiToSsn,
} from "./muf";
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

describe("mufContours", () => {
  // 20×10 grid, MUF rising 0→38 MHz west→east.
  const gw = 20;
  const gh = 10;
  const gradient = Array.from({ length: gw * gh }, (_, k) => (k % gw) * 2);

  it("returns nested bands, low→high, each a threshold with geometry", () => {
    const bands = mufContours(gradient, gw, gh);
    expect(bands.length).toBeGreaterThan(2);
    const vals = bands.map((b) => b.value);
    expect(vals).toEqual([...vals].sort((a, b) => a - b));
    for (const b of bands) {
      expect(MUF_THRESHOLDS).toContain(b.value);
      expect(b.color).toBe(mufColor(b.value));
      expect(b.coordinates.length).toBeGreaterThan(0);
    }
  });

  it("scales ring coordinates by the cell pitch", () => {
    const a = mufContours(gradient, gw, gh, 1)[0].coordinates[0][0][0];
    const b = mufContours(gradient, gw, gh, 12)[0].coordinates[0][0][0];
    expect(b[0]).toBeCloseTo(a[0] * 12);
    expect(b[1]).toBeCloseTo(a[1] * 12);
  });

  it("a uniformly closed field yields only the base (0 MHz) band", () => {
    const bands = mufContours(new Array(gw * gh).fill(2), gw, gh);
    expect(bands.map((b) => b.value)).toEqual([0]);
  });
});

describe("mufBandLabels", () => {
  const gw = 24;
  const gh = 12;
  // MUF rising 0→46 MHz west→east: one contiguous strip per band.
  const gradient = Array.from({ length: gw * gh }, (_, k) => (k % gw) * 2);

  it("places one anchor per band (>7 MHz), inside the grid, scaled by cell", () => {
    const labels = mufBandLabels(gradient, gw, gh, 10);
    expect(labels.length).toBeGreaterThan(2);
    for (const l of labels) {
      expect(MUF_THRESHOLDS).toContain(l.value);
      expect(l.value).toBeGreaterThanOrEqual(7); // the closed <7 band is skipped
      expect(l.x).toBeGreaterThanOrEqual(0);
      expect(l.x).toBeLessThanOrEqual((gw - 1) * 10);
      expect(l.y).toBeGreaterThanOrEqual(0);
      expect(l.y).toBeLessThanOrEqual((gh - 1) * 10);
    }
    // ascending MUF west→east → ascending label x with ascending value
    const byVal = [...labels].sort((a, b) => a.value - b.value);
    expect(byVal.map((l) => l.x)).toEqual([...byVal.map((l) => l.x)].sort((a, b) => a - b));
  });

  it("anchors in the interior of a band, not on the boundary with the next", () => {
    // wide bands (step 1 MHz over 24 cols) so each strip has real interior
    const wide = Array.from({ length: gw * gh }, (_, k) => (k % gw) * 1);
    const bandAt = (v: number) => {
      let b = 0;
      for (let t = 1; t < MUF_THRESHOLDS.length; t++) if (v >= MUF_THRESHOLDS[t]) b = t;
      return b;
    };
    for (const l of mufBandLabels(wide, gw, gh, 1)) {
      const ix = l.x;
      const iy = l.y;
      const here = bandAt(wide[iy * gw + ix]);
      // all four neighbours are the same band → the anchor is not on an edge
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = ix + dx;
        const ny = iy + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        expect(bandAt(wide[ny * gw + nx])).toBe(here);
      }
    }
  });

  it("drops components smaller than minCells", () => {
    // a single open cell in an otherwise closed field
    const v = new Array(gw * gh).fill(2);
    v[gw * 6 + 12] = 30;
    expect(mufBandLabels(v, gw, gh, 1, 6)).toHaveLength(0);
  });

  it("a uniformly closed field gets no labels", () => {
    expect(mufBandLabels(new Array(gw * gh).fill(3), gw, gh)).toHaveLength(0);
  });
});
