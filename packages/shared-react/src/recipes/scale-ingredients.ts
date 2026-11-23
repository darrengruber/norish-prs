import { readableUnits } from "@norish/shared/lib/readable-unit";

/**
 * The lines at `toServings`, each positive amount scaled from `fromServings` and
 * rounded to four decimals; the lines themselves when nothing changes.
 */
export function scaleIngredients<T extends { amount: number | null }>(
  lines: T[],
  fromServings: number,
  toServings: number
): T[] {
  if (!(fromServings > 0) || toServings === fromServings) return lines;

  return lines.map((line) =>
    line.amount != null && line.amount > 0
      ? { ...line, amount: Math.round((line.amount / fromServings) * toServings * 10000) / 10000 }
      : line
  );
}

/**
 * The lines at `toServings` as a reader sees them: with `readable`, each
 * scaled amount in the unit it reads best in (16 tbsp as 1 cup). Lines at
 * the recipe's own servings keep the units it was written with.
 */
export function scaleIngredientsForReading<
  T extends { amount: number | null; unit?: string | null },
>(lines: T[], fromServings: number, toServings: number, readable: boolean): T[] {
  const scaled = scaleIngredients(lines, fromServings, toServings);

  return readable && scaled !== lines ? readableUnits(scaled) : scaled;
}
