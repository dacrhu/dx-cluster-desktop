import { describe, expect, it } from "vitest";
import { antipode, inGreyline, subsolarPoint, sunAltitude } from "./grayline";

describe("subsolarPoint", () => {
  it("puts the Sun near the Tropic of Cancer at the June solstice noon", () => {
    const [lon, lat] = subsolarPoint(new Date("2024-06-20T12:00:00Z"));
    expect(lat).toBeGreaterThan(23);
    expect(lat).toBeLessThan(23.6);
    expect(Math.abs(lon)).toBeLessThan(8); // near Greenwich at 12z (± equation of time)
  });

  it("puts the Sun south of the equator at the December solstice", () => {
    const [, lat] = subsolarPoint(new Date("2024-12-21T12:00:00Z"));
    expect(lat).toBeLessThan(-23);
    expect(lat).toBeGreaterThan(-23.6);
  });

  it("tracks the Sun westward ~15°/hour", () => {
    const a = subsolarPoint(new Date("2024-03-20T12:00:00Z"))[0];
    const b = subsolarPoint(new Date("2024-03-20T14:00:00Z"))[0];
    // 2 hours later the sub-solar longitude has moved ~30° west
    expect(a - b).toBeGreaterThan(25);
    expect(a - b).toBeLessThan(35);
  });
});

describe("antipode", () => {
  it("flips latitude and shifts longitude by 180", () => {
    expect(antipode([19, 47])).toEqual([-161, -47]);
    expect(antipode([-120, -10])).toEqual([60, 10]);
  });
});

describe("sunAltitude / inGreyline", () => {
  // Equinox 12:00 UTC: sub-solar point ~ (0°E, 0°N).
  const t = new Date("2024-03-20T12:00:00Z");

  it("Sun is high over the sub-solar longitude, low 90° away", () => {
    expect(sunAltitude([0, 0], t)).toBeGreaterThan(88);
    expect(sunAltitude([90, 0], t)).toBeLessThan(2);
    expect(sunAltitude([90, 0], t)).toBeGreaterThan(-2);
    expect(sunAltitude([180, 0], t)).toBeLessThan(-88); // midnight side
  });

  it("the terminator (~90° from the Sun) is in the grey-line band", () => {
    expect(inGreyline([90, 0], t)).toBe(true);
    expect(inGreyline([-90, 0], t)).toBe(true);
  });

  it("high noon and deep midnight are not grey line", () => {
    expect(inGreyline([0, 0], t)).toBe(false);
    expect(inGreyline([180, 0], t)).toBe(false);
  });
});
