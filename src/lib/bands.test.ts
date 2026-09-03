import { describe, expect, it } from "vitest";
import { BANDMAP_BANDS, bandSegments, tickStepKhz } from "./bands";

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
