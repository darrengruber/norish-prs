/**
 * The unit a scaled amount reads best in (#487). Doubling "8 tbsp butter"
 * gives "16 tbsp", which nobody measures: it is "1 cup". Halving "1 tbsp"
 * gives "0.5 tbsp", which reads better as "1½ tsp".
 *
 * An amount moves to a neighbouring unit of the same system and family only
 * when it lands there on a whole, half or quarter, the sizes a kitchen has
 * measures for. Anything else stays in the unit the recipe was written in,
 * so a messy amount is never traded for a messier one. Spoons and cups
 * belong to US volume, millilitres and litres to metric volume. Only the
 * shown amount changes: the recipe keeps what it was written with.
 */
import { resolveUnit } from "./units";

/**
 * Smaller to larger: each unit, how many of the one before make one of it,
 * and the least of it an amount is shown in. A quarter cup is a measure; a
 * quarter pound or half a litre is written as ounces or millilitres.
 */
type Rung = readonly [unit: string, factor: number, least: number];

/** A ladder's units, and whether it is read in fractions, as US measures are. */
interface Ladder {
  rungs: ReadonlyArray<Rung>;
  fractional: boolean;
}

const LADDERS: ReadonlyArray<Ladder> = [
  {
    rungs: [
      ["teaspoon", 1, 0],
      ["tablespoon", 3, 1],
      ["cup", 16, 0.25],
    ],
    fractional: true,
  },
  {
    rungs: [
      ["ounce", 1, 0],
      ["pound", 16, 1],
    ],
    fractional: true,
  },
  {
    rungs: [
      ["milliliter", 1, 0],
      ["liter", 1000, 1],
    ],
    fractional: false,
  },
  {
    rungs: [
      ["gram", 1, 0],
      ["kilogram", 1000, 1],
    ],
    fractional: false,
  },
];

/** How close to a fraction an amount must be to count as one, absorbing float error. */
const TOLERANCE = 0.001;

export interface ReadableMeasure {
  amount: number;
  unit: string | null;
}

function onFraction(value: number, parts: number): boolean {
  return Math.abs(value * parts - Math.round(value * parts)) < TOLERANCE;
}

function snapToQuarter(value: number): number {
  return Math.round(value * 4) / 4;
}

/** A heaping or scant spoon is its own measure, though the unit table sizes it as a spoon. */
const OWN_MEASURE = /^(heaping|scant)[_ ]/i;

function findRung(unit: string): { ladder: Ladder; index: number } | null {
  if (OWN_MEASURE.test(unit)) return null;

  const id = resolveUnit(unit)?.id;

  if (!id) return null;

  for (const ladder of LADDERS) {
    const index = ladder.rungs.findIndex(([rung]) => rung === id);

    if (index >= 0) return { ladder, index };
  }

  return null;
}

/**
 * `amount` of `unit` in the unit it reads best in: the largest unit up its
 * ladder it lands on a quarter in, at least that unit's least; else, for an
 * amount under its own unit's least (and in US measures no quarter or
 * third), the nearest smaller unit it lands on a quarter in; else as given.
 */
export function readableMeasure(amount: number, unit: string | null): ReadableMeasure {
  if (!unit || !(amount > 0) || !Number.isFinite(amount)) return { amount, unit };

  const rung = findRung(unit);

  if (!rung) return { amount, unit };

  const { ladder, index } = rung;
  const { rungs } = ladder;

  // Up: 16 tbsp is 1 cup, 12 tbsp is ¾ cup, 1500 ml is 1.5 l.
  let size = 1;
  let best: ReadableMeasure | null = null;

  for (let i = index + 1; i < rungs.length; i++) {
    const [larger, factor, least] = rungs[i]!;

    size *= factor;
    const there = amount / size;

    if (there < least) break;
    if (onFraction(there, 4)) best = { amount: snapToQuarter(there), unit: larger };
  }

  if (best) return best;

  // Down, only from an amount too small to measure in its own unit: ⅛ cup is
  // 2 tbsp, 0.25 kg is 250 g. In US measures ½ tbsp and ⅓ cup are measures
  // themselves and stay.
  const ownLeast = rungs[index]![2] || 1;
  const measuredAsIs = ladder.fractional && (onFraction(amount, 4) || onFraction(amount, 3));

  if (amount < ownLeast && !measuredAsIs) {
    size = 1;

    for (let i = index; i > 0; i--) {
      size *= rungs[i]![1];
      const there = amount * size;

      if (there >= rungs[i]![1]) break;
      if (onFraction(there, 4)) return { amount: snapToQuarter(there), unit: rungs[i - 1]![0] };
    }
  }

  return { amount, unit };
}

/** Each line's amount and unit in the unit it reads best in; the rest of the line as it is. */
export function readableUnits<T extends { amount: number | null; unit?: string | null }>(
  lines: T[]
): T[] {
  return lines.map((line) => {
    if (line.amount == null || !line.unit) return line;

    const shown = readableMeasure(line.amount, line.unit);

    return shown.unit === line.unit && shown.amount === line.amount
      ? line
      : { ...line, amount: shown.amount, unit: shown.unit };
  });
}
