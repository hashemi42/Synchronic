/**
 * Compares the hand-entered country file with the pipeline's output, record by record.
 * Pure. Every difference is one row; records that agree are only counted.
 */
import { fold } from "../../src/lib/search";
import type { Candidate, CountryFile, Note, Term } from "./normalize";

export type DiffRow = {
  country: string;
  entity: "state" | "person" | "term" | "flag";
  record: string;
  field: string;
  status: "differs" | "only in hand data" | "only in pipeline";
  ours: string;
  pipeline: string;
  note: string;
  link: string;
};
export type Counts = Record<string, { same: number; differs: number; onlyOurs: number; onlyPipeline: number }>;

type Span = { start: number; end: number | null; states: string[]; titles: string[] };
const years = (s: { start: number; end: number | null }) => `${s.start}–${s.end ?? "…"}`;
const endOf = (e: number | null) => e ?? Infinity;

/** A person's unbroken time in one office: pieces that touch or overlap, across states, as one span. */
export function spans(terms: Term[]): Span[] {
  const out: Span[] = [];
  for (const t of [...terms].sort((a, b) => a.start - b.start)) {
    const last = out.at(-1);
    if (last && t.start <= endOf(last.end)) {
      if (last.end !== null && (t.end === null || t.end > last.end)) last.end = t.end;
      last.states.push(t.state);
      last.titles.push(t.title.en);
    } else out.push({ start: t.start, end: t.end, states: [t.state], titles: [t.title.en] });
  }
  return out;
}

export function diffCountry(
  hand: CountryFile,
  made: CountryFile,
  extra: { notes: Note[]; flagCandidates: Candidate[]; verified: Record<string, string>; first: number },
): { rows: DiffRow[]; counts: Counts; titles: Map<string, number> } {
  const country = hand.country.id;
  const rows: DiffRow[] = [];
  const counts: Counts = {};
  const tally = (k: string, f: keyof Counts[string]) => {
    counts[k] ??= { same: 0, differs: 0, onlyOurs: 0, onlyPipeline: 0 };
    counts[k][f]++;
  };
  const wd = (q?: string) => (q ? `https://www.wikidata.org/wiki/${q}` : "");
  const field = (entity: DiffRow["entity"], group: string, record: string, name: string, a: unknown, b: unknown, link: string, note = "") => {
    const [x, y] = [a ?? "", b ?? ""].map(String);
    if (x === y) return tally(group, "same");
    if (!x) return; // the pipeline adds a value the hand data never had: not a difference to settle
    tally(group, y ? "differs" : "onlyOurs");
    rows.push({ country, entity, record, field: name, status: y ? "differs" : "only in hand data", ours: x, pipeline: y, note, link });
  };

  // ---------------------------------------------------------------- states
  const madeStates = new Map(made.states.map((s) => [s.id, s]));
  for (const s of hand.states) {
    const m = madeStates.get(s.id)!;
    if (!s.wikidata) continue;
    const link = wd(s.wikidata);
    field("state", "state: name (en)", s.id, "name.en", s.name.en, m.name.en, link);
    field("state", "state: name (fa)", s.id, "name.fa", s.name.fa, m.name.fa, link, fold(s.name.fa) === fold(m.name.fa) ? "spelling only" : "");
    field("state", "state: years", s.id, "start", s.start, m.start, link);
    field("state", "state: years", s.id, "end", s.end ?? "current", m.end ?? "current", link);
    field("state", "state: capital", s.id, "capital.en", s.capital?.en, m.capital?.en, link);
    field("state", "state: system", s.id, "system.en", s.system?.en, m.system?.en, link);
    field("state", "state: official name", s.id, "officialName.en", s.officialName?.en, m.officialName?.en, link);
    field("state", "state: official name", s.id, "officialName.fa", s.officialName?.fa, m.officialName?.fa, link, s.officialName && m.officialName && fold(s.officialName.fa) === fold(m.officialName.fa) ? "spelling only" : "");
  }

  // ---------------------------------------------------------------- people (those both sides have)
  const madeByQ = new Map(made.persons.map((p) => [p.wikidata!, p]));
  const handById = new Map(hand.persons.map((p) => [p.id, p]));
  const madeById = new Map(made.persons.map((p) => [p.id, p]));
  for (const p of hand.persons) {
    const m = p.wikidata ? madeByQ.get(p.wikidata) : undefined;
    if (!m) continue;
    const link = wd(p.wikidata);
    field("person", "person: name (en)", p.id, "name.en", p.name.en, m.name.en, link);
    field("person", "person: name (fa)", p.id, "name.fa", p.name.fa, m.name.fa, link, fold(p.name.fa) === fold(m.name.fa) ? "spelling only" : "");
    field("person", "person: born, died", p.id, "born", p.born, m.born, link);
    field("person", "person: born, died", p.id, "died", p.died, m.died, link);
  }

  // ---------------------------------------------------------------- terms, by person and office
  const group = (file: CountryFile, byId: Map<string, { wikidata?: string }>) =>
    Map.groupBy(file.terms, (t) => `${byId.get(t.person)?.wikidata ?? t.person}|${t.office}`);
  const ours = group(hand, handById);
  const theirs = group(made, madeById);
  const titles = new Map<string, number>();
  const undated = new Map<string, string>();
  for (const n of extra.notes) if (n.kind.startsWith("statement without")) undated.set(n.record, `${n.kind}: ${n.detail}`);

  for (const key of new Set([...ours.keys(), ...theirs.keys()])) {
    const [q, office] = key.split("|");
    const a = spans(ours.get(key) ?? []);
    const b = spans(theirs.get(key) ?? []);
    const person = hand.persons.find((p) => p.wikidata === q) ?? made.persons.find((p) => p.wikidata === q);
    const name = person?.name.en ?? q;
    const g = `term: ${office}`;
    const curatedOnly = office === "leader" || office === "other";
    const taken = new Set<Span>();
    for (const s of a) {
      const record = `${name} · ${office} · ${[...new Set(s.states)].join(", ")}`;
      const match = b.filter((t) => !taken.has(t) && Math.min(endOf(s.end), endOf(t.end)) - Math.max(s.start, t.start) >= 0)
        .sort((x, y) => Math.abs(x.start - s.start) - Math.abs(y.start - s.start))[0];
      const checked = extra.verified[`${q}:${office}:${s.start}-${s.end}`];
      if (!match) {
        tally(g, "onlyOurs");
        const note = curatedOnly
          ? `curated by rule (${office === "leader" ? "R4" : "R8"}): Wikidata has no such office; needs an override`
          : (undated.get(`${name} · ${office}`) ?? (checked ? `checked by hand: ${checked}` : "no statement on Wikidata"));
        rows.push({ country, entity: "term", record, field: "years", status: "only in hand data", ours: years(s), pipeline: "", note, link: wd(q) });
        continue;
      }
      taken.add(match);
      const startOk = match.start === s.start || (s.start <= extra.first && match.start <= extra.first);
      if (startOk && match.end === s.end) {
        tally(g, "same");
        const [x, y] = [s.titles[0], match.titles[0]];
        if (x !== y) titles.set(`${office} | ${x} | ${y}`, (titles.get(`${office} | ${x} | ${y}`) ?? 0) + 1);
        continue;
      }
      tally(g, "differs");
      const off = Math.max(Math.abs(match.start - s.start), s.end !== null && match.end !== null ? Math.abs(match.end - s.end) : s.end === match.end ? 0 : 99);
      rows.push({
        country, entity: "term", record, field: "years", status: "differs", ours: years(s), pipeline: years(match),
        note: [off <= 1 ? "one year apart" : "more than one year apart", checked ? `checked by hand: ${checked}` : ""].filter(Boolean).join("; "),
        link: wd(q),
      });
    }
    for (const t of b.filter((x) => !taken.has(x))) {
      tally(g, "onlyPipeline");
      rows.push({ country, entity: "term", record: `${name} · ${office} · ${[...new Set(t.states)].join(", ")}`, field: "years", status: "only in pipeline", ours: "", pipeline: years(t), note: a.length ? "the hand data has this person in other years" : "the hand data does not have this person in this office", link: wd(q) });
    }
  }

  // ---------------------------------------------------------------- flags against P41
  for (const f of hand.flags as { state: string; file: string; start: number; end: number | null }[]) {
    const c = extra.flagCandidates.filter((x) => x.state === f.state && x.file === f.file);
    const stateQ = hand.states.find((s) => s.id === f.state)?.wikidata;
    if (c.length === 0) {
      tally("flag", "onlyOurs");
      rows.push({ country, entity: "flag", record: `${f.state} · ${f.file}`, field: "file", status: "only in hand data", ours: years(f), pipeline: "", note: "not a flag image (P41) of the state's item", link: wd(stateQ) });
    } else if (c.some((x) => (x.start === null || x.start === f.start) && (x.end === null || x.end === f.end))) tally("flag", "same");
    else {
      tally("flag", "differs");
      rows.push({ country, entity: "flag", record: `${f.state} · ${f.file}`, field: "years", status: "differs", ours: years(f), pipeline: c.map((x) => `${x.start ?? "?"}–${x.end ?? "…"}`).join(" | "), note: "", link: wd(stateQ) });
    }
  }
  return { rows, counts, titles };
}
