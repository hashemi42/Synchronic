import { SOLAR_HIJRI_OFFSET } from "./calendar";

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

/*
 * Zoom (IN-10). The view window is a Range of whole years, both ends included,
 * like RANGE itself. Window maths uses plain arithmetic: the missing year 0
 * only matters once the range reaches BCE, and costs a one-year skew there.
 */

/** The narrowest window, in years. */
export const MIN_SPAN = 10;

const spanOf = (r: Range) => r.to - r.from + 1;

/** Moves a window of `span` years so it starts near `from` but stays inside `range`. */
function place(from: number, span: number, range: Range): Range {
  const width = Math.min(Math.max(Math.round(span), MIN_SPAN), spanOf(range));
  const start = Math.min(Math.max(Math.round(from), range.from), range.to - width + 1);
  return { from: start, to: start + width - 1 };
}

/**
 * Scales the window by `factor` (below 1 zooms in) around `focus`, a year
 * that keeps its place on screen: the cursor, or the year under the pointer.
 */
export function zoomWindow(view: Range, factor: number, focus: number, range: Range = RANGE): Range {
  const span = spanOf(view);
  const next = Math.min(Math.max(span * factor, MIN_SPAN), spanOf(range));
  const ratio = (focus - view.from) / span;
  return place(focus - ratio * next, next, range);
}

/** Shifts the window by `years`, keeping its width. */
export function panWindow(view: Range, years: number, range: Range = RANGE): Range {
  return place(view.from + years, spanOf(view), range);
}

/** The window itself when `year` is inside it, otherwise the window recentred on `year`. */
export function followYear(view: Range, year: number, range: Range = RANGE): Range {
  if (year >= view.from && year <= view.to) return view;
  return place(year - spanOf(view) / 2, spanOf(view), range);
}

/** A window that frames `r` with a margin on each side, e.g. an anchored reign. */
export function frame(r: { start: number; end: number | null }, range: Range = RANGE): Range {
  const end = r.end ?? range.to;
  const margin = Math.max(2, Math.round((end - r.start) * 0.15));
  return place(r.start - margin, end - r.start + 1 + 2 * margin, range);
}

export const isFullRange = (view: Range, range: Range = RANGE) => view.from <= range.from && view.to >= range.to;

/** Axis ticks for a window: every year when narrow, every 50 years when wide. */
export function ticksFor(view: Range): { step: number; labelEvery: number } {
  const span = spanOf(view);
  if (span <= 16) return { step: 1, labelEvery: 2 };
  if (span <= 40) return { step: 1, labelEvery: 5 };
  if (span <= 90) return { step: 5, labelEvery: 10 };
  if (span <= 200) return { step: 10, labelEvery: 20 };
  return { step: 10, labelEvery: 50 };
}

const SOLAR_MARK = /(ه‍?\.?\s?ش|شمسی|خورشیدی|\bSH\b|\bAP\b)/i;
const GREGORIAN_MARK = /(میلادی|\bCE\b|\bAD\b|\d\s*م(?![\u0600-\u06FF]))/i;

/**
 * Reads a year typed into the dock (L-4). A bare number is in the field's own calendar; "1919 CE",
 * "۱۹۱۹ م" or "500 BCE" say otherwise, and "۱۲۹۸ ه.ش" says Solar Hijri. Returns a Gregorian year.
 */
export function parseYearInCalendar(text: string, fallback: "ce" | "sh"): number | null {
  const n = parseYearInput(text);
  if (n === null || n < 0) return n;
  const s = text.replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d]);
  const calendar = SOLAR_MARK.test(s) ? "sh" : GREGORIAN_MARK.test(s) ? "ce" : fallback;
  return calendar === "sh" ? n + SOLAR_HIJRI_OFFSET : n;
}
