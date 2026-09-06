import { describe, expect, it } from "vitest";
import { qsxFromComment } from "./split";

const q = (c: string, rx: number) => qsxFromComment(c, rx);

describe("qsxFromComment", () => {
  it("resolves relative UP / DOWN offsets", () => {
    expect(q("UP 2", 14020)).toBe(14022);
    expect(q("up1.5", 7005)).toBe(7006.5);
    expect(q("UP 1-3", 14020)).toBe(14021); // low end of the range
    expect(q("DWN 5", 14200)).toBe(14195);
    expect(q("DN 3", 7100)).toBe(7097);
    expect(q("DOWN 2", 7100)).toBe(7098);
    expect(q("QRV up 2, tnx", 21005)).toBe(21007);
  });

  it("takes an explicit absolute QSX frequency", () => {
    expect(q("QSX 14195", 14020)).toBe(14195);
    expect(q("QSX 14195.5", 14020)).toBe(14195.5);
    expect(q("qsx7178 listening", 7005)).toBe(7178);
  });

  it("returns null when there's no usable hint", () => {
    expect(q("UP", 14020)).toBeNull();
    expect(q("CQ CW TEST", 14020)).toBeNull();
    expect(q("GROUP CALL", 14020)).toBeNull();
    expect(q("QSX 599 TU", 14020)).toBeNull();
    expect(q("listening 200 up", 14020)).toBeNull();
    expect(q("UP 200", 14020)).toBeNull(); // > 50 kHz jump
  });
});
