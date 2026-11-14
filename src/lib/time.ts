/** The time range, stepping and year parsing shared by the dock and the lanes. */

export type Range = { from: number; to: number };

/** Phase 1 covers the hand-made Iran lane. The pipeline will emit this range with the data. */
export const RANGE: Range = { from: 1789, to: 2026 };
export const DEFAULT_YEAR = 1919;

export const STEPS = ["year", "decade", "century", "reign"] as const;
export type Step = (typeof STEPS)[number];

const SIZE: Record<Exclude<Step, "reign">, number> = { year: 1, decade: 10, century: 100 };

// There is no year 0, so arithmetic goes through astronomical numbering (1 BCE = 0).
const toAstronomical = (y: number) => (y < 0 ? y + 1 : y);
const fromAstronomical = (a: number) => (a <= 0 ? a - 1 : a);

export function clampYear(year: number, range: Range = RANGE): number {
  const y = Math.min(Math.max(Math.trunc(year), range.from), range.to);
  return y === 0 ? 1 : y;
}

/**
 * Moves `times` steps forward (1) or back (-1). A "reign" step jumps to the
 * next or previous year in `boundaries` (the years a reign begins).
 */
export function stepYear(
  year: number,
  direction: 1 | -1,
  step: Step,
  options: { boundaries?: number[]; range?: Range; times?: number } = {},
): number {
  const { boundaries = [], range = RANGE, times = 1 } = options;
  let y = year;
  for (let i = 0; i < times; i++) {
    if (step === "reign") {
      const sorted = [...boundaries].sort((a, b) => a - b);
      const target =
        direction === 1 ? sorted.find((b) => b > y) : sorted.findLast((b) => b < y);
      y = target ?? (direction === 1 ? range.to : range.from);
    } else {
      y = fromAstronomical(toAstronomical(y) + direction * SIZE[step]);
    }
    y = clampYear(y, range);
  }
  return y;
}

const DIGITS: Record<string, string> = {};
"۰۱۲۳۴۵۶۷۸۹".split("").forEach((d, i) => (DIGITS[d] = String(i)));
"٠١٢٣٤٥٦٧٨٩".split("").forEach((d, i) => (DIGITS[d] = String(i)));

const BCE = /(b\.?c\.?e?\.?|پ\.?\s?م|ق\.?\s?م|پیش از میلاد|قبل از میلاد)/i;

/** Reads "1919", "۱۹۱۹", "500 BCE", "-500" or "۵۰۰ پ.م". Null when it is not a year. */
export function parseYearInput(text: string): number | null {
  const s = text.replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d]).trim();
  const digits = /\d+/.exec(s);
  if (!digits) return null;
  const n = Number.parseInt(digits[0], 10);
  if (!Number.isSafeInteger(n) || n === 0) return null;
  const negative = /^[-−–]/.test(s) || BCE.test(s);
  return negative ? -n : n;
}
