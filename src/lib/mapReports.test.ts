import { describe, expect, it } from "vitest";
import { collapseReports, type MyReport } from "./mapReports";
import type { CallInfo, EnrichedSpot } from "./types";

function call(over: Partial<CallInfo> = {}): CallInfo {
  return {
    dxcc_name: "Finland",
    primary_prefix: "OH",
    continent: "EU",
    cq_zone: 15,
    itu_zone: 18,
    lat: 62,
    lon: 25,
    bearing_deg: 40,
    distance_km: 1500,
    ...over,
  };
}

function spot(over: Partial<EnrichedSpot> = {}): EnrichedSpot {
  return {
    id: 1,
    node_id: "RBN CW",
    received_at: 1_000_000,
    spotter: "OH6BG-#",
    spotter_base: "OH6BG",
    freq_khz: 14025.0,
    dx_call: "HA5XYZ",
    comment: "CW 12 dB 25 wpm",
    time_hhmm: "1200",
    grid: null,
    band: "20m",
    mode: "CW",
    is_skimmer: true,
    dx: call({ dxcc_name: "Hungary", primary_prefix: "HA", lat: 47, lon: 19 }),
    by: call(),
    ...over,
  };
}

function report(over: Partial<EnrichedSpot> = {}, extra: Partial<MyReport> = {}): MyReport {
  const s = spot(over);
  return {
    spot: s,
    snrDb: 12,
    wpm: 25,
    lonLat: [25, 62],
    count: 1,
    feeds: 1,
    members: [s],
    ...extra,
  };
}

describe("collapseReports", () => {
  it("merges the same skimmer on the same freq across feeds into one marker", () => {
    const rbn = report({ id: -1, node_id: "RBN CW", received_at: 1_000_000 });
    const cluster = report({ id: 42, node_id: "DXSpider", received_at: 1_000_030 });
    const out = collapseReports([rbn, cluster]);
    expect(out).toHaveLength(1);
    expect(out[0].count).toBe(2);
    expect(out[0].feeds).toBe(2);
    // freshest report wins (drives the age fade)
    expect(out[0].spot.id).toBe(42);
    // every raw report is kept, newest first, for the popup comment list
    expect(out[0].members.map((m) => m.id)).toEqual([42, -1]);
  });

  it("collapses a tiny freq drift (0.1 kHz bucket) and keeps distinct feeds", () => {
    const a = report({ id: -1, freq_khz: 14025.0, node_id: "RBN CW" });
    const b = report({ id: -2, freq_khz: 14025.04, node_id: "RBN CW", received_at: 1_000_050 });
    const out = collapseReports([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].count).toBe(2);
    expect(out[0].feeds).toBe(1);
  });

  it("keeps different skimmers and different frequencies apart", () => {
    const oh = report({ id: -1, spotter_base: "OH6BG", spotter: "OH6BG-#" });
    const dl = report({ id: -2, spotter_base: "DL8TG", spotter: "DL8TG-#" });
    const oh40 = report({ id: -3, spotter_base: "OH6BG", spotter: "OH6BG-#", freq_khz: 7025 });
    expect(collapseReports([oh, dl, oh40])).toHaveLength(3);
  });

  it("fills SNR/WPM from an older report when the freshest lacks them", () => {
    const older = report({ id: -1, received_at: 1_000_000 }, { snrDb: 15, wpm: 30 });
    const newer = report({ id: -2, received_at: 1_000_100 }, { snrDb: null, wpm: null });
    const out = collapseReports([older, newer]);
    expect(out[0].spot.id).toBe(-2);
    expect(out[0].snrDb).toBe(15);
    expect(out[0].wpm).toBe(30);
  });

  it("matches base callsigns (portable suffix ignored)", () => {
    const home = report({ id: -1, dx_call: "HA5XYZ" });
    const portable = report({ id: -2, dx_call: "HA5XYZ/P", received_at: 1_000_050 });
    expect(collapseReports([home, portable])).toHaveLength(1);
  });
});
