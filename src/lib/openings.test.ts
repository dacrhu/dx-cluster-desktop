import { describe, expect, it } from "vitest";
import { bandOpenings } from "./openings";
import type { CallInfo, EnrichedSpot } from "./types";

function call(over: Partial<CallInfo> = {}): CallInfo {
  return {
    dxcc_name: "Germany",
    primary_prefix: "DL",
    continent: "EU",
    cq_zone: 14,
    itu_zone: 28,
    lat: 51,
    lon: 10,
    bearing_deg: 90,
    distance_km: 1000,
    ...over,
  };
}

function spot(over: Partial<EnrichedSpot> = {}): EnrichedSpot {
  return {
    id: 1,
    node_id: "n",
    received_at: Math.floor(Date.now() / 1000),
    spotter: "W3LPL",
    spotter_base: "W3LPL",
    freq_khz: 14020,
    dx_call: "JA1XYZ",
    comment: "CW",
    time_hhmm: "1200",
    grid: null,
    band: "20m",
    mode: "CW",
    is_skimmer: false,
    dx: call({ lat: 35, lon: 139, dxcc_name: "Japan", primary_prefix: "JA" }),
    by: call({ lat: 39, lon: -77, dxcc_name: "United States", primary_prefix: "K" }),
    ...over,
  };
}

describe("bandOpenings", () => {
  it("keeps recent spots with both endpoints known", () => {
    const arcs = bandOpenings([spot()], 30);
    expect(arcs).toHaveLength(1);
    expect(arcs[0].band).toBe("20m");
    expect(arcs[0].mode).toBe("CW");
    expect(arcs[0].a).toHaveLength(2);
    expect(arcs[0].b).toHaveLength(2);
  });

  it("drops spots older than the window and those missing an endpoint", () => {
    const old = spot({ id: 2, received_at: Math.floor(Date.now() / 1000) - 3600 });
    const noPos = spot({ id: 3, dx: null, grid: null });
    expect(bandOpenings([old, noPos], 30)).toHaveLength(0);
  });
});

describe("bandOpenings with a `near` filter", () => {
  const home: [number, number] = [-77, 39]; // same point as the default spotter

  it("keeps a spot whose spotter is within radiusKm", () => {
    const arcs = bandOpenings([spot()], 30, { home, radiusKm: 100 });
    expect(arcs).toHaveLength(1);
  });

  it("drops a spot whose spotter is outside radiusKm", () => {
    const far = spot({
      by: call({ lat: 39, lon: -77 + 90, dxcc_name: "Elsewhere", primary_prefix: "XX" }),
    });
    expect(bandOpenings([far], 30, { home, radiusKm: 100 })).toHaveLength(0);
  });

  it("ignores the filter entirely when near is null or omitted", () => {
    const far = spot({
      by: call({ lat: 39, lon: -77 + 90, dxcc_name: "Elsewhere", primary_prefix: "XX" }),
    });
    expect(bandOpenings([far], 30, null)).toHaveLength(1);
    expect(bandOpenings([far], 30)).toHaveLength(1);
  });

  it("still drops a spot with no resolvable spotter position, near or not", () => {
    const noSpotter = spot({ id: 4, by: null });
    expect(bandOpenings([noSpotter], 30, { home, radiusKm: 20000 })).toHaveLength(0);
  });
});
