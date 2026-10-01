import { describe, expect, it } from "vitest";
import { alertMatches, emptyAlert, matchingAlert } from "./alerts";
import type { CallInfo, EnrichedSpot } from "./types";

function call(over: Partial<CallInfo> = {}): CallInfo {
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
    dx: call(),
    by: call({ primary_prefix: "OM", dxcc_name: "Slovak Republic" }),
    ...over,
  };
}

describe("alertMatches", () => {
  it("never matches a rule with no conditions", () => {
    expect(alertMatches(spot(), emptyAlert())).toBe(false);
  });

  it("ANDs conditions within a rule", () => {
    const rule = { ...emptyAlert(), calls: ["HA"], bands: ["40m"] };
    expect(alertMatches(spot({ band: "20m" }), rule)).toBe(false);
    expect(alertMatches(spot({ band: "40m" }), rule)).toBe(true);
  });

  it("matches a DX callsign prefix", () => {
    expect(alertMatches(spot(), { ...emptyAlert(), calls: ["HA5"] })).toBe(true);
    expect(alertMatches(spot(), { ...emptyAlert(), calls: ["HA7"] })).toBe(false);
  });

  it("matches an exact DX callsign but not a longer one sharing the prefix", () => {
    expect(alertMatches(spot(), { ...emptyAlert(), exactCalls: ["HA5XX"] })).toBe(true);
    expect(
      alertMatches(spot({ dx_call: "HA5XXY" }), { ...emptyAlert(), exactCalls: ["HA5XX"] }),
    ).toBe(false);
  });

  it("exact callsign matching strips portable suffixes", () => {
    const rule = { ...emptyAlert(), exactCalls: ["HA5XX"] };
    expect(alertMatches(spot({ dx_call: "HA5XX/P" }), rule)).toBe(true);
    expect(alertMatches(spot({ dx_call: "DL/HA5XX/MM" }), rule)).toBe(true);
  });

  it("matchSpotter switches the tested side", () => {
    const rule = { ...emptyAlert(), calls: ["OM"], matchSpotter: true };
    expect(alertMatches(spot(), rule)).toBe(true);
  });

  it("ignores a disabled rule", () => {
    expect(alertMatches(spot(), { ...emptyAlert(), enabled: false, calls: ["HA"] })).toBe(false);
  });

  it("an advanced query is a condition, ANDed with the fields", () => {
    // query alone is enough to make the rule fire
    const mm = { ...emptyAlert(), query: "re:/MM$" };
    expect(alertMatches(spot({ dx_call: "HA5XX/MM" }), mm)).toBe(true);
    expect(alertMatches(spot({ dx_call: "HA5XX" }), mm)).toBe(false);
    // combined with a field: both must hold
    const both = { ...emptyAlert(), bands: ["20m"], query: "re:/MM$" };
    expect(alertMatches(spot({ dx_call: "HA5XX/MM", band: "20m" }), both)).toBe(true);
    expect(alertMatches(spot({ dx_call: "HA5XX/MM", band: "40m" }), both)).toBe(false);
    // a blank query is not a condition
    expect(alertMatches(spot(), { ...emptyAlert(), query: "   " })).toBe(false);
  });
});

describe("alertMatches maxKm", () => {
  const rule = { ...emptyAlert(), calls: ["HA"] };
  const near = spot({ by: call({ distance_km: 800 }) });
  const far = spot({ by: call({ distance_km: 5000 }) });
  it("is off at 0", () => {
    expect(alertMatches(far, rule, 0)).toBe(true);
    expect(alertMatches(far, rule)).toBe(true);
  });
  it("measures to the spotter, not the DX", () => {
    const s = spot({ dx: call({ distance_km: 9000 }), by: call({ distance_km: 800 }) });
    expect(alertMatches(s, rule, 1500)).toBe(true);
    expect(alertMatches(far, rule, 1500)).toBe(false);
    expect(alertMatches(near, rule, 500)).toBe(false);
  });
  it("rejects an unknown spotter distance or missing spotter", () => {
    expect(alertMatches(spot({ by: call({ distance_km: null }) }), rule, 1500)).toBe(false);
    expect(alertMatches(spot({ by: null }), rule, 1500)).toBe(false);
  });
});

describe("matchingAlert", () => {
  it("returns the first matching enabled rule, else null", () => {
    const a = { ...emptyAlert(), label: "A", calls: ["9A"] };
    const b = { ...emptyAlert(), label: "B", calls: ["HA"] };
    expect(matchingAlert(spot(), [a, b])?.label).toBe("B");
    expect(matchingAlert(spot(), [a])).toBeNull();
  });
});
