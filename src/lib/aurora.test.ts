import { describe, expect, it } from "vitest";
import { auroraColatitude, auroraOvals } from "./aurora";

describe("auroraColatitude", () => {
  it("widens the oval as K rises", () => {
    expect(auroraColatitude(0)).toBeLessThan(auroraColatitude(3));
    expect(auroraColatitude(3)).toBeLessThan(auroraColatitude(9));
  });

  it("stays in a sane colatitude range and clamps K", () => {
    expect(auroraColatitude(0)).toBeGreaterThanOrEqual(15);
    expect(auroraColatitude(9)).toBeLessThan(40);
    expect(auroraColatitude(-5)).toBe(auroraColatitude(0));
    expect(auroraColatitude(99)).toBe(auroraColatitude(9));
  });
});

describe("auroraOvals", () => {
  it("returns a north and a south cap with equal radius", () => {
    const [n, s] = auroraOvals(4);
    expect(n.center[1]).toBeGreaterThan(60);
    expect(s.center[1]).toBeLessThan(-60);
    expect(n.radius).toBe(s.radius);
  });
});
