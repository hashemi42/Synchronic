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
