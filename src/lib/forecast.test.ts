import { describe, expect, it } from "vitest";
import {
  dayNightStrips,
  FORECAST_BANDS,
  forecastGrid,
  pathInfo,
  pathReliability,
} from "./forecast";
import type { LonLat } from "./grid";

const hu: LonLat = [19, 47.5];
const jp: LonLat = [139.7, 35.7];
const day = new Date("2024-03-20T00:00:00Z");
const band = (l: string) => FORECAST_BANDS.findIndex((b) => b.label === l);

describe("pathInfo", () => {
  it("short + long path add up to the Earth's circumference", () => {
    const s = pathInfo(hu, jp, false);
    const l = pathInfo(hu, jp, true);
    expect(s.km + l.km).toBeCloseTo(40030, -2);
    expect(Math.abs(l.bearing - s.bearing)).toBeCloseTo(180, 5);
  });
});

describe("forecastGrid", () => {
  const eu: LonLat = [2.3, 48.9];
  const path = pathInfo(hu, eu, false);
  const grid = forecastGrid(path, 100, day);
  it("is 9 bands × 24 hours within 0..1", () => {
    expect(grid).toHaveLength(FORECAST_BANDS.length);
    for (const row of grid) {
      expect(row).toHaveLength(24);
      for (const v of row) expect(v).toBeGreaterThanOrEqual(0);
    }
  });
  it("10 m is closed at night, 80 m is stronger at night than at midday", () => {
    // hour columns: index 1 = 02 UTC, index 11 = 12 UTC
    expect(grid[band("10")][1]).toBeLessThan(0.05);
    expect(grid[band("80")][1]).toBeGreaterThan(grid[band("80")][11]);
  });
});

describe("pathReliability", () => {
  it("high band is open by day on a medium path", () => {
    const p = pathInfo(hu, [-74, 40.7], false);
    expect(pathReliability(p, 14.2, new Date("2024-03-20T15:30:00Z"), 100)).toBeGreaterThan(0.5);
  });
});

describe("dayNightStrips", () => {
  it("returns 24 entries per end", () => {
    const p = pathInfo(hu, jp, false);
    const s = dayNightStrips(hu, jp, p, day);
    expect(s.tx).toHaveLength(24);
    expect(s.mp).toHaveLength(24);
    expect(s.rx).toHaveLength(24);
  });
});
