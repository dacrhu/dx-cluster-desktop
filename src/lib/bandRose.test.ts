import { describe, expect, it } from "vitest";
import { bandRose, ROSE_SECTORS } from "./bandRose";
import type { CallInfo, EnrichedSpot } from "./types";

function spot(bearing: number | null, over: Partial<EnrichedSpot> = {}): EnrichedSpot {
  const dx: CallInfo | null =
    bearing == null
      ? null
      : {
          dxcc_name: "X",
          primary_prefix: "X",
          continent: "EU",
          cq_zone: 14,
          itu_zone: 28,
          lat: 0,
          lon: 0,
          bearing_deg: bearing,
          distance_km: 1000,
        };
  return {
    id: Math.random(),
    node_id: "n",
    received_at: Math.floor(Date.now() / 1000),
    spotter: "S",
    spotter_base: "S",
    freq_khz: 14020,
    dx_call: "A",
    comment: "",
    time_hhmm: "1200",
    grid: null,
    band: "20m",
    mode: "CW",
    is_skimmer: false,
    dx,
    by: null,
    ...over,
  };
}

describe("bandRose", () => {
  it("returns one bucket per sector", () => {
    expect(bandRose([])).toHaveLength(ROSE_SECTORS);
    expect(bandRose([]).every((s) => s.count === 0)).toBe(true);
  });

  it("bins by bearing, North into sector 0", () => {
    const rose = bandRose([spot(1), spot(3), spot(90)]);
    expect(rose[0].count).toBe(2);
    expect(rose[3].count).toBe(1); // 90° → sector 3 of 12 (30° each)
  });

  it("tracks dominant mode, per-mode counts and distinct bands per sector", () => {
    const rose = bandRose([
      spot(90, { mode: "SSB", band: "40m" }),
      spot(92, { mode: "SSB", band: "20m" }),
      spot(91, { mode: "CW", band: "20m" }),
    ]);
    expect(rose[3].dominantMode).toBe("SSB");
    // segments in ROSE_MODE_ORDER (CW before SSB), non-zero only
    expect(rose[3].modes).toEqual([
      { mode: "CW", count: 1 },
      { mode: "SSB", count: 2 },
    ]);
    expect(rose[3].bands).toEqual(["40m", "20m"]);
  });

  it("ignores spots with no bearing", () => {
    expect(bandRose([spot(null)]).every((s) => s.count === 0)).toBe(true);
  });
});
