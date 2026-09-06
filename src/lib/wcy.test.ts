import { describe, expect, it } from "vitest";
import { describeWcyCode } from "./wcy";

// Stand-in for the real `tr()` — echoes the key's last segment.
const tr = (k: string) => k.split(".").pop() ?? k;

describe("describeWcyCode", () => {
  it("decodes the known three-letter codes, case-insensitively", () => {
    expect(describeWcyCode("qui", tr)).toBe("quiet");
    expect(describeWcyCode("ACT", tr)).toBe("active");
    expect(describeWcyCode(" maj ", tr)).toBe("majorStorm");
  });
  it("maps the aurora no/yes values", () => {
    expect(describeWcyCode("no", tr)).toBe("none");
    expect(describeWcyCode("yes", tr)).toBe("present");
  });
  it("passes unknown or numeric values straight through", () => {
    expect(describeWcyCode("6", tr)).toBe("6");
    expect(describeWcyCode("wat", tr)).toBe("wat");
  });
});
