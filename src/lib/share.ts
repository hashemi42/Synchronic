/**
 * What a shared link says about itself (NF-6): the title, description and preview image of a
 * comparison URL such as /en?year=1919&lanes=iran,uk,russia. Server only.
 */
import { buildLaneModel, reignAt } from "@/components/timeline/model";
import { displayRange, displayYear, formatYear, solarHijriYear, type CalendarLocale } from "./calendar";
import { getAllCountryFiles } from "./data/load";
import { periodsAt } from "./data/query";
import { laneColor } from "./lane-colors";
import type { TimelineState } from "./url-params";

export type ShareLane = { id: string; country: string; color: string; state: string; ruler: string | null; title: string | null };

export type Share = {
  /** "Iran, United Kingdom and Russia in 1919" */
  title: string;
  /** One line per lane: "Iran: Qajar Iran, Ahmad Shah Qajar (Shah)". */
  description: string;
  /** "1919"; in Persian the Solar Hijri year, "۱۲۹۸". */
  year: string;
  /** The Gregorian year beside it in Persian, "۱۹۱۹ م"; null in English. */
  yearSecondary: string | null;
  /** "+2 more" when lanes are left out of the image. */
  moreText: string | null;
  lanes: ShareLane[];
  /** Lanes not shown in the image. */
  more: number;
  anchor: string | null;
};

type Words = {
  inYear: (countries: string, year: string) => string;
  duringReign: (countries: string, name: string, years: string) => string;
  noRuler: string;
  present: string;
  ce: string;
  more: (n: number) => string;
};

const WORDS: Record<CalendarLocale, Words> = {
  en: {
    inYear: (c, y) => `${c} in ${y}`,
    duringReign: (c, n, y) => `${c} during the reign of ${n} (${y})`,
    noRuler: "no single head of state",
    present: "today",
    ce: "CE",
    more: (n) => `+${n} more`,
  },
  fa: {
    inYear: (c, y) => `${c} در ${y}`,
    duringReign: (c, n, y) => `${c} در دوران ${n} (${y})`,
    noRuler: "بدون فرمانروای واحد",
    present: "اکنون",
    ce: "م",
    more: (n) => `+${n.toLocaleString("fa-IR")} کشور دیگر`,
  },
};

export const MAX_IMAGE_LANES = 4;

export function describeComparison(state: TimelineState, locale: CalendarLocale): Share | null {
  const words = WORDS[locale];
  const files = new Map(getAllCountryFiles().map((f) => [f.country.id, f]));
  const models = state.lanes.filter((id) => files.has(id)).map((id) => buildLaneModel(files.get(id)!));
  if (models.length === 0) return null;

  // The anchor's lane leads, as on the page (IN-9).
  const anchored = state.anchor
    ? models.find((m) => m.reigns.some((r) => r.person === state.anchor && r.start !== r.end))
    : undefined;
  const ordered = anchored ? [anchored, ...models.filter((m) => m !== anchored)] : models;

  const lanes: ShareLane[] = ordered.map((m) => {
    const { main } = periodsAt(m.file, state.year);
    const st = main?.state ? m.states.get(main.state) : undefined;
    const reign = reignAt(m, state.year);
    return {
      id: m.file.country.id,
      country: m.file.country.name[locale],
      color: laneColor(m.file.country.id),
      state: main?.label?.[locale] ?? st?.name[locale] ?? main?.note?.[locale] ?? "",
      ruler: reign ? (m.persons.get(reign.person)?.name[locale] ?? reign.person) : null,
      title: reign ? reign.title[locale] : null,
    };
  });

  const names = lanes.map((l) => l.country);
  // Persian lists take no comma before "و": "ایران، بریتانیا و روسیه".
  const list =
    locale === "fa" && names.length > 1
      ? `${names.slice(0, -1).join("، ")} و ${names.at(-1)}`
      : new Intl.ListFormat("en", { type: "conjunction" }).format(names);
  const sh = locale === "fa" ? solarHijriYear(state.year) : null;
  const year = sh !== null ? `${displayYear(state.year, locale)} (${formatYear(state.year, locale)} ${words.ce})` : formatYear(state.year, locale);

  let title = words.inYear(list, year);
  let anchor: string | null = null;
  if (anchored && state.anchor) {
    const reign = anchored.reigns.find((r) => r.person === state.anchor && r.start !== r.end)!;
    anchor = anchored.persons.get(reign.person)?.name[locale] ?? reign.person;
    title = words.duringReign(list, anchor, displayRange(reign, locale, words.present));
  }

  const description = lanes
    .map((l) => `${l.country}: ${[l.state, l.ruler ? `${l.ruler}${l.title ? ` (${l.title})` : ""}` : words.noRuler].filter(Boolean).join(locale === "fa" ? "، " : ", ")}`)
    .join(locale === "fa" ? " · " : " · ");

  return {
    title,
    description,
    year: displayYear(state.year, locale),
    yearSecondary: sh !== null ? `${formatYear(state.year, locale)} ${words.ce}` : null,
    moreText: lanes.length > MAX_IMAGE_LANES ? words.more(lanes.length - MAX_IMAGE_LANES) : null,
    lanes: lanes.slice(0, MAX_IMAGE_LANES),
    more: Math.max(lanes.length - MAX_IMAGE_LANES, 0),
    anchor,
  };
}
