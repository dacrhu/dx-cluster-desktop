import { describe, expect, it } from "vitest";
import { lonLatToContinent } from "./continents";
import { locatorToLonLat } from "./grid";

describe("lonLatToContinent", () => {
  const cases: [string, string, string][] = [
    ["Budapest", "JN97", "EU"],
    ["London", "IO91", "EU"],
    ["Washington DC", "FM18", "NA"],
    ["San Francisco", "CM87", "NA"],
    ["São Paulo", "GG66", "SA"],
    ["Nairobi", "KI88", "AF"],
    ["Tokyo", "PM95", "AS"],
    ["Sydney", "QF56", "OC"],
  ];
  for (const [name, grid, cont] of cases) {
    it(`${name} (${grid}) → ${cont}`, () => {
      expect(lonLatToContinent(locatorToLonLat(grid))).toBe(cont);
    });
  }

  it("returns null for a missing point", () => {
    expect(lonLatToContinent(null)).toBeNull();
  });

  it("puts the deep south in Antarctica", () => {
    expect(lonLatToContinent([0, -75])).toBe("AN");
  });
});
