import { describe, expect, it } from "vitest";
import { baseCall, locatorToLonLat, spotLonLat, spotterLonLat } from "./grid";
import type { CallInfo, EnrichedSpot } from "./types";

function callInfo(over: Partial<CallInfo> = {}): CallInfo {
  return {
    dxcc_name: "Hungary",
    primary_prefix: "HA",
    continent: "EU",
    cq_zone: 15,
    itu_zone: 28,
    lat: 47,
    lon: 19,
    bearing_deg: null,
    distance_km: null,
    ...over,
  };
}

function spot(over: Partial<EnrichedSpot> = {}): EnrichedSpot {
  return {
    id: 1,
    node_id: "n",
    received_at: 0,
    spotter: "OM3XX",
    spotter_base: "OM3XX",
    freq_khz: 14020,
    dx_call: "HA5XX",
    comment: "",
    time_hhmm: "1200",
    grid: null,
    band: "20m",
    mode: "CW",
    is_skimmer: false,
    dx: callInfo(),
    by: callInfo({ primary_prefix: "OM", lon: 18 }),
    ...over,
  };
}

describe("locatorToLonLat", () => {
  it("returns [lon, lat] of the square centre", () => {
    const [lon, lat] = locatorToLonLat("JN97mn")!;
    expect(lat).toBeCloseTo(47.56, 1);
    expect(lon).toBeCloseTo(19.04, 1);
  });

  it("handles 4-char grids", () => {
    const [lon, lat] = locatorToLonLat("JN97")!;
    expect(lat).toBeCloseTo(47.5, 1);
    expect(lon).toBeCloseTo(19.0, 1);
  });

  it("rejects malformed input", () => {
    expect(locatorToLonLat("")).toBeNull();
    expect(locatorToLonLat("ZZ99")).toBeNull();
    expect(locatorToLonLat("JN9")).toBeNull();
  });
});

describe("baseCall", () => {
  it("strips SSID and portable tokens", () => {
    expect(baseCall("S53A-#")).toBe("S53A");
    expect(baseCall("DL/HA5XYZ/P")).toBe("HA5XYZ");
    expect(baseCall("HA5XYZ/MM")).toBe("HA5XYZ");
    expect(baseCall("g3xyz")).toBe("G3XYZ");
  });
});

describe("spotLonLat", () => {
  it("uses the exact grid when the spot carries one", () => {
    const [lon, lat] = spotLonLat(spot({ grid: "JN97mn" }))!;
    expect(lat).toBeCloseTo(47.56, 1);
    expect(lon).toBeCloseTo(19.04, 1);
  });

  it("jitters away from the bare DXCC centroid when there is no grid", () => {
    const [lon, lat] = spotLonLat(spot())!;
    expect(lon === 19 && lat === 47).toBe(false);
    expect(Math.abs(lon - 19)).toBeLessThan(1.5);
    expect(Math.abs(lat - 47)).toBeLessThan(1.5);
  });

  it("jitters deterministically — same callsign, same spot", () => {
    const a = spotLonLat(spot({ dx_call: "HA5XX", id: 1 }));
    const b = spotLonLat(spot({ dx_call: "HA5XX", id: 2 }));
    expect(a).toEqual(b);
  });

  it("spreads different callsigns apart", () => {
    const a = spotLonLat(spot({ dx_call: "HA5XX" }));
    const b = spotLonLat(spot({ dx_call: "HA7ZZ" }));
    expect(a).not.toEqual(b);
  });

  it("returns null with no grid and no DXCC info", () => {
    expect(spotLonLat(spot({ grid: null, dx: null }))).toBeNull();
  });
});

describe("spotterLonLat", () => {
  it("jitters the spotter's DXCC centroid by the spotter callsign", () => {
    const [lon, lat] = spotterLonLat(spot())!;
    expect(lon === 18 && lat === 47).toBe(false);
    expect(Math.abs(lon - 18)).toBeLessThan(1.5);
  });
});
