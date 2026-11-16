/**
 * Merges data/raw/heads-of-government.json into each country file
 * (PRD §6.3, steps 2–3). Re-running replaces every head-of-government term,
 * so curated fixes belong in the tables below, never in the country files.
 *
 * Rules
 * - Undated terms are dropped (Wikidata lists fictional prime ministers without dates).
 * - Each office maps to the state it served; a term that spans a change of
 *   state is split at the boundary.
 * - Overlapping terms of one person in one state are joined.
 * - Names: the English Wikipedia title, else the Wikidata label. Persian: the
 *   Wikidata label, else the Persian Wikipedia title, else
 *   data/overrides/persian-names.json. A missing Persian name fails the run.
 *
 * Terms Wikidata lacks or leaves undated are added from
 * data/overrides/heads-of-government.json.
 *
 * Run: pnpm merge:hog
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { HEAD_OF_GOVERNMENT_FROM } from "./offices";
import { EXCLUDE, EXCLUDE_TERMS, RULES } from "./pipeline/rules";

type Localized = { en: string; fa: string };
type Row = {
  country: string;
  office: string;
  person: string;
  name: { en: string; enWiki: string | null; fa: string | null; faWiki: string | null };
  start: number | null;
  end: number | null;
  sources?: { title: string; url: string }[];
};
type Term = { person: string; state: string; office: string; title: Localized; start: number; end: number | null; sources: { title: string; url: string }[] };
type CountryFile = {
  country: { id: string };
  states: { id: string; start: number; end: number | null }[];
  persons: { id: string; name: Localized; wikidata?: string; sources: { title: string; url: string }[] }[];
  lane: { state: string | null; start: number; end: number | null; kind: string }[];
  terms: Term[];
};

const LANE_START = 1789;
const root = process.cwd();
const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const clean = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, "").trim();

async function main() {
  const raw = JSON.parse(await readFile(path.join(root, "data/raw/heads-of-government.json"), "utf8")) as { rows: Row[] };
  const manualFa = JSON.parse(await readFile(path.join(root, "data/overrides/persian-names.json"), "utf8")) as {
    names: Record<string, string>;
  };
  const added = JSON.parse(await readFile(path.join(root, "data/overrides/heads-of-government.json"), "utf8")) as {
    terms: { country: string; office: string; person: string; name: Localized; start: number; end: number | null; sources: Row["sources"] }[];
  };
  raw.rows.push(
    ...added.terms.map((t) => ({ ...t, name: { en: t.name.en, enWiki: t.name.en, fa: t.name.fa, faWiki: null } })),
  );
  const missing = new Map<string, string>();

  for (const country of Object.keys(Object.groupBy(raw.rows, (r) => r.country))) {
    const file = path.join(root, `data/overrides/countries/${country}.json`);
    const doc = JSON.parse(await readFile(file, "utf8")) as CountryFile;
    const states = new Map(doc.states.map((s) => [s.id, s]));
    const mainline = doc.lane.filter((p) => p.kind !== "rival" && p.state).sort((a, b) => a.start - b.start);
    const stateAt = (y: number) =>
      mainline.find((p) => p.start <= y && (p.end === null || y < p.end))?.state ?? null;

    const terms: Term[] = [];
    for (const row of raw.rows.filter((r) => r.country === country && r.start !== null)) {
      const from = HEAD_OF_GOVERNMENT_FROM[row.office];
      if (from !== undefined && row.end !== null && row.end <= from) continue;
      const start = from !== undefined ? Math.max(row.start!, from) : row.start!;
      if (EXCLUDE[row.person]) continue;
      if (EXCLUDE_TERMS[`${row.person}:${row.start}-${row.end}`]) continue;
      if ((row.end ?? Infinity) < LANE_START) continue;
      const rule = RULES[row.office]?.(start);
      if (!rule) continue;

      // Split the term over the states it spans: a fixed state, or the lane by date.
      const pieces: { state: string; start: number; end: number | null }[] = [];
      if (rule.state) {
        const s = states.get(rule.state)!;
        const end = row.end === null ? s.end : s.end === null ? row.end : Math.min(row.end, s.end);
        if (start >= s.start && (s.end === null || start <= s.end)) pieces.push({ state: s.id, start, end });
      } else {
        let y = Math.max(start, LANE_START);
        while (true) {
          const id = stateAt(y) ?? (row.end === y ? stateAt(y - 1) : null);
          if (!id) break;
          const s = states.get(id)!;
          const end = row.end === null ? s.end : s.end === null ? row.end : Math.min(row.end, s.end);
          pieces.push({ state: id, start: Math.max(y, s.start), end });
          if (end === null || row.end === null || end >= row.end || end === y) break;
          y = end;
        }
      }
      if (pieces.length === 0) continue;

      const qid = row.person;
      const en = clean(row.name.enWiki ?? row.name.en);
      const fa = (row.sources ? row.name.fa : null) ?? manualFa.names[qid] ?? row.name.fa ?? (row.name.faWiki ? clean(row.name.faWiki) : null) ?? null;
      if (!fa) {
        missing.set(qid, en);
        continue;
      }
      let person = doc.persons.find((p) => p.wikidata === qid);
      if (!person) {
        let id = slug(en);
        if (doc.persons.some((p) => p.id === id)) id = `${id}-${qid.toLowerCase()}`;
        person = { id, name: { en, fa }, wikidata: qid, sources: [{ title: `${en} — Wikidata`, url: `https://www.wikidata.org/wiki/${qid}` }] };
        doc.persons.push(person);
      }
      for (const piece of pieces) {
        terms.push({
          person: person.id,
          ...piece,
          office: "head-of-government",
          title: rule.title,
          sources: row.sources ?? [{ title: `${en} — Wikidata`, url: `https://www.wikidata.org/wiki/${qid}` }],
        } as Term);
      }
    }

    // Join overlapping terms of one person in one state (one statement per Wikidata item).
    terms.sort((a, b) => a.state.localeCompare(b.state) || a.person.localeCompare(b.person) || a.start - b.start);
    const joined: Term[] = [];
    for (const term of terms) {
      const prev = joined.at(-1);
      const overlaps = prev && prev.person === term.person && prev.state === term.state && term.start < (prev.end ?? Infinity) + (prev.end === prev.start ? 1 : 0);
      if (overlaps && prev) {
        prev.end = prev.end === null || term.end === null ? null : Math.max(prev.end, term.end);
      } else joined.push({ ...term, office: "head-of-government" });
    }
    joined.sort((a, b) => a.start - b.start || (a.end ?? Infinity) - (b.end ?? Infinity));

    doc.terms = [...doc.terms.filter((t) => t.office !== "head-of-government"), ...joined.map(({ person, state, office, title, start, end, sources }) => ({ person, state, office, title, start, end, sources }))];
    // Drop people no term refers to any more (from an earlier run).
    const used = new Set(doc.terms.map((t) => t.person));
    doc.persons = doc.persons.filter((p) => used.has(p.id));
    await writeFile(file, JSON.stringify(doc, null, 2) + "\n");

    const years = joined.map((t) => t.start);
    console.log(`${country.padEnd(8)} ${String(joined.length).padStart(3)} head-of-government terms, ${Math.min(...years)}–`);
  }

  if (missing.size > 0) {
    console.error(`\n${missing.size} people have no Persian name. Add them to data/overrides/persian-names.json:`);
    console.error(JSON.stringify(Object.fromEntries(missing), null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
