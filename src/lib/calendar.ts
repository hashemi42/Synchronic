/**
 * Year formatting and calendar equivalents (TD-1, L-3, L-4).
 * A Gregorian year straddles two Solar Hijri and two Lunar Hijri years, so the
 * equivalents are ranges: 1919 CE · 1297–98 SH · 1337–38 AH.
 */
export type CalendarLocale = "en" | "fa";

const numberLocale = { en: "en-US", fa: "fa-IR" } as const;

export function formatNumber(n: number, locale: CalendarLocale): string {
  return new Intl.NumberFormat(numberLocale[locale], { useGrouping: false }).format(n);
}

function yearIn(calendar: "persian" | "islamic-umalqura", date: Date): number {
  const parts = new Intl.DateTimeFormat(`en-US-u-ca-${calendar}-nu-latn`, {
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(date);
  return Number(parts.find((p) => p.type === "year")?.value);
}

export type YearRange = { from: number; to: number };

/** Solar and Lunar Hijri years overlapping a Gregorian year. Null before the Hijra or for BCE years. */
export function hijriEquivalents(year: number): { sh: YearRange; ah: YearRange } | null {
  if (year < 623) return null;
  const first = new Date(Date.UTC(year, 0, 1));
  const last = new Date(Date.UTC(year, 11, 31));
  return {
    sh: { from: yearIn("persian", first), to: yearIn("persian", last) },
    ah: { from: yearIn("islamic-umalqura", first), to: yearIn("islamic-umalqura", last) },
  };
}

/** "1297–98" / "۱۲۹۷–۹۸"; a single year when both ends match. */
export function formatYearRange(range: YearRange, locale: CalendarLocale): string {
  const from = formatNumber(range.from, locale);
  if (range.from === range.to) return from;
  const sameCentury = Math.floor(range.from / 100) === Math.floor(range.to / 100);
  const to = sameCentury
    ? new Intl.NumberFormat(numberLocale[locale], { useGrouping: false, minimumIntegerDigits: 2 }).format(range.to % 100)
    : formatNumber(range.to, locale);
  return `${from}–${to}`;
}

/** The bare year number; BCE years lose their sign (the caller adds the era label). */
export function formatYear(year: number, locale: CalendarLocale): string {
  return formatNumber(Math.abs(year), locale);
}

/**
 * The Persian UI leads with the Solar Hijri year (L-4). A Gregorian year straddles two of them, so
 * the headline is the one in force on 1 July, which is always `year − 621`. The two directions
 * therefore round-trip exactly, which the year field relies on.
 */
export const SOLAR_HIJRI_OFFSET = 621;

/** The Solar Hijri headline year, or null before the Hijra (and for BCE years). */
export function solarHijriYear(year: number): number | null {
  return year < 623 ? null : year - SOLAR_HIJRI_OFFSET;
}

export type Headline = { calendar: "ce" | "sh"; value: number };

/** What the year field shows: Solar Hijri in the Persian UI where it exists, Gregorian otherwise. */
export function headlineYear(year: number, locale: CalendarLocale): Headline {
  const sh = locale === "fa" ? solarHijriYear(year) : null;
  return sh === null ? { calendar: "ce", value: year } : { calendar: "sh", value: sh };
}

/*
 * One place decides how a year is written, so the dock, lanes, cards and axes agree (L-4).
 * English shows Gregorian. Persian shows Solar Hijri, with the Gregorian equivalent as secondary
 * text where there is room. Data, URLs and positions on the tracks stay Gregorian throughout.
 */

/** A year in the UI's primary calendar. */
export function displayYear(year: number, locale: CalendarLocale): string {
  const sh = locale === "fa" ? solarHijriYear(year) : null;
  return sh === null ? formatYear(year, locale) : formatNumber(sh, locale);
}

export type YearSpan = { start: number; end: number | null };

/** "1919–1925", "1919", or "۱۲۹۸–۱۳۰۴"; `present` stands for an open end. */
export function displayRange(span: YearSpan, locale: CalendarLocale, present: string): string {
  const y = (v: number | null) => (v === null ? present : displayYear(v, locale));
  return span.start === span.end ? y(span.start) : `${y(span.start)}–${y(span.end)}`;
}

/** The Gregorian equivalent shown beside a Solar Hijri range, or null when it would repeat the primary. */
export function gregorianRange(span: YearSpan, locale: CalendarLocale, present: string): string | null {
  if (locale !== "fa" || span.start < 623) return null;
  const y = (v: number | null) => (v === null ? present : formatYear(v, locale));
  return span.start === span.end ? y(span.start) : `${y(span.start)}–${y(span.end)}`;
}

/**
 * Tick marks for an axis. Each sits at a Gregorian position; in the Persian UI the value is the
 * Solar Hijri year that position stands for, so the labels land on round Solar Hijri numbers.
 */
export function tickPositions(view: { from: number; to: number }, step: number, locale: CalendarLocale) {
  const offset = locale === "fa" && view.from >= 623 ? SOLAR_HIJRI_OFFSET : 0;
  const ticks: { pos: number; value: number }[] = [];
  for (let v = Math.ceil((view.from - offset) / step) * step; v + offset <= view.to + 1; v += step)
    ticks.push({ pos: v + offset, value: v });
  return ticks;
}
