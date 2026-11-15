/**
 * Data schema (PRD §6.1). Shared by the pipeline and the app.
 *
 * Conventions
 * - Years are integers; BCE is negative; there is no year 0.
 * - Ranges are half-open: a period covers start ≤ year < end, so one period's
 *   `end` equals the next one's `start`. `end: null` means "still current".
 * - An office term may have start === end: it began and ended within that year.
 * - Uncertain dates carry `circa: true`.
 * - Every record carries `sources[]`; every label exists in English and Persian.
 */
import { z } from "zod";

export const Year = z
  .int()
  .refine((y) => y !== 0, "There is no year 0: 1 BCE is -1 and 1 CE is 1");

export const Id = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Ids are lowercase kebab-case");

export const WikidataId = z.string().regex(/^Q\d+$/, "Expected a Wikidata item id such as Q794");

/** L-5: both languages are required; a missing Persian label fails validation. */
export const Localized = z.strictObject({
  en: z.string().trim().min(1),
  fa: z.string().trim().min(1),
});

export const Source = z.strictObject({
  title: z.string().trim().min(1),
  url: z.url({ protocol: /^https?$/ }),
});

const sourced = { sources: z.array(Source).min(1, "Every record needs at least one source") };

const range = {
  start: Year,
  end: Year.nullable(),
  circa: z.boolean().optional(),
};

/**
 * An exact date beside a year: "1919-06-28" or "1919-06", Gregorian, common era only. The year
 * field stays the one all range logic uses; this one orders terms within a year and dates events.
 */
export const PartialDate = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/, 'Expected "YYYY-MM" or "YYYY-MM-DD"');
const sameYear = (date: string | undefined, year: number | null | undefined) => date === undefined || Number(date.slice(0, 4)) === year;

const startBeforeEnd = (r: { start: number; end?: number | null }) =>
  r.end == null || r.start < r.end;
const startBeforeEndMessage = { message: "start must be before end", path: ["end"] };

export const Country = z.strictObject({
  id: Id,
  name: Localized,
  aliases: z.array(z.string().min(1)).default([]),
  coreRegion: z.string().min(1).optional(),
  wikidata: WikidataId,
  ...sourced,
});

export const State = z
  .strictObject({
    id: Id,
    name: Localized,
    officialName: Localized.optional(),
    localName: z.string().min(1).optional(),
    ...range,
    capital: Localized.optional(),
    system: Localized.optional(),
    wikidata: WikidataId.optional(),
    ...sourced,
  })
  .refine(startBeforeEnd, startBeforeEndMessage);

export const LaneKind = z.enum(["state", "rival", "occupation", "no-state"]);

export const LanePeriod = z
  .strictObject({
    country: Id,
    /** Null only for `no-state` periods. */
    state: Id.nullable(),
    ...range,
    kind: LaneKind,
    /** Primary label when it differs from the state's name (content policy §7.3). */
    label: Localized.optional(),
    officialName: Localized.optional(),
    note: Localized.optional(),
    ...sourced,
  })
  .refine(startBeforeEnd, startBeforeEndMessage)
  .refine((p) => (p.kind === "no-state") === (p.state === null), {
    message: "`state` must be null for no-state periods and set for every other kind",
    path: ["state"],
  })
  .refine((p) => p.kind !== "no-state" || p.note !== undefined, {
    message: "no-state periods need a short description in `note` (IN-7)",
    path: ["note"],
  });

/**
 * `leader` is for a de facto ruler who held power outside the formal offices
 * (Soviet general secretaries, China's paramount leaders). Where a state has
 * leader terms, the lane's ruler row shows them instead of the head of state.
 *
 * `other` is a formal office that is neither head of state nor head of
 * government but matters for context, named by the term's title (R8: Iran's
 * presidents of 1980–1989, under the Supreme Leader and the Prime Minister).
 * The politics card shows it; the ruler row does not.
 */
export const Office = z.enum(["head-of-state", "head-of-government", "leader", "other"]);

export const OfficeTerm = z
  .strictObject({
    person: Id,
    state: Id,
    office: Office,
    title: Localized,
    ...range,
    exactStart: PartialDate.optional(),
    exactEnd: PartialDate.optional(),
    ...sourced,
  })
  .refine((t) => sameYear(t.exactStart, t.start), { message: "exactStart must fall in the start year", path: ["exactStart"] })
  .refine((t) => sameYear(t.exactEnd, t.end), { message: "exactEnd must fall in the end year", path: ["exactEnd"] })
  // Years are whole numbers, so a term that began and ended in the same year
  // (Edward VIII, 1936) has start === end. Lane periods may not.
  .refine((t) => t.end == null || t.start <= t.end, { message: "start must not be after end", path: ["end"] });

export const Person = z.strictObject({
  id: Id,
  name: Localized,
  localName: z.string().min(1).optional(),
  born: Year.optional(),
  died: Year.optional(),
  wikidata: WikidataId.optional(),
  ...sourced,
});

export const FlagCertainty = z.enum(["documented", "simplified", "reconstructed"]);

export const Flag = z
  .strictObject({
    state: Id,
    /** Wikimedia Commons file name, e.g. "Flag of Persia (1910-1925).svg". */
    file: z.string().min(1),
    name: Localized.optional(),
    ...range,
    certainty: FlagCertainty,
    license: z.string().min(1),
    licenseUrl: z.url({ protocol: /^https?$/ }).optional(),
    attribution: z.string().min(1),
    withheld: z.boolean().default(false),
    ...sourced,
  })
  .refine(startBeforeEnd, startBeforeEndMessage);

export const RelationType = z.enum(["treaty", "war", "union", "partition"]);

export const Relation = z
  .strictObject({
    id: Id,
    type: RelationType,
    name: Localized,
    date: Year.optional(),
    start: Year.optional(),
    end: Year.nullable().optional(),
    parties: z.array(Id).min(2),
    wikidata: WikidataId.optional(),
    ...sourced,
  })
  .refine((r) => (r.date !== undefined) !== (r.start !== undefined), {
    message: "Give either `date` or `start`/`end`, not both",
    path: ["date"],
  })
  .refine((r) => r.start === undefined || startBeforeEnd({ start: r.start, end: r.end }), startBeforeEndMessage);

export const HistoricalEvent = z.strictObject({
  id: Id,
  date: Year,
  place: z.strictObject({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).optional(),
  states: z.array(Id).min(1),
  name: Localized,
  wikidata: WikidataId.optional(),
  ...sourced,
});

export const Narrative = z.strictObject({
  country: Id,
  period: z.strictObject({ start: Year, end: Year.nullable() }),
  label: Localized,
  text: z.strictObject({ en: z.string().min(1), fa: z.string().min(1), local: z.string().min(1).optional() }),
  ...sourced,
});

/** One file per country in data/overrides/countries/. */
export const CountryFile = z.strictObject({
  $schema: z.string().optional(),
  country: Country,
  states: z.array(State),
  persons: z.array(Person),
  lane: z.array(LanePeriod).min(1),
  terms: z.array(OfficeTerm),
  flags: z.array(Flag).default([]),
  narratives: z.array(Narrative).default([]),
});

/** data/overrides/presets.json: curated lane sets for the Add-country dialog (AC-3). */
export const Presets = z.strictObject({
  presets: z.array(z.strictObject({ id: Id, name: Localized, countries: z.array(Id).min(2) })),
  oftenCompared: z.record(Id, z.array(Id).min(1)),
});

/**
 * data/overrides/world.json: the world row (IN-8). Unlike everything else,
 * `last` is the final year included, because a war's last year is a war year
 * (World War I is 1914–1918, and 1918 shows the war).
 */
export const WorldPeriod = z
  .strictObject({
    id: Id,
    kind: z.enum(["war", "era"]),
    name: Localized,
    /** A shorter label for narrow screens and small boxes. */
    short: Localized,
    start: Year,
    last: Year,
    ...sourced,
  })
  .refine((p) => p.start <= p.last, { message: "start must not be after last", path: ["last"] });

export const WorldFile = z.strictObject({
  description: z.string().optional(),
  periods: z.array(WorldPeriod),
});

export type Localized = z.infer<typeof Localized>;
export type WorldPeriod = z.infer<typeof WorldPeriod>;
export type Presets = z.infer<typeof Presets>;
export type Source = z.infer<typeof Source>;
export type Country = z.infer<typeof Country>;
export type State = z.infer<typeof State>;
export type LaneKind = z.infer<typeof LaneKind>;
export type LanePeriod = z.infer<typeof LanePeriod>;
export type OfficeTerm = z.infer<typeof OfficeTerm>;
export type Person = z.infer<typeof Person>;
export type Flag = z.infer<typeof Flag>;
export type Relation = z.infer<typeof Relation>;
export type HistoricalEvent = z.infer<typeof HistoricalEvent>;
export type Narrative = z.infer<typeof Narrative>;
export type CountryFile = z.infer<typeof CountryFile>;
