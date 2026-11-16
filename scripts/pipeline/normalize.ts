/**
 * Pipeline, stages 2 and 3 (PRD §6.3): raw Wikidata rows → records in the schema, then the curated
 * layer on top. Pure: no network and no file access, so the same raw files always give the same
 * output.
 *
 * Curated input, never taken from Wikidata: the country record, which states make up the lane and
 * when, record ids (they are in shared URLs), flags, narratives, the office rules and the
 * exclusions. Everything else is read from statements.
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
export type Person = { id: string; name: Localized; born?: number; died?: number; wikidata?: string; sources: Source[] };
export type State = {
  id: string; name: Localized; officialName?: Localized; localName?: string; start: number; end: number | null;
  circa?: boolean; capital?: Localized; system?: Localized; wikidata?: string; sources: Source[];
};
export type LanePeriod = { country: string; state: string | null; start: number; end: number | null; kind: string; [k: string]: unknown };
export type CountryFile = {
  country: { id: string; name: Localized; wikidata: string; [k: string]: unknown };
  states: State[]; persons: Person[]; lane: LanePeriod[]; terms: Term[]; flags: Record<string, unknown>[]; narratives?: unknown[];
};

/** A head-of-state office found on Wikidata; `state` is set when its holders belong to one state only. */
export type HeadOffice = { office: string; state: string | null };
/** A head-of-government term Wikidata lacks (data/overrides/heads-of-government.json). */
export type AddedTerm = { country: string; office: string; person: string; name: Localized; start: number; end: number | null; sources?: Source[] };

export type Config = {
  /** The country file as curated today: the source of the lane, the state list and the ids. */
  curated: CountryFile;
  hogOffices: string[];
  /** Offices that became the head of government in a given year (Turkey's presidency, 2018). */
  hogFrom: Record<string, number>;
  hosOffices: HeadOffice[];
  /** "Q…:office" → the rule that leaves this holder out (docs/data-rules.md). */
  excluded: Map<string, string>;
  /** Persian names for people with no Persian Wikipedia article or label, by Wikidata id. */
  manualFa: Record<string, string>;
  addedTerms: AddedTerm[];
};

export type NameSource = "fa.wikipedia" | "Wikidata label" | "persian-names.json" | "override" | "none";
export type Note = { kind: string; record: string; detail: string };
export type Candidate = { state: string; file: string; start: number | null; end: number | null; rank: string };
export type Result = {
  file: CountryFile;
  /** Where each Persian name came from, by Wikidata id, and the fa.wikipedia title when it was trimmed. */
  persian: Map<string, { from: NameSource; title?: string }>;
  notes: Note[];
  flagCandidates: Candidate[];
};

const GENERIC: Record<string, Localized> = {
  "head-of-state": { en: "Head of state", fa: "رئیس کشور" },
  "head-of-government": { en: "Head of government", fa: "رئیس دولت" },
};

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
 * Joins terms of one person in one state and office that overlap (successive cabinets on one
 * statement each). `rank` says how good each term's title is (lower wins): a curated rule, the
 * office's name on Wikidata, or the generic fallback.
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
  return out.sort((a, b) => a.start - b.start || (a.end ?? Infinity) - (b.end ?? Infinity) || a.person.localeCompare(b.person));
}

export function normalize(raw: Raw, cfg: Config): Result {
  const { curated } = cfg;
  const country = curated.country.id;
  const notes: Note[] = [];
  const names = indexNames(raw.names);
  const persian = new Map<string, { from: NameSource; title?: string }>();

  const en = (q: string) => {
    const n = names.get(q);
    return n?.wikiEn ? clean(n.wikiEn) : (n?.labelEn ?? n?.labelMul ?? null);
  };
  const fa = (q: string): string | null => {
    const n = names.get(q);
    if (n?.wikiFa) {
      const trimmed = clean(n.wikiFa);
      persian.set(q, { from: "fa.wikipedia", title: trimmed === n.wikiFa ? undefined : n.wikiFa });
      return trimmed;
    }
    const value = n?.labelFa ?? cfg.manualFa[q] ?? null;
    persian.set(q, { from: n?.labelFa ? "Wikidata label" : cfg.manualFa[q] ? "persian-names.json" : "none" });
    return value;
  };
  const sourcesOf = (q: string, name: string): Source[] => {
    const n = names.get(q);
    return [
      ...(n?.wikiEn ? [{ title: `${n.wikiEn} — Wikipedia`, url: wikiUrl("en", n.wikiEn) }] : []),
      { title: `${name} — Wikidata`, url: `https://www.wikidata.org/wiki/${q}` },
    ];
  };
  const time = (r: Row, k: "at" | "start" | "end") => when(r[k], r[`${k}Prec`], r[`${k}Cal`]);
  const preferred = (rows: Row[]) => {
    const best = rows.filter((r) => r.rank.endsWith("PreferredRank"));
    return best.length ? best : rows;
  };

  // ------------------------------------------------------------ the lane (curated)
  const mainline = curated.lane.filter((p) => p.kind !== "rival" && p.kind !== "parallel" && p.state).sort((a, b) => a.start - b.start);
  const first = Math.min(...curated.lane.map((p) => p.start));
  const stateAt = (y: number) => mainline.find((p) => p.start <= y && (p.end === null || y < p.end))?.state ?? null;
  /** The years a state holds a place in the lane. */
  const span = (id: string) => {
    const periods = curated.lane.filter((p) => p.state === id);
    if (periods.length === 0) return null;
    return { start: Math.min(...periods.map((p) => p.start)), end: periods.some((p) => p.end === null) ? null : Math.max(...periods.map((p) => p.end!)) };
  };

  // ------------------------------------------------------------ states
  const byState = Map.groupBy(raw.states, (r) => qid(r.item));
  const states: State[] = curated.states.map((hand) => {
    if (!hand.wikidata) {
      notes.push({ kind: "state without a Wikidata item", record: hand.id, detail: "Kept as curated; the pipeline cannot fetch it." });
      return hand;
    }
    const q = hand.wikidata;
    const rows = byState.get(q) ?? [];
    const prop = (p: string) => rows.filter((r) => r.prop === p);
    const lane = span(hand.id);
    // An item such as Q794 (Iran) lists several inceptions; the one meant is the nearest to the lane.
    const nearest = (p: string, target: number | null | undefined) => {
      const years = prop(p).map((r) => time(r, "at")?.year).filter((y): y is number => y != null);
      if (years.length === 0) return null;
      return target == null ? Math.max(...years) : years.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
    };
    const start = nearest("P571", lane?.start ?? hand.start);
    const end = lane?.end === null && !curated.states.some((s) => s.wikidata === q && s.id !== hand.id) ? null : nearest("P576", lane?.end ?? hand.end);
    if (start === null) notes.push({ kind: "state: no inception on Wikidata", record: hand.id, detail: q });

    const pick = (p: string): string | null => {
      const all = prop(p).filter((r) => r.value.startsWith("http://www.wikidata.org/entity/Q"));
      const best = preferred(all);
      const current = best.filter((r) => !r.end);
      const chosen = best.length === 1 ? best : current.length === 1 ? current : [];
      if (chosen.length === 0 && all.length > 1)
        notes.push({ kind: `state: ${p === "P36" ? "capital" : "system"} is ambiguous on Wikidata`, record: hand.id, detail: `${new Set(all.map((r) => qid(r.value))).size} values, none preferred` });
      return chosen[0] ? qid(chosen[0].value) : null;
    };
    const localized = (item: string | null): Localized | undefined => {
      if (!item) return undefined;
      const [e, f] = [en(item), fa(item)];
      return e && f ? { en: e, fa: f } : undefined;
    };
    const official = (lang: string) => {
      const list = preferred(prop("P1448").filter((r) => r.valueLang === lang));
      return (list.find((r) => !r.end) ?? list.at(-1))?.value;
    };
    const nameEn = en(q) ?? hand.name.en;
    const state: State = {
      id: hand.id,
      name: { en: nameEn, fa: fa(q) ?? "" },
      ...(official("en") && official("fa") ? { officialName: { en: official("en")!, fa: official("fa")! } } : {}),
      start: start ?? hand.start,
      end,
      ...(localized(pick("P36")) ? { capital: localized(pick("P36")) } : {}),
      ...(localized(pick("P122")) ? { system: localized(pick("P122")) } : {}),
      wikidata: q,
      sources: sourcesOf(q, nameEn),
    };
    return state;
  });
  const stateById = new Map(states.map((s) => [s.id, s]));
  const stateIdsOf = (q: string) => curated.states.filter((s) => s.wikidata === q).map((s) => s.id);

  // ------------------------------------------------------------ statements → pieces of terms
  type Statement = { person: string; office: "head-of-state" | "head-of-government"; start: When | null; end: When | null; state: string | null; title: Localized | null; via: string; sources?: Source[] };
  const statements: Statement[] = [];
  // An office's name without the country: "President of France" → "President", «رئیس‌جمهور فرانسه» → «رئیس‌جمهور».
  const places = [curated.country.name, ...curated.states.map((s) => s.name)];
  const title = (item: string | undefined): Localized | null => {
    if (!item) return null;
    let [e, f] = [en(item), fa(item)];
    if (!e || !f) return null;
    for (const p of places) {
      for (const tail of [` of the ${p.en}`, ` of ${p.en}`]) if (e.toLowerCase().endsWith(tail.toLowerCase())) e = e.slice(0, -tail.length);
      if (f.endsWith(` ${p.fa}`)) f = f.slice(0, -p.fa.length - 1);
    }
    return { en: e[0].toUpperCase() + e.slice(1), fa: f };
  };

  // P35 and P6 on the state items. An item shared by several states of the lane (Q142 for every
  // French republic) is placed by date.
  for (const r of raw.states.filter((x) => x.prop === "P35" || x.prop === "P6")) {
    if (!r.value.startsWith("http://www.wikidata.org/entity/Q")) continue;
    const item = qid(r.item);
    const ids = stateIdsOf(item);
    const officeProp = r.prop === "P35" ? "P1906" : "P1313";
    const offices = [...new Set((byState.get(item) ?? []).filter((x) => x.prop === officeProp).map((x) => qid(x.value)))];
    statements.push({
      person: qid(r.value),
      office: r.prop === "P35" ? "head-of-state" : "head-of-government",
      start: time(r, "start"), end: time(r, "end"),
      state: ids.length === 1 ? ids[0] : null,
      title: offices.length === 1 ? title(offices[0]) : null,
      via: `${r.prop} on ${item}`,
    });
  }
  // P39: holders of the head-of-state offices …
  const hos = new Map(cfg.hosOffices.map((o) => [o.office, o]));
  for (const r of raw.holders) {
    const office = qid(r.office);
    const head = hos.get(office);
    if (head) {
      statements.push({ person: qid(r.person), office: "head-of-state", start: time(r, "start"), end: time(r, "end"), state: head.state, title: title(office), via: `P39 ${office}` });
    }
    // … and of the head-of-government offices, each placed and titled by its rule.
    if (cfg.hogOffices.includes(office)) {
      let start = time(r, "start");
      const end = time(r, "end");
      const from = cfg.hogFrom[office];
      if (from !== undefined && end && end.year <= from) continue;
      if (from !== undefined && start && start.year < from) start = { year: from };
      const rule = start ? RULES[office]?.(start.year) : null;
      if (start && !rule) continue;
      statements.push({ person: qid(r.person), office: "head-of-government", start, end, state: rule?.state ?? null, title: rule?.title ?? null, via: `P39 ${office}` });
    }
  }
  for (const t of cfg.addedTerms.filter((x) => x.country === country)) {
    const rule = RULES[t.office]?.(t.start);
    if (!rule) continue;
    statements.push({ person: t.person, office: "head-of-government", start: { year: t.start }, end: t.end === null ? null : { year: t.end }, state: rule.state, title: rule.title, via: "data/overrides/heads-of-government.json", sources: t.sources });
  }

  const born = new Map<string, { born?: number; died?: number }>();
  for (const r of raw.people) {
    const e = born.get(qid(r.item)) ?? {};
    const y = time(r, "at")?.year;
    if (y != null) e[r.prop === "P569" ? "born" : "died"] ??= y;
    born.set(qid(r.item), e);
  }

  const ids = new Map(curated.persons.filter((p) => p.wikidata).map((p) => [p.wikidata!, p.id]));
  const added = new Map(cfg.addedTerms.map((t) => [t.person, t.name]));
  const persons = new Map<string, Person>();
  const personOf = (q: string): Person => {
    let p = persons.get(q);
    if (p) return p;
    const nameEn = en(q) ?? added.get(q)?.en ?? q;
    let nameFa = fa(q);
    if (!nameFa && added.get(q)) {
      nameFa = added.get(q)!.fa;
      persian.set(q, { from: "override" });
    }
    let id = ids.get(q) ?? slug(nameEn);
    if (!ids.has(q) && ([...persons.values()].some((x) => x.id === id) || curated.persons.some((x) => x.id === id))) id = `${id}-${q.toLowerCase()}`;
    p = { id, name: { en: nameEn, fa: nameFa ?? "" }, ...born.get(q), wikidata: q, sources: sourcesOf(q, nameEn) };
    persons.set(q, p);
    return p;
  };

  const pieces: Term[] = [];
  const titleRank = new Map<Term, number>();
  for (const s of statements) {
    const label = `${en(s.person) ?? s.person} · ${s.office}`;
    const why = cfg.excluded.get(`${s.person}:${s.office}`) ?? (s.office === "head-of-government" ? EXCLUDE[s.person] : undefined);
    if (why) continue;
    if (s.office === "head-of-government" && EXCLUDE_TERMS[`${s.person}:${s.start?.year ?? null}-${s.end?.year ?? null}`]) continue;
    if (!s.start) {
      notes.push({ kind: "statement without a start date", record: label, detail: `${s.via}; end ${s.end?.year ?? "none"}` });
      continue;
    }
    if (s.end && s.end.year < first) continue;
    // No end date means "still in office" only for the living; for the dead it is a missing date.
    if (!s.end && born.get(s.person)?.died != null) {
      notes.push({ kind: "statement without an end date", record: label, detail: `${s.via}; start ${s.start.year}` });
      continue;
    }
    const place = (id: string, from: number) => {
      const lane = span(id);
      if (!lane) return null;
      if (from < lane.start && (s.end?.year ?? Infinity) < lane.start) return null;
      if (lane.end !== null && from > lane.end) return null;
      const start = Math.max(from, lane.start);
      const end = s.end === null ? lane.end : lane.end === null ? s.end.year : Math.min(s.end.year, lane.end);
      return { state: id, start, end };
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
        const p = place(id, y);
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
    for (const p of found) {
      const piece: Term = {
        person: person.id, ...p, office: s.office, title: s.title ?? GENERIC[s.office],
        ...(s.start.exact && p.start === s.start.year ? { exactStart: s.start.exact } : {}),
        ...(s.end?.exact && p.end === s.end.year ? { exactEnd: s.end.exact } : {}),
        sources: s.sources ?? person.sources,
      };
      titleRank.set(piece, !s.title ? 2 : s.via.startsWith("P39") && s.office === "head-of-government" ? 0 : s.via.startsWith("data/") ? 0 : 1);
      pieces.push(piece);
    }
  }

  const terms = joinTerms(pieces, (t) => titleRank.get(t) ?? 0);
  for (const t of terms) {
    const s = stateById.get(t.state)!;
    if (t.start < s.start || (t.end ?? Infinity) > (s.end ?? Infinity)) {
      notes.push({ kind: "term outside the state's years on Wikidata", record: `${t.person} · ${t.state}`, detail: `term ${t.start}–${t.end ?? "…"}, state ${s.start}–${s.end ?? "…"}` });
    }
  }
  const used = new Set(terms.map((t) => t.person));

  // ------------------------------------------------------------ flag candidates (P41)
  const flagCandidates: Candidate[] = raw.states
    .filter((r) => r.prop === "P41")
    .flatMap((r) =>
      stateIdsOf(qid(r.item)).map((state) => ({
        state,
        file: decodeURIComponent(r.value.split("/Special:FilePath/").pop()!).replaceAll("_", " "),
        start: time(r, "start")?.year ?? null,
        end: time(r, "end")?.year ?? null,
        rank: r.rank.split("#").pop()!.replace("Rank", "").toLowerCase(),
      })),
    );

  return {
    file: {
      country: curated.country,
      states,
      persons: [...persons.values()].filter((p) => used.has(p.id)).sort((a, b) => a.id.localeCompare(b.id)),
      lane: curated.lane,
      terms,
      flags: curated.flags,
      ...(curated.narratives ? { narratives: curated.narratives } : {}),
    },
    persian,
    notes,
    flagCandidates,
  };
}
