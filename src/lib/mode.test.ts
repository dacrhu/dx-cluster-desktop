import { describe, expect, it } from "vitest";
import { modeArg, modeClass, modeLabel } from "./mode";

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

describe("modeArg", () => {
  it("follows the DIGI setting for digital spots", () => {
    expect(modeArg("DIGI", 14074, "data")).toBe("PKTUSB");
    expect(modeArg("DIGI", 14074, "usb")).toBe("USB");
    expect(modeArg("DIGI", 14074, "none")).toBeUndefined();
  });

  it("maps CW / SSB / FM regardless of the DIGI setting", () => {
    expect(modeArg("CW", 7020, "none")).toBe("CW");
    expect(modeArg("FM", 29600, "none")).toBe("FM");
    expect(modeArg("SSB", 7120, "data")).toBe("LSB");
    expect(modeArg("SSB", 14200, "data")).toBe("USB");
  });
});
