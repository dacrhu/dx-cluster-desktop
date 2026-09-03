import { describe, expect, it } from "vitest";
import { modeClass, modeLabel } from "./mode";

describe("modeClass", () => {
  it("maps to a category class", () => {
    expect(modeClass("CW")).toBe("mode-cw");
    expect(modeClass("DIGI")).toBe("mode-digi");
    expect(modeClass("UNKNOWN")).toBe("");
  });
});

describe("modeLabel", () => {
  it("shows the real sub-mode from the comment for DIGI", () => {
    expect(modeLabel("DIGI", "FT8  -12 dB")).toBe("FT8");
    expect(modeLabel("DIGI", "RTTY contest")).toBe("RTTY");
    expect(modeLabel("DIGI", "cq sstv art")).toBe("SSTV");
    expect(modeLabel("DIGI", "PSK63 CQ")).toBe("PSK63");
  });

  it("falls back to the category when the comment says nothing", () => {
    expect(modeLabel("DIGI", "-08 loud")).toBe("DIGI");
  });

  it("leaves CW / SSB / FM as-is", () => {
    expect(modeLabel("CW", "up 2")).toBe("CW");
    expect(modeLabel("SSB", "59 tnx")).toBe("SSB");
    expect(modeLabel("UNKNOWN", "")).toBe("");
  });
});
