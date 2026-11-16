/**
 * Pipeline, stages 2 and 3 (PRD §6.3): raw Wikidata rows → records in the schema, then the curated
 * layer on top, which always wins. Pure: no network and no file access, so the same raw files and
 * the same curated file always give the same output.
 *
 * From Wikidata: who held which office and when (P39 on the offices, P35 and P6 on the states),
 * people's names and years, and each flag's licence from Commons.
 * Curated (data/overrides/countries/<id>.json): the country, its states, the lane, which offices
 * count and what their holders are called, record ids, flags, and the patches: terms Wikidata
 * lacks or gets wrong, names kept against the default, and holders left out, each with a reason.
 */
import type { Raw } from "./fetch";
import { EXCLUDE, EXCLUDE_TERMS, RULES } from "./rules";
import { qid, when, type Row, type When } from "./wikidata";

export type Localized = { en: string; fa: string };
export type Source = { title: string; url: string };
export type Office = "head-of-state" | "head-of-government" | "leader" | "other";
export type Term = {
  person: string; state: string; office: Office; title: Localized;
  start: number; end: number | null; exactStart?: string; exactEnd?: string; sources: Source[];
};
export type Person = { id: string; name: Localized; localName?: string; born?: number; died?: number; wikidata?: string; sources: Source[] };
export type State = {
  id: string; name: Localized; officialName?: Localized; localName?: string; start: number; end: number | null;
  circa?: boolean; capital?: Localized; system?: Localized; wikidata?: string; sources: Source[];
};
export type LanePeriod = { country: string; state: string | null; start: number; end: number | null; kind: string; [k: string]: unknown };
export type Flag = { state: string; file: string; start: number; end: number | null; license: string; licenseUrl?: string; attribution: string; sha1?: string; retrieved?: string; [k: string]: unknown };
export type CountryFile = {
  country: { id: string; name: Localized; wikidata: string; [k: string]: unknown };
  states: State[]; persons: Person[]; lane: LanePeriod[]; terms: Term[]; flags: Flag[]; narratives?: unknown[];
};

/** A head-of-state office: its holders (P39) become head-of-state terms with this title. */
export type OfficeRule = {
  office: string;
  title: Localized;
  /** Set when the holders belong to one state off the main sequence; otherwise they are placed by date. */
  state?: string;
  /** The office counts only from, or until, this year (the Republic of China's presidency until 1949). */
  from?: number;
  until?: number;
  /** Only holders of these families (P53): a title shared across countries, narrowed to one dynasty. */
  family?: string[];
  note?: string;
};
/** The curated file of one country: data/overrides/countries/<id>.json. */
export type Curated = {
  country: CountryFile["country"];
  states: State[];
  lane: LanePeriod[];
  offices: OfficeRule[];
  /** Every person's id (ids are in shared URLs), and any name kept against the default, with the reason. */
  persons: { id: string; wikidata: string; name?: Partial<Localized>; note?: string }[];
  /** Terms Wikidata lacks or gets wrong. They replace the pipeline's terms for that person and office. */
  terms: Term[];
  /** A title for one term where the office's title does not fit ("Queen", "Empress"). */
  titles: { person: string; office: Office; state: string; title: Localized }[];
  /** Holders on Wikidata left out on purpose, by rule (docs/data-rules.md). */
  exclude: { wikidata: string; office: "head-of-state" | "head-of-government"; reason: string }[];
  flags: Flag[];
  narratives?: unknown[];
};
/** A head-of-government term Wikidata lacks (data/overrides/heads-of-government.json). */
export type AddedTerm = { country: string; office: string; person: string; name: Localized; start: number; end: number | null; sources?: Source[] };

export type Config = {
  curated: Curated;
  hogOffices: string[];
  /** Offices that became the head of government in a given year (Turkey's presidency, 2018). */
  hogFrom: Record<string, number>;
  /** Persian names for people with no Persian Wikipedia article or label, by Wikidata id. */
  manualFa: Record<string, string>;
  addedTerms: AddedTerm[];
};

export type NameSource = "fa.wikipedia" | "Wikidata label" | "persian-names.json" | "override" | "none";
export type Note = { kind: string; record: string; detail: string };
export type Result = {
  file: CountryFile;
  /** Where each person's Persian name came from, by Wikidata id. */
  persian: Map<string, NameSource>;
  /** How many terms came from Wikidata statements and how many from the curated file. */
  origin: { wikidata: number; curated: number };
  notes: Note[];
};

const GENERIC: Record<string, Localized> = {
  "head-of-state": { en: "Head of state", fa: "رئیس کشور" },
  "head-of-government": { en: "Head of government", fa: "رئیس دولت" },
};
/** Flags may be used under these licences (data phase proposal, section 2). */
export const LICENCES = /^(public domain|pd\b|cc0|cc by(-sa)? \d)/i;

export const slug = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** A Wikipedia title without its disambiguator: "Abbas Mirza (prince)" → "Abbas Mirza". */
export const clean = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, "").trim();
const wikiUrl = (lang: string, title: string) => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;

type Names = { labelEn?: string; labelMul?: string; labelFa?: string; wikiEn?: string; wikiFa?: string };

export function indexNames(rows: Row[]): Map<string, Names> {
  const out = new Map<string, Names>();
  const field: Record<string, keyof Names> = { "label:en": "labelEn", "label:mul": "labelMul", "label:fa": "labelFa", "wiki:en": "wikiEn", "wiki:fa": "wikiFa" };
  for (const r of rows) {
    const q = qid(r.item);
    const n = out.get(q) ?? {};
    n[field[r.kind]] ??= r.name;
    out.set(q, n);
  }
  return out;
}

/**
 * The Persian name rule: the fa.wikipedia title, unless it carries brackets or a comma (a
 * disambiguator or a full formal name: "لئوپولد دوم، امپراتور مقدس روم"), then Wikidata's Persian
 * label, then data/overrides/persian-names.json.
 */
export function persianName(n: Names | undefined, manual: string | undefined): { value: string | null; from: NameSource } {
  if (n?.wikiFa && !/[()،,]/.test(n.wikiFa)) return { value: n.wikiFa, from: "fa.wikipedia" };
  if (n?.labelFa) return { value: n.labelFa, from: "Wikidata label" };
  if (manual) return { value: manual, from: "persian-names.json" };
  return { value: n?.wikiFa ? clean(n.wikiFa) : null, from: n?.wikiFa ? "fa.wikipedia" : "none" };
}

/**
 * Joins terms of one person in one state and office that overlap (successive cabinets on one
 * statement each). `rank` says how good each term's title is (lower wins): a curated rule, or the
 * generic fallback.
 */
export function joinTerms(terms: Term[], rank: (t: Term) => number = () => 0): Term[] {
  const sorted = [...terms].sort(
    (a, b) => a.state.localeCompare(b.state) || a.office.localeCompare(b.office) || a.person.localeCompare(b.person) || a.start - b.start,
  );
  const out: Term[] = [];
  const ranks = new Map<Term, number>();
  for (const t of sorted) {
    const prev = out.at(-1);
    const same = prev && prev.person === t.person && prev.state === t.state && prev.office === t.office;
    if (same && t.start < (prev.end ?? Infinity) + (prev.end === prev.start ? 1 : 0)) {
      if (prev.end !== null && (t.end === null || t.end > prev.end)) {
        prev.end = t.end;
        if (t.exactEnd) prev.exactEnd = t.exactEnd;
        else delete prev.exactEnd;
      }
      if (rank(t) < (ranks.get(prev) ?? 0)) {
        prev.title = t.title;
        ranks.set(prev, rank(t));
      }
    } else {
      const copy = { ...t };
      ranks.set(copy, rank(t));
      out.push(copy);
    }
  }
  return out;
}

const byStart = (a: Term, b: Term) =>
  a.start - b.start || (a.end ?? Infinity) - (b.end ?? Infinity) || a.office.localeCompare(b.office) || a.person.localeCompare(b.person) || a.state.localeCompare(b.state);

/** R3: is this statement qualified as acting or interim, and for less than a year? */
function briefStandIn(nature: string | undefined, start: When, end: When | null): boolean {
  if (!nature || !/\b(acting|interim|caretaker|provisional)\b/i.test(nature) || !end) return false;
  if (start.exact?.length === 10 && end.exact?.length === 10) return Date.parse(end.exact) - Date.parse(start.exact) < 365 * 86_400_000;
  return end.year - start.year < 1;
}

export function normalize(raw: Raw, cfg: Config): Result {
  const { curated } = cfg;
  const country = curated.country.id;
  const notes: Note[] = [];
  const names = indexNames(raw.names);
  const persian = new Map<string, NameSource>();
  const en = (q: string) => {
    const n = names.get(q);
    return n?.wikiEn ? clean(n.wikiEn) : (n?.labelEn ?? n?.labelMul ?? null);
  };
  const sourcesOf = (q: string, name: string): Source[] => {
    const n = names.get(q);
    return [
      ...(n?.wikiEn ? [{ title: `${n.wikiEn} — Wikipedia`, url: wikiUrl("en", n.wikiEn) }] : []),
      { title: `${name} — Wikidata`, url: `https://www.wikidata.org/wiki/${q}` },
    ];
  };
  const time = (r: Row, k: "at" | "start" | "end") => when(r[k], r[`${k}Prec`], r[`${k}Cal`]);

  // ------------------------------------------------------------ the lane and the states (curated)
  const mainline = curated.lane.filter((p) => p.kind !== "rival" && p.kind !== "parallel" && p.state).sort((a, b) => a.start - b.start);
  const first = Math.min(...curated.lane.map((p) => p.start));
  const stateAt = (y: number) => mainline.find((p) => p.start <= y && (p.end === null || y < p.end))?.state ?? null;
  /** The years a state holds a place in the lane. */
  const span = (id: string) => {
    const periods = curated.lane.filter((p) => p.state === id);
    if (periods.length === 0) return null;
    return { start: Math.min(...periods.map((p) => p.start)), end: periods.some((p) => p.end === null) ? null : Math.max(...periods.map((p) => p.end!)) };
  };
  const stateIdsOf = (q: string) => curated.states.filter((s) => s.wikidata === q).map((s) => s.id);

  // ------------------------------------------------------------ people
  const facts = new Map<string, { born?: number; died?: number; family: Set<string> }>();
  for (const r of raw.people) {
    const e = facts.get(qid(r.item)) ?? { family: new Set<string>() };
    if (r.prop === "P53") e.family.add(qid(r.value));
    else {
      const y = time(r, "at")?.year;
      if (y != null) e[r.prop === "P569" ? "born" : "died"] ??= y;
    }
    facts.set(qid(r.item), e);
  }
  const registry = new Map(curated.persons.map((p) => [p.wikidata, p]));
  const added = new Map(cfg.addedTerms.map((t) => [t.person, t.name]));
  const persons = new Map<string, Person>();
  const personOf = (q: string): Person => {
    let p = persons.get(q);
    if (p) return p;
    const kept = registry.get(q);
    const nameEn = kept?.name?.en ?? en(q) ?? added.get(q)?.en ?? q;
    const auto = persianName(names.get(q), cfg.manualFa[q]);
    const nameFa = kept?.name?.fa ?? auto.value ?? added.get(q)?.fa ?? "";
    persian.set(q, kept?.name?.fa || !auto.value ? (nameFa ? "override" : "none") : auto.from);
    let id = kept?.id ?? slug(nameEn);
    if (!kept && ([...persons.values()].some((x) => x.id === id) || curated.persons.some((x) => x.id === id))) id = `${id}-${q.toLowerCase()}`;
    const f = facts.get(q);
    p = { id, name: { en: nameEn, fa: nameFa }, ...(f?.born != null ? { born: f.born } : {}), ...(f?.died != null ? { died: f.died } : {}), wikidata: q, sources: sourcesOf(q, nameEn) };
    persons.set(q, p);
    return p;
  };

  // ------------------------------------------------------------ statements
  type Statement = { person: string; office: "head-of-state" | "head-of-government"; start: When | null; end: When | null; state: string | null; title: Localized | null; via: string; nature?: string; sources?: Source[] };
  const statements: Statement[] = [];
  const natureOf = (r: Row) => (r.nature ? (en(qid(r.nature)) ?? undefined) : undefined);

  // P35 and P6 on the state items. An item shared by several states of the lane (Q142 for every
  // French republic) is placed by date. They carry no office, so the title comes from the same
  // person's P39 statement where there is one, or from the curated file.
  for (const r of raw.states.filter((x) => x.prop === "P35" || x.prop === "P6")) {
    if (!r.value.startsWith("http://www.wikidata.org/entity/Q")) continue;
    const item = qid(r.item);
    const ids = stateIdsOf(item);
    statements.push({
      person: qid(r.value), office: r.prop === "P35" ? "head-of-state" : "head-of-government",
      start: time(r, "start"), end: time(r, "end"), state: ids.length === 1 ? ids[0] : null, title: null, via: `${r.prop} on ${item}`, nature: natureOf(r),
    });
  }
  for (const r of raw.holders) {
    const office = qid(r.office);
    const person = qid(r.person);
    let start = time(r, "start");
    let end = time(r, "end");
    for (const head of curated.offices.filter((o) => o.office === office)) {
      const inFamily = !head.family || head.family.some((f) => facts.get(person)?.family.has(f));
      const tooEarly = head.from !== undefined && end && end.year <= head.from;
      const tooLate = head.until !== undefined && start && start.year >= head.until;
      if (inFamily && !tooEarly && !tooLate) {
        if (head.from !== undefined && start && start.year < head.from) start = { year: head.from };
        if (head.until !== undefined && start && (!end || end.year > head.until)) end = { year: head.until };
        statements.push({ person, office: "head-of-state", start, end, state: head.state ?? null, title: head.title, via: `P39 ${office}`, nature: natureOf(r) });
      }
      start = time(r, "start");
      end = time(r, "end");
    }
    // Head-of-government offices are placed and titled by their rule (scripts/pipeline/rules.ts).
    if (cfg.hogOffices.includes(office)) {
      const from = cfg.hogFrom[office];
      if (from !== undefined && end && end.year <= from) continue;
      if (from !== undefined && start && start.year < from) start = { year: from };
      const rule = start ? RULES[office]?.(start.year) : null;
      if (start && !rule) continue;
      statements.push({ person, office: "head-of-government", start, end, state: rule?.state ?? null, title: rule?.title ?? null, via: `P39 ${office}`, nature: natureOf(r) });
    }
  }
  for (const t of cfg.addedTerms.filter((x) => x.country === country)) {
    const rule = RULES[t.office]?.(t.start);
    if (!rule) continue;
    statements.push({ person: t.person, office: "head-of-government", start: { year: t.start }, end: t.end === null ? null : { year: t.end }, state: rule.state, title: rule.title, via: "data/overrides/heads-of-government.json", sources: t.sources });
  }

  // ------------------------------------------------------------ statements → terms
  const excluded = new Map(curated.exclude.map((x) => [`${x.wikidata}:${x.office}`, x.reason]));
  const curatedGroups = new Set(curated.terms.map((t) => `${t.person}|${t.office}`));
  const pieces: Term[] = [];
  const titleRank = new Map<Term, number>();
  for (const s of statements) {
    const label = `${en(s.person) ?? s.person} · ${s.office}`;
    if (excluded.has(`${s.person}:${s.office}`) || (s.office === "head-of-government" && EXCLUDE[s.person])) continue;
    if (s.office === "head-of-government" && EXCLUDE_TERMS[`${s.person}:${s.start?.year ?? null}-${s.end?.year ?? null}`]) continue;
    if (!s.start) {
      notes.push({ kind: "statement without a start date", record: label, detail: `${s.via}; end ${s.end?.year ?? "none"}` });
      continue;
    }
    if (s.end && s.end.year < first) continue;
    // No end date means "still in office" only for the living; for the dead it is a missing date.
    if (!s.end && facts.get(s.person)?.died != null) {
      notes.push({ kind: "statement without an end date", record: label, detail: `${s.via}; start ${s.start.year}` });
      continue;
    }
    if (briefStandIn(s.nature, s.start, s.end)) {
      notes.push({ kind: "R3: acting or interim for less than a year, left out", record: label, detail: `${s.via}; ${s.start.exact ?? s.start.year}–${s.end?.exact ?? s.end?.year}; ${s.nature}` });
      continue;
    }
    // A term that began before the lane's first year keeps its true start, back to the state's
    // own first year. Heads of government placed by date start with the lane, as they always have.
    const early = s.office === "head-of-state" || s.state !== null;
    const place = (id: string, from: number) => {
      const held = span(id);
      if (!held) return null;
      const own = curated.states.find((x) => x.id === id)!;
      const lane = held.start === first && early ? { ...held, start: Math.min(held.start, own.start) } : held;
      if (from < lane.start && (s.end?.year ?? Infinity) < lane.start) return null;
      if (lane.end !== null && from > lane.end) return null;
      return { state: id, start: Math.max(from, lane.start), end: s.end === null ? lane.end : lane.end === null ? s.end.year : Math.min(s.end.year, lane.end) };
    };
    const found: { state: string; start: number; end: number | null }[] = [];
    if (s.state) {
      const p = place(s.state, s.start.year);
      if (p) found.push(p);
    } else {
      let y = Math.max(s.start.year, first);
      for (;;) {
        const id = stateAt(y) ?? (s.end?.year === y ? stateAt(y - 1) : null);
        if (!id) break;
        const p = place(id, y === first ? s.start.year : y);
        if (!p) break;
        found.push(p);
        if (p.end === null || s.end === null || p.end >= s.end.year || p.end === y) break;
        y = p.end;
      }
    }
    if (found.length === 0) {
      notes.push({ kind: "statement outside the lane", record: label, detail: `${s.via}; ${s.start.year}–${s.end?.year ?? "…"}` });
      continue;
    }
    const person = personOf(s.person);
    if (curatedGroups.has(`${person.id}|${s.office}`)) continue;
    for (const p of found) {
      const piece: Term = {
        person: person.id, ...p, office: s.office, title: s.title ?? GENERIC[s.office],
        ...(s.start.exact && p.start === s.start.year ? { exactStart: s.start.exact } : {}),
        ...(s.end?.exact && p.end === s.end.year ? { exactEnd: s.end.exact } : {}),
        sources: s.sources ?? person.sources,
      };
      titleRank.set(piece, s.title ? 0 : 1);
      pieces.push(piece);
    }
  }

  const fromWikidata = joinTerms(pieces, (t) => titleRank.get(t) ?? 0);
  const titled = new Map(curated.titles.map((t) => [`${t.person}|${t.office}|${t.state}`, t.title]));
  for (const t of fromWikidata) {
    const own = titled.get(`${t.person}|${t.office}|${t.state}`);
    if (own) t.title = own;
    else if (t.title.en === GENERIC[t.office]?.en) notes.push({ kind: "term with no title: the office is not in the curated list", record: `${t.person} · ${t.state}`, detail: `${t.start}–${t.end ?? "…"}` });
  }
  // Curated terms name people by id; make sure each has a record.
  for (const t of curated.terms) {
    const known = curated.persons.find((p) => p.id === t.person);
    if (known) personOf(known.wikidata);
  }
  const terms = [...fromWikidata, ...curated.terms].sort(byStart);
  const used = new Set(terms.map((t) => t.person));

  // ------------------------------------------------------------ flags: licence and author from Commons
  const commons = new Map(raw.flags.map((r) => [r.file, r]));
  const flags = curated.flags.map((f) => {
    const c = commons.get(f.file);
    if (!c) {
      notes.push({ kind: "flag: file not found on Commons", record: `${f.state} · ${f.file}`, detail: "" });
      return f;
    }
    if (!LICENCES.test(c.license)) notes.push({ kind: "flag: licence not on the allowlist", record: `${f.state} · ${f.file}`, detail: c.license || "none stated" });
    const free = /^(public domain|pd\b|cc0)/i.test(c.license);
    if (!free && !c.licenseUrl) notes.push({ kind: "flag: no licence URL", record: `${f.state} · ${f.file}`, detail: c.license });
    const rest: Flag = { ...f };
    delete rest.licenseUrl;
    return { ...rest, license: c.license || f.license, ...(c.licenseUrl ? { licenseUrl: c.licenseUrl } : {}), attribution: f.attribution || c.attribution, sha1: c.sha1, retrieved: raw.flagsRetrieved };
  });

  return {
    file: {
      country: curated.country,
      states: curated.states,
      persons: [...persons.values()].filter((p) => used.has(p.id)).sort((a, b) => a.id.localeCompare(b.id)),
      lane: curated.lane,
      terms,
      flags,
      ...(curated.narratives ? { narratives: curated.narratives } : {}),
    },
    persian,
    origin: { wikidata: fromWikidata.length, curated: curated.terms.length },
    notes,
  };
}
