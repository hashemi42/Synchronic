/**
 * Pipeline, stage 1 (PRD §6.3 step 1): SPARQL against Wikidata, cached in data/raw/<country>/.
 *
 * Every later stage reads only these files, so a run without --refresh is offline and repeatable,
 * and a refresh shows up as a diff of the raw files.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const UA = { "User-Agent": "SynchronicDataPipeline/0.2 (open-source history timeline)" };
const ENDPOINT = "https://query.wikidata.org/sparql";
const GREGORIAN = "http://www.wikidata.org/entity/Q1985727";

export type Row = Record<string, string>;
export type RawFile = { query: string; fetchedAt: string; rows: Row[] };

/** A point in time as Wikidata states it. `exact` is set only for Gregorian dates known to the month or day. */
export type When = { year: number; exact?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const qid = (uri: string) => uri.split("/").pop()!;
export const chunks = <T>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

async function query(sparql: string): Promise<Row[]> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { ...UA, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ query: sparql }),
    });
    if (res.ok) {
      const json = (await res.json()) as { results: { bindings: Record<string, { value: string; "xml:lang"?: string }>[] } };
      return json.results.bindings.map((b) => {
        const row: Row = {};
        for (const [k, v] of Object.entries(b)) {
          row[k] = v.value;
          if (v["xml:lang"]) row[`${k}Lang`] = v["xml:lang"];
        }
        return row;
      });
    }
    if (attempt >= 4 || (res.status !== 429 && res.status < 500)) throw new Error(`Wikidata ${res.status}: ${await res.text()}`);
    await sleep(3000 * (attempt + 1));
  }
}

/**
 * Runs the queries (one per batch of VALUES) and stores the rows, sorted, as one raw file.
 * Without `refresh`, an existing file made by the same queries is reused.
 */
export async function fetchRaw(file: string, queries: string[], refresh: boolean): Promise<Row[]> {
  const text = queries.join("\n# ----\n");
  if (!refresh) {
    try {
      const cached = JSON.parse(await readFile(file, "utf8")) as RawFile;
      if (cached.query === text) return cached.rows;
    } catch {
      // not fetched yet
    }
  }
  const rows: Row[] = [];
  for (const q of queries) {
    rows.push(...(await query(q)));
    await sleep(250);
  }
  const lines = [...new Set(rows.map((r) => JSON.stringify(r, Object.keys(r).sort())))].sort();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    `{\n"query": ${JSON.stringify(text)},\n"fetchedAt": ${JSON.stringify(new Date().toISOString())},\n"rows": [\n${lines.join(",\n")}\n]\n}\n`,
  );
  return lines.map((l) => JSON.parse(l) as Row);
}

export async function readRaw(file: string): Promise<Row[]> {
  return (JSON.parse(await readFile(file, "utf8")) as RawFile).rows;
}

/**
 * A Wikidata time value as a year, plus the exact date when it is safe to give one: Gregorian
 * calendar, precision of a month (10) or a day (11), and a year in the common era.
 */
export function when(iso?: string, precision?: string, calendar?: string): When | null {
  const m = iso ? /^(-?)(\d+)-(\d\d)-(\d\d)/.exec(iso) : null;
  if (!m) return null;
  const year = (m[1] ? -1 : 1) * Number(m[2]);
  const p = Number(precision ?? 9);
  if (p < 9) return null; // a decade or a century is not a year
  const out: When = { year };
  if (year >= 1 && calendar === GREGORIAN && p >= 10) {
    out.exact = `${String(year).padStart(4, "0")}-${m[3]}${p >= 11 ? `-${m[4]}` : ""}`;
  }
  return out;
}

const values = (ids: string[]) => ids.map((q) => `wd:${q}`).join(" ");
const time = (v: string, pred: string) =>
  `OPTIONAL { ?st ${pred} [ wikibase:timeValue ?${v} ; wikibase:timePrecision ?${v}Prec ; wikibase:timeCalendarModel ?${v}Cal ] . }`;

/** Statements of the given properties on the given items, with rank and start/end qualifiers. */
export const statementsQuery = (items: string[], props: string[]) => `
SELECT ?item ?prop ?st ?rank ?value ?at ?atPrec ?atCal ?start ?startPrec ?startCal ?end ?endPrec ?endCal ?nature WHERE {
  VALUES ?item { ${values(items)} }
  VALUES (?prop ?p ?ps ?psv) { ${props.map((p) => `("${p}" p:${p} ps:${p} psv:${p})`).join(" ")} }
  ?item ?p ?st . ?st wikibase:rank ?rank ; ?ps ?value .
  FILTER(?rank != wikibase:DeprecatedRank)
  OPTIONAL { ?st ?psv [ wikibase:timeValue ?at ; wikibase:timePrecision ?atPrec ; wikibase:timeCalendarModel ?atCal ] . }
  ${time("start", "pqv:P580")}
  ${time("end", "pqv:P582")}
  OPTIONAL { ?st pq:P5102 ?nature . }
}`;

/** Everyone who held one of the offices (P39), with start/end qualifiers. */
export const holdersQuery = (offices: string[]) => `
SELECT ?office ?person ?st ?rank ?start ?startPrec ?startCal ?end ?endPrec ?endCal ?nature WHERE {
  VALUES ?office { ${values(offices)} }
  ?person p:P39 ?st . ?st ps:P39 ?office ; wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank)
  ${time("start", "pqv:P580")}
  ${time("end", "pqv:P582")}
  OPTIONAL { ?st pq:P5102 ?nature . }
}`;

/**
 * English, language-neutral and Persian labels, and the English and Persian Wikipedia titles, as
 * rows { item, kind, name }.
 *
 * These come from the entity API, not from SPARQL: the query service's output drops the zero-width
 * non-joiner, which Persian spelling needs («خامنه‌ای»).
 */
export async function fetchNames(file: string, items: string[], refresh: boolean): Promise<Row[]> {
  const ids = [...new Set(items)].sort();
  const key = `wbgetentities labels and sitelinks: ${ids.join(" ")}`;
  if (!refresh) {
    try {
      const cached = JSON.parse(await readFile(file, "utf8")) as RawFile;
      if (cached.query === key) return cached.rows;
    } catch {
      // not fetched yet
    }
  }
  type Entity = { labels?: Record<string, { value: string }>; sitelinks?: Record<string, { title: string }> };
  const rows: Row[] = [];
  for (const batch of chunks(ids, 50)) {
    const url = new URL("https://www.wikidata.org/w/api.php");
    url.search = new URLSearchParams({ action: "wbgetentities", format: "json", ids: batch.join("|"), props: "labels|sitelinks", languages: "en|mul|fa", sitefilter: "enwiki|fawiki" }).toString();
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, { headers: UA });
      if (res.ok) {
        const json = (await res.json()) as { entities: Record<string, Entity> };
        for (const [q, e] of Object.entries(json.entities)) {
          const item = `http://www.wikidata.org/entity/${q}`;
          for (const lang of ["en", "mul", "fa"]) if (e.labels?.[lang]) rows.push({ item, kind: `label:${lang}`, name: e.labels[lang].value });
          if (e.sitelinks?.enwiki) rows.push({ item, kind: "wiki:en", name: e.sitelinks.enwiki.title });
          if (e.sitelinks?.fawiki) rows.push({ item, kind: "wiki:fa", name: e.sitelinks.fawiki.title });
        }
        break;
      }
      if (attempt >= 8 || (res.status !== 429 && res.status < 500)) throw new Error(`Wikidata API ${res.status}`);
      await sleep(Math.max(Number(res.headers.get("retry-after") ?? 0) * 1000, 10_000 * (attempt + 1)));
    }
    await sleep(1000);
  }
  const lines = rows.map((r) => JSON.stringify(r, Object.keys(r).sort())).sort();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `{\n"query": ${JSON.stringify(key)},\n"fetchedAt": ${JSON.stringify(new Date().toISOString())},\n"rows": [\n${lines.join(",\n")}\n]\n}\n`);
  return lines.map((l) => JSON.parse(l) as Row);
}

/** How many "position held" statements name each office: a seat in parliament has thousands, a throne a few. */
export const officeSizeQuery = (offices: string[]) => `
SELECT ?office (COUNT(?st) AS ?n) WHERE {
  VALUES ?office { ${values(offices)} }
  ?person p:P39 ?st . ?st ps:P39 ?office .
} GROUP BY ?office`;

const COMMONS = "https://commons.wikimedia.org/w/api.php";
const stripHtml = (v?: string) => v?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() ?? "";

/** Licence, author and hash of files on Wikimedia Commons, as rows (one per file) for fetchRaw's cache format. */
export async function fetchCommons(file: string, titles: string[], refresh: boolean): Promise<Row[]> {
  const key = `commons imageinfo: ${[...titles].sort().join(" | ")}`;
  if (!refresh) {
    try {
      const cached = JSON.parse(await readFile(file, "utf8")) as RawFile;
      if (cached.query === key) return cached.rows;
    } catch {
      // not fetched yet
    }
  }
  const rows: Row[] = [];
  for (const batch of chunks([...titles].sort(), 40)) {
    const url = new URL(COMMONS);
    url.search = new URLSearchParams({ action: "query", format: "json", prop: "imageinfo", iiprop: "extmetadata|sha1|mime", titles: batch.map((t) => `File:${t}`).join("|") }).toString();
    const res = await fetch(url, { headers: UA });
    if (!res.ok) throw new Error(`Commons ${res.status}`);
    const json = (await res.json()) as { query: { normalized?: { from: string; to: string }[]; pages: Record<string, { title: string; missing?: string; imageinfo?: { sha1: string; mime: string; extmetadata: Record<string, { value: string }> }[] }> } };
    const asked = new Map((json.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of Object.values(json.query.pages)) {
      const info = page.imageinfo?.[0];
      const name = (asked.get(page.title) ?? page.title).replace(/^File:/, "");
      if (!info) continue;
      const m = info.extmetadata;
      rows.push({ file: name, sha1: info.sha1, mime: info.mime, license: m.LicenseShortName?.value ?? "", licenseUrl: m.LicenseUrl?.value ?? "", attribution: stripHtml(m.Artist?.value) });
    }
    await sleep(250);
  }
  rows.sort((a, b) => a.file.localeCompare(b.file));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `{\n"query": ${JSON.stringify(key)},\n"fetchedAt": ${JSON.stringify(new Date().toISOString())},\n"rows": [\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]\n}\n`);
  return rows;
}

export async function fetchedAt(file: string): Promise<string> {
  return (JSON.parse(await readFile(file, "utf8")) as RawFile).fetchedAt.slice(0, 10);
}
