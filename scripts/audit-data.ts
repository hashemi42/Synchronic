/**
 * Data review, automated (PRD §11, "records with a cited source: 100%").
 *
 *   1. Every head-of-state and head-of-government term is compared with Wikidata: P35 (head of state)
 *      and P6 (head of government) statements, with their P580/P582 qualifiers, on the country's state
 *      items. Head-of-government terms missing there are also looked up in P39 (position held) for the
 *      country's prime-minister offices, which is where Wikidata usually keeps them.
 *   2. Every Persian name (people, states, countries) is compared with the item's Persian label,
 *      aliases and Persian Wikipedia title.
 *   3. Every source URL is fetched: it must resolve, and a source cited for a person must mention them.
 *
 * Writes only the problems to artifacts/data-review/audit.csv, worst first, plus a summary in
 * artifacts/data-review/README.md. Fetched pages are cached in .cache/audit/ (delete it to refetch).
 *
 * Run: pnpm data:audit            (add --no-sources to skip the URL check)
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fold } from "../src/lib/search";
import { OFFICES } from "./offices";

const UA = { "User-Agent": "SynchronicDataAudit/0.1 (open-source history timeline)" };
const root = process.cwd();
const cacheDir = path.join(root, ".cache/audit");
const outDir = path.join(root, "artifacts/data-review");
const checkSources = !process.argv.includes("--no-sources");
const NOW = new Date().getUTCFullYear();
const FIRST = 1789;

type Localized = { en: string; fa: string };
type Source = { title: string; url: string };
type Term = { person: string; state: string; office: string; start: number; end: number | null; sources: Source[] };
type Person = { id: string; name: Localized; wikidata?: string; sources: Source[] };
type State = { id: string; name: Localized; wikidata?: string; sources: Source[] };
type CountryFile = {
  country: { id: string; name: Localized; wikidata?: string };
  states: State[];
  persons: Person[];
  terms: Term[];
  lane: { sources: Source[] }[];
  flags: { sources: Source[] }[];
};

type Row = {
  severity: "high" | "medium" | "low";
  check: string;
  country: string;
  record: string;
  name: string;
  ours: string;
  wikidata: string;
  detail: string;
  link: string;
  verdict?: string;
  /** The Wikidata item a Persian-name row is about. */
  qid?: string;
  /** For a term Wikidata lacks: what the cited sources must show to confirm it. */
  evidence?: { urls: string[]; names: string[]; start: number | null; end: number | null };
};

const rows: Row[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const years = (s: number | null, e: number | null) => `${s ?? "?"}–${e ?? "…"}`;
const qid = (uri: string) => uri.split("/").pop()!;
const yearOf = (iso?: string) => {
  const m = iso ? /^(-?)(\d+)-/.exec(iso) : null;
  return m ? (m[1] ? -1 : 1) * Number(m[2]) : null;
};

// ---------------------------------------------------------------- fetching, with a cache

async function cached(key: string, load: () => Promise<string>): Promise<string> {
  const file = path.join(cacheDir, createHash("sha1").update(key).digest("hex"));
  try {
    return await readFile(file, "utf8");
  } catch {
    const text = await load();
    await writeFile(file, text);
    return text;
  }
}

async function sparql(query: string): Promise<Record<string, { value: string; "xml:lang"?: string } | undefined>[]> {
  const text = await cached(`sparql:${query}`, async () => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch("https://query.wikidata.org/sparql", {
        method: "POST",
        headers: { ...UA, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ query }),
      });
      if (res.ok) return res.text();
      if (attempt >= 4 || (res.status !== 429 && res.status < 500)) throw new Error(`Wikidata ${res.status}: ${await res.text()}`);
      await sleep(3000 * (attempt + 1));
    }
  });
  return JSON.parse(text).results.bindings;
}

const chunks = <T>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

// ---------------------------------------------------------------- 1. terms against P35 / P6 (and P39)

type Statement = { person: string; start: number | null; end: number | null; via: string };

async function termStatements(stateQids: string[]): Promise<Statement[]> {
  const values = stateQids.map((q) => `wd:${q}`).join(" ");
  const bindings = await sparql(`
SELECT ?state ?prop ?person ?start ?end WHERE {
  VALUES ?state { ${values} }
  VALUES (?prop ?p ?ps ) { ("P35" p:P35 ps:P35) ("P6" p:P6 ps:P6) }
  ?state ?p ?st . ?st ?ps ?person ; wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank)
  OPTIONAL { ?st pq:P580 ?start . }
  OPTIONAL { ?st pq:P582 ?end . }
}`);
  return bindings.map((b) => ({
    person: qid(b.person!.value),
    start: yearOf(b.start?.value),
    end: yearOf(b.end?.value),
    via: `${b.prop!.value} on ${qid(b.state!.value)}`,
  }));
}

async function positionStatements(offices: string[]): Promise<Statement[]> {
  const bindings = await sparql(`
SELECT ?office ?person ?start ?end WHERE {
  VALUES ?office { ${offices.map((q) => `wd:${q}`).join(" ")} }
  ?person p:P39 ?st . ?st ps:P39 ?office ; wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank)
  OPTIONAL { ?st pq:P580 ?start . }
  OPTIONAL { ?st pq:P582 ?end . }
}`);
  return bindings.map((b) => ({
    person: qid(b.person!.value),
    start: yearOf(b.start?.value),
    end: yearOf(b.end?.value),
    via: `P39 ${qid(b.office!.value)}`,
  }));
}

/** A person's unbroken time in an office, after joining back-to-back pieces (cabinets, changes of state). */
type Span = { start: number | null; end: number | null; parts: string[]; sources?: string[] };

const endOf = (v: number | null) => v ?? NOW;

/** Joins spans that touch or overlap, so "2012–2014, 2014–2017, 2017–2020" compares as 2012–2020. */
function join(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => (a.start ?? -Infinity) - (b.start ?? -Infinity));
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out.at(-1);
    if (last && last.start !== null && s.start !== null && s.start <= endOf(last.end)) {
      if (last.end !== null && (s.end === null || s.end > last.end)) last.end = s.end;
      last.parts.push(...s.parts);
      last.sources = [...(last.sources ?? []), ...(s.sources ?? [])];
    } else out.push({ ...s, parts: [...s.parts], sources: [...(s.sources ?? [])] });
  }
  return out;
}

const overlap = (a: Span, b: Span) =>
  Math.min(endOf(a.end), endOf(b.end)) - Math.max(a.start ?? -Infinity, b.start ?? -Infinity);

function compareTerms(file: CountryFile, statements: { P35: Statement[]; P6: Statement[]; P39: Statement[] }) {
  const persons = new Map(file.persons.map((p) => [p.id, p]));
  const country = file.country.id;
  const ours = new Set<string>();

  // Group our terms by person and office, across the country's states, and join them.
  const groups = new Map<string, { person: string; office: string; spans: Span[] }>();
  for (const t of file.terms) {
    const key = `${t.person}|${t.office}`;
    const g = groups.get(key) ?? { person: t.person, office: t.office, spans: [] };
    g.spans.push({ start: t.start, end: t.end, parts: [t.state], sources: t.sources.map((x) => x.url) });
    groups.set(key, g);
  }
  const wdSpans = (list: Statement[], q: string) =>
    join(list.filter((s) => s.person === q).map((s) => ({ start: s.start, end: s.end, parts: [s.via] })));

  for (const g of groups.values()) {
    const person = persons.get(g.person);
    const q = person?.wikidata;
    const name = person?.name.en ?? g.person;
    if (!q) {
      rows.push({ severity: "high", check: "term: person has no Wikidata id", country, record: g.office, name, ours: g.spans.map((s) => years(s.start, s.end)).join(", "), wikidata: "", detail: "", link: "" });
      continue;
    }
    const link = `https://www.wikidata.org/wiki/${q}`;
    const leader = g.office === "leader";
    const prop = g.office === "head-of-government" ? "P6" : "P35";
    // A leader (party chief, Supreme Leader) may also sit in Wikidata as head of state or government.
    if (leader) ours.add(`P35:${q}`).add(`P6:${q}`);
    else ours.add(`${prop}:${q}`);
    let theirs = leader ? wdSpans([...statements.P35, ...statements.P6], q) : wdSpans(statements[prop], q);
    let source = leader ? "P35/P6" : prop;
    if (theirs.length === 0 && g.office === "head-of-government") {
      theirs = wdSpans(statements.P39, q);
      source = "P6 or P39";
    }
    const listed = theirs.map((s) => years(s.start, s.end)).join(", ");

    for (const span of join(g.spans)) {
      const record = `${g.office} · ${[...new Set(span.parts)].join(", ")}`;
      const best = theirs.filter((t) => overlap(span, t) >= 0).sort((a, b) => overlap(span, b) - overlap(span, a))[0];
      if (!best) {
        rows.push({
          severity: leader ? "low" : "medium",
          check: leader ? "term: leader not modelled in Wikidata P35/P6" : `term: not in Wikidata ${source}`,
          country, record, name, ours: years(span.start, span.end), wikidata: listed,
          detail: listed ? "Wikidata has other terms for this person, not this one." : "Check the source; Wikidata may be incomplete.",
          link,
          evidence: leader ? undefined : { urls: [...new Set(span.sources)], names: [person?.name.en ?? name], start: span.start, end: span.end },
        });
        continue;
      }
      // Terms that began before the lane's first year may keep their true start.
      const startOk = best.start === null || best.start === span.start || (span.start! <= FIRST && best.start <= FIRST);
      const endOk = best.end === null ? true : span.end === null ? best.end >= NOW : best.end === span.end;
      if (!startOk || !endOk) {
        const off = Math.max(
          best.start === null ? 0 : Math.abs(best.start - span.start!),
          span.end !== null && best.end !== null ? Math.abs(best.end - span.end) : 0,
        );
        rows.push({
          severity: leader ? "low" : off > 1 || (span.end === null && best.end !== null) ? "high" : "medium",
          check: leader ? "term: leader's years differ from a P35/P6 office" : "term: years differ",
          country, record, name, ours: years(span.start, span.end), wikidata: years(best.start, best.end),
          detail: `via ${[...new Set(best.parts)].join(", ")}`, link,
        });
      } else if (best.start === null || (best.end === null && span.end !== null)) {
        rows.push({ severity: "low", check: "term: Wikidata lacks a date", country, record, name, ours: years(span.start, span.end), wikidata: years(best.start, best.end), detail: `via ${[...new Set(best.parts)].join(", ")}`, link });
      }
    }
  }

  // Statements in our years that the data does not have.
  for (const prop of ["P35", "P6"] as const) {
    const seen = new Set<string>();
    for (const s of statements[prop]) {
      if (ours.has(`${prop}:${s.person}`) || seen.has(s.person)) continue;
      if ((s.end ?? NOW) < FIRST || (s.start ?? FIRST) > NOW) continue;
      seen.add(s.person);
      missing.push({ country, prop, statement: s });
    }
  }
}

const missing: { country: string; prop: "P35" | "P6"; statement: Statement }[] = [];

// ---------------------------------------------------------------- 2. Persian names

type Labels = { en: string[]; fa: string[] };

async function labels(qids: string[]): Promise<Map<string, Labels>> {
  const out = new Map<string, Labels>();
  for (const batch of chunks(qids, 150)) {
    const bindings = await sparql(`
SELECT ?item ?name ?kind WHERE {
  VALUES ?item { ${batch.map((q) => `wd:${q}`).join(" ")} }
  { ?item rdfs:label ?name . FILTER(LANG(?name) IN ("fa", "en", "mul")) BIND("label" AS ?kind) }
  UNION
  { ?item skos:altLabel ?name . FILTER(LANG(?name) IN ("fa", "en", "mul")) BIND("alias" AS ?kind) }
  UNION
  { ?article schema:about ?item ; schema:isPartOf <https://fa.wikipedia.org/> ; schema:name ?name . BIND("label" AS ?kind) }
}`);
    // Labels before aliases, so the first English name is the one Wikidata shows.
    bindings.sort((a, b) => (a.kind!.value === b.kind!.value ? 0 : a.kind!.value === "label" ? -1 : 1));
    for (const b of bindings) {
      const entry = out.get(qid(b.item!.value)) ?? { en: [], fa: [] };
      const lang = b.name!["xml:lang"];
      // A Persian Wikipedia title such as "عباس میرزا (شاهزاده)" counts without its disambiguator.
      const value = b.name!.value.replace(/\s*\([^)]*\)\s*$/, "");
      if (lang === "fa") entry.fa.push(value);
      else if (lang === "en" || lang === "mul") entry.en.push(value);
      out.set(qid(b.item!.value), entry);
    }
    await sleep(500);
  }
  return out;
}

function comparePersian(country: string, record: string, ours: Localized, q: string | undefined, known: Map<string, Labels>) {
  if (!q) return;
  const fa = known.get(q)?.fa ?? [];
  const link = `https://www.wikidata.org/wiki/${q}`;
  if (fa.length === 0) {
    rows.push({ severity: "medium", check: "Persian name: no Persian label on Wikidata", country, record, name: ours.en, ours: ours.fa, wikidata: "", detail: "Transliterated by hand; needs a Persian reader.", link, qid: q });
    return;
  }
  const mine = fold(ours.fa).replace(/\s/g, "");
  if (fa.some((f) => fold(f).replace(/\s/g, "") === mine)) return;
  rows.push({ severity: "medium", check: "Persian name: differs from Wikidata", country, record, name: ours.en, ours: ours.fa, wikidata: [...new Set(fa)].slice(0, 3).join(" | "), detail: "", link, qid: q });
}

/**
 * The Persian-name review sheet: every name that differs from Wikidata or has no Persian label.
 * Where ours differs, the proposal is the title of the Persian Wikipedia article (without its
 * disambiguator), falling back to the Wikidata label; unlabelled names keep ours for a reader.
 */
async function persianSheet() {
  const wanted = rows.filter((r) => r.check.startsWith("Persian name") && r.qid);
  const info = new Map<string, { label?: string; title?: string; url?: string }>();
  for (const batch of chunks([...new Set(wanted.map((r) => r.qid!))], 150)) {
    const bindings = await sparql(`
SELECT ?item ?label ?title ?article WHERE {
  VALUES ?item { ${batch.map((q) => `wd:${q}`).join(" ")} }
  OPTIONAL { ?item rdfs:label ?label . FILTER(LANG(?label) = "fa") }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://fa.wikipedia.org/> ; schema:name ?title . }
}`);
    for (const b of bindings)
      info.set(qid(b.item!.value), { label: b.label?.value, title: b.title?.value, url: b.article?.value });
  }
  const header = ["kind", "country", "record", "english", "ours", "wikidata_label", "fawiki_title", "proposed", "basis", "link", "verdict", "fix"];
  const lines = [header.join(",")];
  for (const r of wanted.sort((a, b) => a.check.localeCompare(b.check) || a.country.localeCompare(b.country) || a.name.localeCompare(b.name))) {
    const i = info.get(r.qid!) ?? {};
    const title = i.title?.replace(/\s*\([^)]*\)\s*$/, "");
    const differs = r.check.includes("differs");
    const proposed = differs ? (title ?? i.label ?? "") : r.ours;
    const basis = differs ? (title ? "Persian Wikipedia title" : "Wikidata Persian label") : "ours (no Persian label or article)";
    lines.push(
      [differs ? "differs" : "no Persian label", r.country, r.record, r.name, r.ours, i.label ?? "", i.title ?? "", proposed, basis, i.url ?? r.link, "", ""]
        .map(csv)
        .join(","),
    );
  }
  await writeFile(path.join(outDir, "persian-names.csv"), "\uFEFF" + lines.join("\n") + "\n");
  return wanted.length;
}

// ---------------------------------------------------------------- 3. source URLs

const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&");

async function fetchPage(url: string): Promise<{ status: number; body: string; error?: string }> {
  const load = async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(20000) });
        // Wikimedia rate-limits bursts: wait as asked and try again, rather than report a dead link.
        if ((res.status === 429 || res.status >= 500) && attempt < 6) {
          const wait = Number(res.headers.get("retry-after")) || 5 * (attempt + 1);
          await sleep(wait * 1000);
          continue;
        }
        const body = res.ok ? fold(text(await res.text())) : "";
        return JSON.stringify({ status: res.status, body });
      } catch (err) {
        if (attempt < 2) continue;
        return JSON.stringify({ status: 0, body: "", error: String(err) });
      }
    }
  };
  const raw = await cached(`url:${url}`, load);
  const page = JSON.parse(raw) as { status: number; body: string; error?: string };
  return page;
}

function mentions(page: string, names: string[]): boolean {
  for (const name of names) {
    const n = fold(name);
    if (n.length >= 3 && page.includes(n)) return true;
    // "Mehmed VI Vahideddin" is cited on a page that says "Mehmed VI": first and last word both present.
    const words = n.split(" ").filter((w) => w.length >= 3);
    if (words.length >= 2 && page.includes(words[0]) && page.includes(words.at(-1)!)) return true;
  }
  return false;
}

async function checkUrls(files: CountryFile[], known: Map<string, Labels>) {
  type Use = { country: string; record: string; people: Set<string> };
  const uses = new Map<string, Use>();
  const note = (url: string, country: string, record: string, person?: string) => {
    const use = uses.get(url) ?? { country, record, people: new Set<string>() };
    if (person) use.people.add(person);
    uses.set(url, use);
  };
  const names = new Map<string, string[]>();
  for (const file of files) {
    const c = file.country.id;
    for (const p of file.persons) {
      names.set(p.id, [p.name.en, ...(p.wikidata ? (known.get(p.wikidata)?.en ?? []) : [])]);
      for (const s of p.sources) note(s.url, c, `person ${p.id}`, p.id);
    }
    for (const t of file.terms) for (const s of t.sources) note(s.url, c, `term ${t.person}`, t.person);
    for (const s of file.states) for (const src of s.sources) note(src.url, c, `state ${s.id}`);
    for (const l of file.lane) for (const src of l.sources) note(src.url, c, "lane");
    for (const f of file.flags) for (const src of f.sources) note(src.url, c, "flag");
  }

  const urls = [...uses.keys()];
  let done = 0;
  const queue = [...urls];
  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      const page = await fetchPage(url);
      const use = uses.get(url)!;
      if (page.status < 200 || page.status >= 400) {
        rows.push({ severity: "high", check: "source: does not resolve", country: use.country, record: use.record, name: "", ours: url, wikidata: "", detail: page.error ?? `HTTP ${page.status}`, link: url });
      } else {
        for (const person of use.people) {
          if (!mentions(page.body, names.get(person) ?? [person])) {
            rows.push({ severity: "high", check: "source: does not mention the person", country: use.country, record: use.record, name: names.get(person)?.[0] ?? person, ours: url, wikidata: "", detail: "", link: url });
          }
        }
      }
      if (++done % 50 === 0) console.log(`  sources: ${done}/${urls.length}`);
      await sleep(400);
    }
  };
  await Promise.all(Array.from({ length: 2 }, worker));
  return urls.length;
}

// ---------------------------------------------------------------- 4. terms Wikidata lacks, confirmed by their sources

/**
 * A term Wikidata does not have is `source-confirmed` when a cited page states it as a range:
 * "1873–1874", "26 November 1873 – 22 May 1874", "from 1912 to 1916", or "1990 – present" for an
 * open term, with no other year in between. A term within one year needs that year within
 * 400 characters of the person's name. Merely containing both years somewhere is too weak (a
 * birth or death date can supply one), so that looser result is only noted in `detail`.
 */
const WINDOW = 400;
const confirmed = { strict: 0, loose: 0, total: 0 };
const GAP = "(?:(?!\\d{4}).){0,40}?";

function statesRange(page: string, start: number, end: number | null): boolean {
  const pattern =
    end === null
      ? `(?:${start}${GAP}(?:–|-|—)\\s*(?:present|incumbent)|since ${start})`
      : `${start}${GAP}(?:–|-|—|\\bto\\b|\\buntil\\b)${GAP}${end}`;
  return new RegExp(pattern).test(page);
}

function yearNearName(page: string, names: string[], year: string): boolean {
  const keys = names.flatMap((n) => {
    const words = fold(n).split(" ").filter((w) => w.length >= 3);
    return [fold(n), words.at(-1) ?? ""].filter((k) => k.length >= 3);
  });
  for (const key of new Set(keys))
    for (let at = page.indexOf(key); at !== -1; at = page.indexOf(key, at + 1))
      if (page.slice(Math.max(0, at - WINDOW), at + key.length + WINDOW).includes(year)) return true;
  return false;
}

function confirmFromSources(known: Map<string, Labels>, files: CountryFile[]) {
  const qidOf = new Map(files.flatMap((f) => f.persons.map((p) => [p.name.en, p.wikidata] as const)));
  for (const row of rows) {
    if (!row.evidence) continue;
    confirmed.total++;
    const { urls, names, start, end } = row.evidence;
    const q = qidOf.get(names[0]);
    const allNames = [...names, ...(q ? (known.get(q)?.en ?? []) : [])];
    // An open term has no end year to find.
    const wanted = [start, end].filter((y): y is number => y !== null).map(String);
    let strict: string | null = null;
    let loose: string | null = null;
    for (const url of urls) {
      const file = path.join(cacheDir, createHash("sha1").update(`url:${url}`).digest("hex"));
      let body = "";
      try {
        body = (JSON.parse(readFileSync(file, "utf8")) as { body: string }).body;
      } catch {
        continue;
      }
      if (!loose && wanted.every((y) => body.includes(y))) loose = url;
      const ok = start !== null && (start === end ? yearNearName(body, allNames, String(start)) : statesRange(body, start, end));
      if (!strict && ok) strict = url;
    }
    if (strict) {
      row.verdict = "source-confirmed";
      row.severity = "low";
      row.detail = `${start === end ? "The year appears next to the name" : "The term's years appear as a range"} in ${strict}.`;
      confirmed.strict++;
    } else if (loose) {
      row.detail += ` Both years appear in ${loose}, but not as a range: check by hand.`;
      confirmed.loose++;
    }
  }
}

// ---------------------------------------------------------------- main

const csv = (v: string) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

async function main() {
  await mkdir(cacheDir, { recursive: true });
  await mkdir(outDir, { recursive: true });
  const dir = path.join(root, "data/overrides/countries");
  const files: CountryFile[] = [];
  for (const name of (await readdir(dir)).filter((f) => f.endsWith(".json")).sort())
    files.push(JSON.parse(await readFile(path.join(dir, name), "utf8")));

  console.log("Terms against Wikidata P35/P6 …");
  let terms = 0;
  for (const file of files) {
    const items = [...new Set([file.country.wikidata, ...file.states.map((s) => s.wikidata)].filter((q): q is string => !!q))];
    const both = await termStatements(items);
    const P39 = OFFICES[file.country.id] ? await positionStatements(OFFICES[file.country.id]) : [];
    compareTerms(file, {
      P35: both.filter((s) => s.via.startsWith("P35")),
      P6: both.filter((s) => s.via.startsWith("P6")),
      P39,
    });
    terms += file.terms.length;
    await sleep(500);
  }

  console.log("Persian names against Wikidata labels …");
  const qids = [
    ...new Set(
      files.flatMap((f) => [f.country.wikidata, ...f.states.map((s) => s.wikidata), ...f.persons.map((p) => p.wikidata)]),
    ),
  ].filter((q): q is string => !!q);
  const known = await labels([...qids, ...new Set(missing.map((m) => m.statement.person))]);
  for (const { country, prop, statement: s } of missing) {
    rows.push({
      severity: "medium",
      check: `missing from data: Wikidata ${prop} holder`,
      country, record: prop === "P35" ? "head-of-state" : "head-of-government",
      name: known.get(s.person)?.en[0] ?? s.person, ours: "", wikidata: years(s.start, s.end),
      detail: `via ${s.via}. Acting holders and offices we model differently also show here.`, link: `https://www.wikidata.org/wiki/${s.person}`,
    });
  }
  let names = 0;
  for (const file of files) {
    const c = file.country.id;
    comparePersian(c, "country", file.country.name, file.country.wikidata, known);
    for (const s of file.states) comparePersian(c, `state ${s.id}`, s.name, s.wikidata, known);
    for (const p of file.persons) comparePersian(c, `person ${p.id}`, p.name, p.wikidata, known);
    names += 1 + file.states.length + file.persons.length;
  }

  let urls = 0;
  if (checkSources) {
    console.log("Source URLs …");
    urls = await checkUrls(files, known);
  }

  if (checkSources) confirmFromSources(known, files);

  const order = { high: 0, medium: 1, low: 2 };
  rows.sort((a, b) => order[a.severity] - order[b.severity] || a.check.localeCompare(b.check) || a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
  const header = ["severity", "check", "country", "record", "name", "ours", "wikidata", "detail", "link", "verdict", "fix"];
  const lines = [header.join(","), ...rows.map((r) => [r.severity, r.check, r.country, r.record, r.name, r.ours, r.wikidata, r.detail, r.link, r.verdict ?? "", ""].map(csv).join(","))];
  await writeFile(path.join(outDir, "audit.csv"), "﻿" + lines.join("\n") + "\n");
  const persian = await persianSheet();

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(`${r.severity}|${r.check}`, (counts.get(`${r.severity}|${r.check}`) ?? 0) + 1);
  const summary = [
    "# Data review",
    "",
    `Generated by \`pnpm data:audit\` on ${new Date().toISOString().slice(0, 10)}. It lists **only problems**: everything not listed matched.`,
    "",
    `Checked ${terms} terms against Wikidata P35/P6 (and P39 for heads of government), ${names} Persian names against Wikidata labels${checkSources ? `, and ${urls} source URLs` : ""}.`,
    "",
    "Open [audit.csv](audit.csv) in a spreadsheet, sort or filter by `severity` and `check`, and fill in `verdict` (ours right / Wikidata right / both wrong) and `fix`.",
    "",
    "| Severity | Check | Rows |",
    "| --- | --- | ---: |",
    ...[...counts].map(([k, n]) => {
      const [s, c] = k.split("|");
      return `| ${s} | ${c} | ${n} |`;
    }),
    "",
    ...(checkSources
      ? [
          `Source URLs: ${rows.filter((r) => r.check === "source: does not resolve").length} of ${urls} do not resolve; ${rows.filter((r) => r.check === "source: does not mention the person").length} cited for a person do not mention them.`,
          "",
          `Terms Wikidata lacks: ${confirmed.strict} of ${confirmed.total} are \`source-confirmed\` (a cited page states the years as a range, or a single-year term's year next to the name) and moved to *low*. ${confirmed.loose} more have both years somewhere on the page but not as a range; ${confirmed.total - confirmed.strict - confirmed.loose} have neither. Those ${confirmed.total - confirmed.strict} are left for a person to check.`,
          "",
        ]
      : []),
    `Persian names that differ from Wikidata or have no Persian label are also in [persian-names.csv](persian-names.csv) (${persian} rows), with a proposed spelling: the Persian Wikipedia article title where ours differs.`,
    "",
    "**Severity.** *high*: a source that fails, or years more than one apart. *medium*: a one-year difference, a record Wikidata lacks or has and we do not, a Persian name that differs or has no Wikidata label. *low*: Wikidata lacks a date, or models the office differently.",
    "",
    "Wikidata is a cross-check, not the truth: where it disagrees, the cited source decides.",
    "",
  ].join("\n");
  await writeFile(path.join(outDir, "README.md"), summary);
  console.log(`\n${rows.length} problem row(s) → ${path.relative(root, path.join(outDir, "audit.csv"))}`);
  for (const [k, n] of counts) console.log(`  ${n.toString().padStart(4)}  ${k.replace("|", "  ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
