import { describe, expect, it } from "vitest";
import { ACT_BUCKETS, bandActivityMatrix, cellKey, classifyTrend } from "./bandActivity";
import type { CallInfo, EnrichedSpot } from "./types";

const NOW = 1_700_000_000; // fixed reference, seconds

function call(continent: string): CallInfo {
  return {
    dxcc_name: continent,
    primary_prefix: "X",
    continent,
    cq_zone: 1,
    itu_zone: 1,
    lat: 0,
    lon: 0,
    bearing_deg: null,
    distance_km: null,
  };
}

let seq = 0;
function spot(o: {
  minAgo: number;
  band?: string | null;
  dx?: string | null;
  by?: string | null;
}): EnrichedSpot {
  return {
    id: seq++,
    node_id: "n",
    received_at: NOW - o.minAgo * 60,
    spotter: "S",
    spotter_base: "S",
    freq_khz: 7000,
    dx_call: "DX",
    comment: "",
    time_hhmm: "0000",
    grid: null,
    band: o.band === undefined ? "40m" : o.band,
    mode: "CW",
    is_skimmer: false,
    dx: o.dx === null ? null : call(o.dx ?? "EU"),
    by: o.by === null ? null : call(o.by ?? "EU"),
  };
}

/** N spots, all `minAgo` minutes old, with the given band/dx/by. */
function burst(n: number, o: Parameters<typeof spot>[0]): EnrichedSpot[] {
  return Array.from({ length: n }, () => spot(o));
}

describe("classifyTrend", () => {
  it("flags a strong rise and a mild fall", () => {
    expect(classifyTrend(6, 2)).toEqual({ deltaPct: 200, trend: 2 });
    expect(classifyTrend(2, 6).trend).toBe(-1);
  });
  it("treats a cold start as a rise and a full stop as a strong fall", () => {
    expect(classifyTrend(3, 0)).toEqual({ deltaPct: null, trend: 2 });
    expect(classifyTrend(0, 4)).toEqual({ deltaPct: -100, trend: -2 });
    expect(classifyTrend(0, 0)).toEqual({ deltaPct: null, trend: 0 });
  });
});

describe("bandActivityMatrix", () => {
  it("computes recent vs prev and the sparkline buckets", () => {
    const spots = [
      ...burst(6, { minAgo: 5, band: "40m", dx: "EU" }), // bucket 0
      ...burst(2, { minAgo: 20, band: "40m", dx: "EU" }), // bucket 1
      ...burst(1, { minAgo: 100, band: "40m", dx: "EU" }), // bucket 6
    ];
    const m = bandActivityMatrix(spots, null, NOW);
    const c = m.cells.get(cellKey("40m", "EU"))!;
    expect(c.recent).toBe(6);
    expect(c.prev).toBe(2);
    expect(c.deltaPct).toBe(200);
    expect(c.trend).toBe(2);
    expect(c.total).toBe(9);
    expect(c.buckets).toHaveLength(ACT_BUCKETS);
    // buckets are oldest → newest: index 7 is "now"
    expect(c.buckets[ACT_BUCKETS - 1]).toBe(6);
    expect(c.buckets[ACT_BUCKETS - 2]).toBe(2);
    expect(c.buckets[ACT_BUCKETS - 1 - 6]).toBe(1);
  });

  it("scopes to the spotter's continent when `from` is set", () => {
    const spots = [
      ...burst(4, { minAgo: 5, band: "20m", dx: "NA", by: "EU" }),
      ...burst(9, { minAgo: 5, band: "20m", dx: "NA", by: "NA" }),
    ];
    const scoped = bandActivityMatrix(spots, "EU", NOW);
    expect(scoped.sampled).toBe(4);
    expect(scoped.cells.get(cellKey("20m", "NA"))!.recent).toBe(4);

    const open = bandActivityMatrix(spots, null, NOW);
    expect(open.sampled).toBe(13);
  });

  it("drops spots with no band, no DX continent, or outside the 2-hour window", () => {
    const spots = [
      spot({ minAgo: 5, band: null }),
      spot({ minAgo: 5, dx: null }),
      spot({ minAgo: 200, band: "40m", dx: "EU" }),
      spot({ minAgo: 5, band: "40m", dx: "EU" }),
    ];
    const m = bandActivityMatrix(spots, null, NOW);
    expect(m.sampled).toBe(1);
    expect([...m.cells.keys()]).toEqual([cellKey("40m", "EU")]);
  });

  it("ranks the biggest movers and orders bands/continents canonically", () => {
    const spots = [
      // 40m → EU: strong rise, a clear mover
      ...burst(8, { minAgo: 5, band: "40m", dx: "EU" }),
      ...burst(2, { minAgo: 20, band: "40m", dx: "EU" }),
      // 20m → NA: clear fall
      ...burst(1, { minAgo: 5, band: "20m", dx: "NA" }),
      ...burst(6, { minAgo: 20, band: "20m", dx: "NA" }),
      // 15m → AS: a rise but too little traffic to be a headline mover
      ...burst(1, { minAgo: 5, band: "15m", dx: "AS" }),
    ];
    const m = bandActivityMatrix(spots, null, NOW);
    expect(m.movers.rising.map((c) => cellKey(c.band, c.continent))).toEqual([
      cellKey("40m", "EU"),
    ]);
    expect(m.movers.falling.map((c) => cellKey(c.band, c.continent))).toEqual([
      cellKey("20m", "NA"),
    ]);
    expect(m.bands).toEqual(["40m", "20m", "15m"]);
    expect(m.continents).toEqual(["EU", "NA", "AS"]);
  });
});
