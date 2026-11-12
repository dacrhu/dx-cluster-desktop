import { describe, expect, it } from "vitest";
import { BANDMAP_BANDS, bandSegments, specialFreqsInBand, tickStepKhz } from "./bands";

describe("bandSegments", () => {
  it("splits a conventional HF band into CW / DIGI / SSB", () => {
    const b20 = BANDMAP_BANDS.find((b) => b.label === "20m")!;
    const segs = bandSegments(b20);
    expect(segs.map((s) => s.mode)).toEqual(["CW", "DIGI", "SSB"]);
    expect(segs[0]).toMatchObject({ fromKhz: 14000, toKhz: 14070 });
    expect(segs.at(-1)).toMatchObject({ toKhz: 14350 });
  });

  it("gives a CW/digi-only band no phone segment", () => {
    const b30 = BANDMAP_BANDS.find((b) => b.label === "30m")!;
    expect(bandSegments(b30).some((s) => s.mode === "SSB")).toBe(false);
  });

  it("covers the whole span with contiguous segments", () => {
    for (const b of BANDMAP_BANDS) {
      const segs = bandSegments(b);
      expect(segs[0].fromKhz).toBe(b.lowKhz);
      expect(segs.at(-1)!.toKhz).toBe(b.highKhz);
      for (let i = 1; i < segs.length; i++) expect(segs[i].fromKhz).toBe(segs[i - 1].toKhz);
    }
  });
});

describe("tickStepKhz", () => {
  it("scales the tick spacing with the span", () => {
    expect(tickStepKhz(50)).toBe(10);
    expect(tickStepKhz(350)).toBe(50);
    expect(tickStepKhz(1700)).toBe(250);
  });
});

describe("specialFreqsInBand", () => {
  it("finds the IBP beacon frequency inside 20m", () => {
    const b20 = BANDMAP_BANDS.find((b) => b.label === "20m")!;
    const found = specialFreqsInBand(b20);
    expect(found).toContainEqual({ khz: 14100, kind: "ibp" });
    expect(found).toContainEqual({ khz: 14300, kind: "sos" });
  });

  it("returns nothing for a band with no marker frequency", () => {
    const b60 = BANDMAP_BANDS.find((b) => b.label === "60m")!;
    expect(specialFreqsInBand(b60)).toEqual([]);
  });
});

describe("optional + custom markers", () => {
  const b20 = BANDMAP_BANDS.find((b) => b.label === "20m")!;
  const b17 = BANDMAP_BANDS.find((b) => b.label === "17m")!;

  it("shows nothing optional by default, SOS/IBP always", () => {
    const found = specialFreqsInBand(b20);
    expect(found.map((f) => f.kind).sort()).toEqual(["ibp", "sos"]);
  });

  it("adds an enabled kind only", () => {
    const found = specialFreqsInBand(b20, ["ft8"]);
    expect(found).toContainEqual({ khz: 14074, kind: "ft8" });
    expect(found.some((f) => f.kind === "ft4")).toBe(false);
  });

  it("adds custom markers inside the band, ignores those outside", () => {
    const c = [
      { id: "a", name: "Net", khz: 14222.5 },
      { id: "b", name: "Far", khz: 7123 },
    ];
    const found = specialFreqsInBand(b20, [], c);
    expect(found).toContainEqual({ khz: 14222.5, kind: "custom", label: "Net", color: undefined });
    expect(found.some((f) => f.khz === 7123)).toBe(false);
  });

  it("merges markers on the same kHz into one row, primary kind wins", () => {
    const found = specialFreqsInBand(b17, ["ft4", "js8"]).filter((f) => f.khz === 18104);
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe("ft4");
    expect(found[0].label).toBe("FT4 · JS8");
  });
});
