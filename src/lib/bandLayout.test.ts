import { describe, expect, it } from "vitest";
import { linearTickStep, packColumns } from "./bandLayout";

describe("packColumns", () => {
  it("keeps non-overlapping items in one full-width column", () => {
    const r = packColumns(
      [
        { y: 0, h: 10 },
        { y: 10, h: 10 },
        { y: 30, h: 10 },
      ],
      3,
    );
    expect(r.map((x) => [x.col, x.cols])).toEqual([
      [0, 1],
      [0, 1],
      [0, 1],
    ]);
  });
  it("spreads overlapping items sideways and shares the cluster width", () => {
    const r = packColumns(
      [
        { y: 0, h: 10 },
        { y: 4, h: 10 },
        { y: 8, h: 10 },
        { y: 50, h: 10 },
      ],
      3,
    );
    expect(r.map((x) => [x.col, x.cols])).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [0, 1],
    ]);
  });
  it("reuses a column once it is free", () => {
    const r = packColumns(
      [
        { y: 0, h: 10 },
        { y: 5, h: 10 },
        { y: 10, h: 10 },
      ],
      3,
    );
    expect(r.map((x) => x.col)).toEqual([0, 1, 0]);
  });
  it("marks items past maxCols as hidden (-1)", () => {
    const r = packColumns(
      [
        { y: 0, h: 10 },
        { y: 1, h: 10 },
        { y: 2, h: 10 },
      ],
      2,
    );
    expect(r.map((x) => x.col)).toEqual([0, 1, -1]);
  });
});

describe("linearTickStep", () => {
  it("picks coarser steps for lower density", () => {
    expect(linearTickStep(40)).toBe(1);
    expect(linearTickStep(2)).toBe(20);
  });
});
