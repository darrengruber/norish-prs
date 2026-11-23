/**
 * A scaled amount shown in the unit it reads best in (#487): a neighbouring
 * unit of the same system when the amount lands there on a whole, half or
 * quarter, else the unit the recipe was written in.
 */
import { describe, expect, it } from "vitest";

import { readableMeasure, readableUnits } from "@norish/shared/lib/readable-unit";

describe("readableMeasure", () => {
  it.each([
    ["16 tbsp is a cup", 16, "tablespoon", { amount: 1, unit: "cup" }],
    ["12 tbsp is ¾ cup", 12, "tablespoon", { amount: 0.75, unit: "cup" }],
    ["4 tbsp is ¼ cup", 4, "tablespoon", { amount: 0.25, unit: "cup" }],
    ["3 tsp is a tablespoon", 3, "teaspoon", { amount: 1, unit: "tablespoon" }],
    ["4½ tsp is 1½ tbsp", 4.5, "teaspoon", { amount: 1.5, unit: "tablespoon" }],
    ["48 tsp skips to a cup", 48, "teaspoon", { amount: 1, unit: "cup" }],
    ["32 oz is 2 lb", 32, "ounce", { amount: 2, unit: "pound" }],
    ["1500 ml is 1.5 l", 1500, "milliliter", { amount: 1.5, unit: "liter" }],
    ["2000 g is 2 kg", 2000, "gram", { amount: 2, unit: "kilogram" }],
    ["⅛ cup is 2 tbsp", 0.125, "cup", { amount: 2, unit: "tablespoon" }],
    ["0.6 l is 600 ml", 0.6, "liter", { amount: 600, unit: "milliliter" }],
    ["0.25 kg is 250 g", 0.25, "kg", { amount: 250, unit: "gram" }],
    ["0.3 kg is 300 g", 0.3, "kg", { amount: 300, unit: "gram" }],
    ["a unit spelled short climbs too", 16, "tbsp", { amount: 1, unit: "cup" }],
    ["case does not matter", 16, "TBSP", { amount: 1, unit: "cup" }],
    ["a plural spelling climbs", 3, "teaspoons", { amount: 1, unit: "tablespoon" }],
    ["64 tbsp is 4 cups", 64, "tablespoon", { amount: 4, unit: "cup" }],
    ["10 tbsp scaled ×4 is 2½ cups", 40, "tablespoon", { amount: 2.5, unit: "cup" }],
    ["24 oz is 1½ lb", 24, "ounce", { amount: 1.5, unit: "pound" }],
    ["6 oz written as ⅜ lb comes down", 0.375, "lb", { amount: 6, unit: "ounce" }],
    ["0.5 kg is 500 g, metric reads in decimals", 0.5, "kilogram", { amount: 500, unit: "gram" }],
    ["2.5 l of stock stays litres", 2500, "ml", { amount: 2.5, unit: "liter" }],
  ])("%s", (_, amount, unit, expected) => {
    expect(readableMeasure(amount, unit)).toEqual(expected);
  });

  it.each([
    ["8 tsp lands on no quarter of a tablespoon", 8, "teaspoon"],
    ["6 tbsp is under a quarter cup's quarters", 6, "tablespoon"],
    ["½ tbsp is a measure", 0.5, "tablespoon"],
    ["⅓ cup is a measure", 0.3333, "cup"],
    ["1½ tsp is under a tablespoon", 1.5, "teaspoon"],
    ["8 oz is written in ounces", 8, "ounce"],
    ["500 ml is written in millilitres", 500, "milliliter"],
    ["a messy amount stays where it was written", 2.37, "cup"],
    ["a pinch has no ladder", 2, "pinch"],
    ["a heaping teaspoon is its own unit", 3, "heaping_teaspoon"],
    ["a scant tablespoon too", 16, "scant tablespoon"],
    ["1.5 kg is already readable", 1.5, "kilogram"],
    ["½ lb is a measure", 0.5, "pound"],
    ["fluid ounces never turn into cups", 16, "fl oz"],
    ["decilitres are not on the ladder", 15, "deciliter"],
    ["a unit nobody knows", 16, "handful"],
    ["a dozen counts, not measures", 2, "dozen"],
  ])("%s", (_, amount, unit) => {
    expect(readableMeasure(amount, unit)).toEqual({ amount, unit });
  });

  it("leaves an amount without a unit, or no positive amount, alone", () => {
    expect(readableMeasure(16, null)).toEqual({ amount: 16, unit: null });
    expect(readableMeasure(0, "tablespoon")).toEqual({ amount: 0, unit: "tablespoon" });
    expect(readableMeasure(16, "")).toEqual({ amount: 16, unit: "" });
    expect(readableMeasure(-16, "tablespoon")).toEqual({ amount: -16, unit: "tablespoon" });
    expect(readableMeasure(Number.NaN, "tablespoon")).toEqual({
      amount: Number.NaN,
      unit: "tablespoon",
    });
    expect(readableMeasure(Infinity, "tablespoon")).toEqual({
      amount: Infinity,
      unit: "tablespoon",
    });
  });

  it("absorbs the four-decimal rounding a scaled amount carries", () => {
    // 3 tbsp for 3 scaled to 16 servings: 16 tbsp, stored as 16.0000.
    expect(readableMeasure(15.99999, "tablespoon")).toEqual({ amount: 1, unit: "cup" });
  });
});

describe("readableUnits", () => {
  const lines = [
    { id: "butter", amount: 16, unit: "tablespoon" },
    { id: "eggs", amount: 2, unit: null },
    { id: "salt", amount: null, unit: "teaspoon" },
  ];

  it("changes only the lines that read better elsewhere, keeping the rest of each line", () => {
    const shown = readableUnits(lines);

    expect(shown[0]).toEqual({ id: "butter", amount: 1, unit: "cup" });
    expect(shown[1]).toBe(lines[1]);
    expect(shown[2]).toBe(lines[2]);
  });

  it("hands back the same line when nothing reads better, so memoised rows stay put", () => {
    const messy = [{ id: "milk", amount: 2.37, unit: "cup" }];

    expect(readableUnits(messy)[0]).toBe(messy[0]);
  });

  it("never mixes systems: metric stays metric, US stays US", () => {
    const shown = readableUnits([
      { id: "stock", amount: 1000, unit: "milliliter" },
      { id: "flour", amount: 1000, unit: "gram" },
      { id: "sugar", amount: 32, unit: "tablespoon" },
      { id: "beef", amount: 32, unit: "ounce" },
    ]);

    expect(shown.map(({ unit }) => unit)).toEqual(["liter", "kilogram", "cup", "pound"]);
  });

  it("returns an empty list for an empty list", () => {
    expect(readableUnits([])).toEqual([]);
  });
});
