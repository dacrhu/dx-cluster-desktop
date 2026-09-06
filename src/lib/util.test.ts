import { describe, expect, it } from "vitest";
import { hasNonAscii, matchTerms, toAsciiText, toggleIn } from "./util";

describe("toAsciiText", () => {
  it("flags and transliterates accented text", () => {
    expect(hasNonAscii("Arvizturo")).toBe(false);
    expect(hasNonAscii("Árvíztűrő")).toBe(true);
    expect(toAsciiText("Árvíztűrő Tükörfúrógép")).toBe("Arvizturo Tukorfurogep");
  });
  it("folds smart quotes and dashes, replaces the rest", () => {
    expect(toAsciiText("“quote” – dash… ß")).toBe('"quote" - dash... ss');
    expect(toAsciiText("emoji 🚀")).toBe("emoji ?");
  });
  it("leaves plain ASCII untouched", () => {
    expect(toAsciiText("DE HA5XYZ, sked?")).toBe("DE HA5XYZ, sked?");
  });
});

describe("toggleIn", () => {
  it("adds a missing value", () => {
    expect(toggleIn([1, 2], 3)).toEqual([1, 2, 3]);
  });
  it("removes a present value", () => {
    expect(toggleIn([1, 2, 3], 2)).toEqual([1, 3]);
  });
});

describe("matchTerms", () => {
  it("matches with no query", () => {
    expect(matchTerms("hello world", "")).toBe(true);
  });
  it("requires every plain term to be present, case-insensitively", () => {
    expect(matchTerms("Solar Flux Index", "solar flux")).toBe(true);
    expect(matchTerms("Solar Flux Index", "solar missing")).toBe(false);
  });
  it("excludes on a -term", () => {
    expect(matchTerms("please use telnet", "-telnet")).toBe(false);
    expect(matchTerms("no such word here", "-telnet")).toBe(true);
  });
  it("combines include and exclude terms", () => {
    expect(matchTerms("WWV report from Boulder", "wwv -boulder")).toBe(false);
    expect(matchTerms("WWV report from elsewhere", "wwv -boulder")).toBe(true);
  });
  it("ignores a bare dash", () => {
    expect(matchTerms("anything", "-")).toBe(true);
  });
});
