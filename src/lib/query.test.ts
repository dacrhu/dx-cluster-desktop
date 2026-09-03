import { describe, expect, it } from "vitest";
import { compileQuery } from "./query";
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
    bearing_deg: null,
    distance_km: null,
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
    freq_khz: 14195,
    dx_call: "DL1ABC",
    comment: "CQ contest",
    time_hhmm: "1200",
    grid: "JN49",
    band: "20m",
    mode: "SSB",
    is_skimmer: false,
    dx: call(),
    by: call({ dxcc_name: "United States", primary_prefix: "K", continent: "NA", cq_zone: 5 }),
    ...over,
  };
}

const match = (q: string, s: EnrichedSpot) => compileQuery(q)(s);

describe("compileQuery", () => {
  it("empty query matches everything", () => {
    expect(match("", spot())).toBe(true);
    expect(match("   ", spot())).toBe(true);
  });

  it("bare words are substring matches across fields", () => {
    expect(match("contest", spot())).toBe(true);
    expect(match("germany", spot())).toBe(true);
    expect(match("w3lpl", spot())).toBe(true);
    expect(match("zzz", spot())).toBe(false);
  });

  it("ANDs multiple terms", () => {
    expect(match("contest germany", spot())).toBe(true);
    expect(match("contest france", spot())).toBe(false);
  });

  it("field scopes: dx/by prefix, dxcc, band, mode", () => {
    expect(match("dx:DL", spot())).toBe(true);
    expect(match("dx:EA", spot())).toBe(false);
    expect(match("by:W3", spot())).toBe(true);
    expect(match("dxcc:germ", spot())).toBe(true);
    expect(match("dxcc:DL", spot())).toBe(true);
    expect(match("band:20m", spot())).toBe(true);
    expect(match("mode:cw", spot())).toBe(false);
    expect(match("mode:ssb", spot())).toBe(true);
  });

  it("comma values inside a field are ORed", () => {
    expect(match("band:40m,20m", spot())).toBe(true);
    expect(match("cq:5,14", spot())).toBe(true);
    expect(match("cq:1,2", spot())).toBe(false);
  });

  it("negation", () => {
    expect(match("-mode:cw", spot())).toBe(true);
    expect(match("-mode:ssb", spot())).toBe(false);
    expect(match("!dx:EA", spot())).toBe(true);
  });

  it("freq comparisons and ranges", () => {
    expect(match("freq>14000", spot())).toBe(true);
    expect(match("f<14100", spot())).toBe(false);
    expect(match("freq:14000-14350", spot())).toBe(true);
    expect(match("freq:7000-7300", spot())).toBe(false);
  });

  it("OR groups", () => {
    expect(match("dx:EA OR dx:DL", spot())).toBe(true);
    expect(match("dx:EA | band:80m", spot())).toBe(false);
    expect(match("mode:cw OR contest", spot({ comment: "cq" }))).toBe(false);
    expect(match("mode:cw OR contest", spot())).toBe(true);
  });

  it("skimmer flag", () => {
    expect(match("skimmer", spot({ is_skimmer: true }))).toBe(true);
    expect(match("-skimmer", spot({ is_skimmer: true }))).toBe(false);
  });

  it("bycq / bycont scope the spotter", () => {
    expect(match("bycq:5", spot())).toBe(true);
    expect(match("bycont:NA", spot())).toBe(true);
    expect(match("cont:NA", spot())).toBe(false);
  });

  it("quoted phrases", () => {
    expect(match('"cq contest"', spot())).toBe(true);
    expect(match('c:"cq contest"', spot())).toBe(true);
    expect(match('"contest cq"', spot())).toBe(false);
  });
});
