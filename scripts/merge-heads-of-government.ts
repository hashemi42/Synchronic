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

const T = {
  pm: { en: "Prime Minister", fa: "نخست‌وزیر" },
  vizier: { en: "Grand Vizier", fa: "صدراعظم" },
  president: { en: "President", fa: "رئیس‌جمهور" },
  councilChair: { en: "Chairman of the Council of Ministers", fa: "رئیس شورای وزیران" },
  sovnarkom: { en: "Chairman of the Council of People's Commissars", fa: "رئیس شورای کمیسرهای خلق" },
  presidentCouncil: { en: "President of the Council of Ministers", fa: "رئیس شورای وزیران" },
  provisional: { en: "Chairman of the Provisional Government", fa: "رئیس دولت موقت" },
  chancellor: { en: "Chancellor", fa: "صدراعظم" },
  premier: { en: "Premier", fa: "نخست‌وزیر" },
};

/**
 * For each office: which state a term belongs to (by its start year), its
 * title, and the years in which the office was the head of government.
 * Returning null drops the term.
 */
type Rule = (start: number) => { state: string | null; title: Localized } | null;
const byDate = (title: Localized | ((y: number) => Localized)): Rule => (y) => ({
  state: null,
  title: typeof title === "function" ? title(y) : title,
});
const only = (state: string, title: Localized, from = -Infinity, to = Infinity): Rule => (y) =>
  y >= from && y < to ? { state, title } : null;

const RULES: Record<string, Rule> = {
  // Iran: grand viziers until the constitution of 1906, then prime ministers; the
  // office was abolished in 1989 and the president became head of government.
  Q13561063: (y) => (y < 1989 ? { state: null, title: y < 1906 ? T.vizier : T.pm } : null),
  Q838380: only("islamic-republic-of-iran", T.president, 1989),
  Q14211: byDate(T.pm),
  // Russia
  // The Council of Ministers of the Russian Empire was created in 1905.
  Q842386: (y) =>
    y < 1905 ? null : y <= 1917 ? { state: "russian-empire", title: T.councilChair } : y >= 1991 ? { state: "russian-federation", title: T.pm } : null,
  Q56919889: only("russian-sfsr", T.sovnarkom, 1917, 1923),
  Q4376682: only("soviet-union", T.sovnarkom, 1922),
  Q4376674: only("soviet-union", T.councilChair, 1946),
  // From January 1991 the office was "Prime Minister of the Soviet Union" (Valentin Pavlov).
  Q462189: (y) => (y >= 1991 ? { state: "soviet-union", title: T.pm } : y >= 1946 ? { state: "soviet-union", title: T.councilChair } : null),
  // Turkey: the president is head of government since 2018.
  Q15063567: only("ottoman-empire", T.vizier, 1700),
  Q2430415: (y) => (y < 1923 ? { state: "ankara-government", title: T.pm } : y < 2018 ? { state: "republic-of-turkey", title: T.pm } : null),
  Q1922067: only("republic-of-turkey", T.president, 2018),
  // France
  Q3409212: byDate(T.presidentCouncil),
  Q100711731: only("provisional-government-of-the-french-republic", T.provisional),
  Q1587677: (y) => (y >= 1959 ? { state: "french-fifth-republic", title: T.pm } : null),
  // Germany
  Q7050658: (y) => (y < 1949 ? { state: null, title: T.chancellor } : null),
  Q29034484: (y) => (y < 1949 ? { state: null, title: T.chancellor } : null),
  Q56022: (y) => (y < 1949 ? { state: null, title: T.chancellor } : null),
  Q4970706: only("federal-republic-of-germany", T.chancellor, 1949),
  Q2335229: only("east-germany", T.councilChair, 1949),
  // China: the Republic's premiers until 1949; later ones served on Taiwan.
  Q5369523: only("qing-dynasty", { en: "Prime Minister of the Imperial Cabinet", fa: "نخست‌وزیر کابینهٔ امپراتوری" }, 1911, 1912),
  Q30060907: only("republic-of-china", T.premier, 1912, 1949),
  Q702650: only("republic-of-china", T.premier, 1912, 1949),
  Q4122271: only("peoples-republic-of-china", T.premier, 1949),
  Q192711: byDate(T.pm),
  Q274948: byDate(T.pm),
};

/** Statements on Wikidata that are wrong for this purpose, with the reason. */
const EXCLUDE: Record<string, string> = {
  Q131426522: "A person named only “David”, prime minister of the UK from 2003: vandalism on Wikidata",
  Q2512945: "Iosif Adamovich headed the government of the Byelorussian SSR, not of the USSR",
  Q4328135: "Nygmet Nurmakov headed the government of the Kazakh ASSR, not of the USSR",
  Q941748: "Panteleimon Ponomarenko headed the government of the Byelorussian SSR, not of the USSR",
  Q3893833:
    "Ata'ollah Mohajerani was never Prime Minister of Iran (Mir-Hossein Mousavi held the office 1981–1989); a wrong P39 statement on Wikidata",
};

/** Single statements to leave out, as "person:start-end", with the reason (docs/data-rules.md). */
const EXCLUDE_TERMS: Record<string, string> = {
  "Q23530:2020-2020": "Dmitry Medvedev resigned on 15 January 2020; this is only his caretaker day, already inside his 2012–2020 term",
  "Q4082839:2020-2020": "R3: Andrey Belousov was acting prime minister for a few weeks in 2020, less than a year",
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
