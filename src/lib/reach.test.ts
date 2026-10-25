import { describe, expect, it } from "vitest";
import { controlPoints, hopCount, pathMuf, reachClass } from "./reach";
import type { LonLat } from "./grid";
import type { MufStation } from "./types";

const BUDAPEST: LonLat = [19.04, 47.5];

describe("hopCount", () => {
  it("steps at 4000 and 8000 km", () => {
    expect(hopCount(500)).toBe(1);
    expect(hopCount(4000)).toBe(1);
    expect(hopCount(4001)).toBe(2);
    expect(hopCount(8001)).toBe(3);
  });
});

describe("controlPoints", () => {
  it("uses the midpoint for a short path", () => {
    const pts = controlPoints(BUDAPEST, [16.37, 48.2]); // Vienna
    expect(pts).toHaveLength(1);
    expect(pts[0][0]).toBeGreaterThan(16.37);
    expect(pts[0][0]).toBeLessThan(19.04);
  });
  it("uses three hops across the world", () => {
    expect(controlPoints(BUDAPEST, [151.2, -33.9])).toHaveLength(3); // Sydney
  });
});

describe("reachClass", () => {
  it("classifies against 85 % of the MUF", () => {
    expect(reachClass(14.2, 20)).toBe("open");
    expect(reachClass(14.2, 15)).toBe("marginal");
    expect(reachClass(14.2, 10)).toBe("closed");
  });
});

describe("pathMuf", () => {
  const noon = new Date(Date.UTC(2026, 5, 21, 11, 0, 0));
  it("is limited by the lowest hop", () => {
    // Daytime over Europe vs. a path into the night side: the long path can't
    // beat the short, fully-lit one.
    const short = pathMuf(BUDAPEST, [16.37, 48.2], noon, 100, []);
    const long = pathMuf(BUDAPEST, [-150, -30], noon, 100, []);
    expect(long).toBeLessThanOrEqual(short);
  });
  it("prefers a nearby measured station over the model", () => {
    const st: MufStation[] = [
      { lat: 47.8, lon: 18.5, mufd: 40, fof2: null, cs: 100, name: "x" } as MufStation,
    ];
    const withSt = pathMuf(BUDAPEST, [19.5, 47.4], noon, 100, st);
    const without = pathMuf(BUDAPEST, [19.5, 47.4], noon, 100, []);
    expect(withSt).toBeGreaterThan(without);
  });
});
