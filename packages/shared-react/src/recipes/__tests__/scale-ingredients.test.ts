import { describe, expect, it } from "vitest";

import { scaleIngredients, scaleIngredientsForReading } from "../scale-ingredients";

const lines = [
  { id: "flour", amount: 100 },
  { id: "salt", amount: null },
  { id: "eggs", amount: 1 },
];

describe("scaleIngredients", () => {
  it("scales each amount, rounded to four decimals", () => {
    expect(scaleIngredients(lines, 3, 2).map((line) => line.amount)).toEqual([
      66.6667,
      null,
      0.6667,
    ]);
  });

  it("hands back the same lines when the servings don't change or are unknown", () => {
    expect(scaleIngredients(lines, 2, 2)).toBe(lines);
    expect(scaleIngredients(lines, 0, 4)).toBe(lines);
  });

  it("keeps a line without an amount as it is", () => {
    expect(scaleIngredients(lines, 2, 4)[1]).toBe(lines[1]);
  });
});

describe("scaleIngredientsForReading", () => {
  const butter = [{ id: "butter", amount: 8, unit: "tablespoon" }];

  it("shows a scaled amount in the unit it reads best in", () => {
    expect(scaleIngredientsForReading(butter, 2, 4, true)).toEqual([
      { id: "butter", amount: 1, unit: "cup" },
    ]);
  });

  it("keeps the written unit when the reader turned it off", () => {
    expect(scaleIngredientsForReading(butter, 2, 4, false)).toEqual([
      { id: "butter", amount: 16, unit: "tablespoon" },
    ]);
  });

  it("keeps the recipe's own units at its own servings", () => {
    const written = [{ id: "butter", amount: 16, unit: "tablespoon" }];

    expect(scaleIngredientsForReading(written, 2, 2, true)).toBe(written);
  });
});
