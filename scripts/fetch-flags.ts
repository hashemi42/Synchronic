/**
 * Fetches flag candidates for every state that has a Wikidata id:
 *   1. P41 (flag image) statements with P580/P582 qualifiers and rank.
 *   2. Licence and attribution of each file from Wikimedia Commons.
 *
 * Writes data/raw/flags.json. Nothing here reaches the site directly: flags
 * are curated by hand into each country file's `flags[]`, with a certainty.
 *
 * Run: pnpm fetch:flags
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const UA = { "User-Agent": "SynchronicDataPipeline/0.1 (open-source history timeline)" };
const dir = path.join(process.cwd(), "data/merged");

type Candidate = {
  country: string;
  state: string;
  wikidata: string;
  file: string;
  start: number | null;
  end: number | null;
  rank: string;
  license: string | null;
  licenseUrl: string | null;
  attribution: string | null;
  mime: string | null;
};

const year = (iso?: string) => {
  const m = iso ? /^(-?)(\d+)-/.exec(iso) : null;
  return m ? (m[1] ? -1 : 1) * Number(m[2]) : null;
};
const stripHtml = (s?: string) => s?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || null;

async function main() {
  const states: { country: string; state: string; wikidata: string }[] = [];
  for (const name of (await readdir(dir)).filter((f) => f.endsWith(".json")).sort()) {
    const file = JSON.parse(await readFile(path.join(dir, name), "utf8"));
    for (const s of file.states) if (s.wikidata) states.push({ country: file.country.id, state: s.id, wikidata: s.wikidata });
  }

  const query = `
SELECT ?item ?image ?start ?end ?rank WHERE {
  VALUES ?item { ${[...new Set(states.map((s) => `wd:${s.wikidata}`))].join(" ")} }
  ?item p:P41 ?st . ?st ps:P41 ?image ; wikibase:rank ?rank .
  OPTIONAL { ?st pq:P580 ?start . }
  OPTIONAL { ?st pq:P582 ?end . }
}`;
  const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`, {
    headers: { ...UA, Accept: "application/sparql-results+json" },
  });
  if (!res.ok) throw new Error(`Wikidata responded ${res.status}: ${await res.text()}`);
  const bindings = ((await res.json()) as { results: { bindings: Record<string, { value: string } | undefined>[] } }).results.bindings;

  const candidates: Candidate[] = [];
  for (const b of bindings) {
    const q = b.item!.value.split("/").pop()!;
    const file = decodeURIComponent(b.image!.value.split("/Special:FilePath/").pop()!).replaceAll("_", " ");
    for (const s of states.filter((x) => x.wikidata === q)) {
      candidates.push({ ...s, file, start: year(b.start?.value), end: year(b.end?.value), rank: b.rank!.value.split("#").pop()!.replace("Rank", "").toLowerCase(), license: null, licenseUrl: null, attribution: null, mime: null });
    }
  }

  const files = [...new Set(candidates.map((c) => c.file))];
  for (let i = 0; i < files.length; i += 40) {
    const batch = files.slice(i, i + 40);
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({ action: "query", format: "json", prop: "imageinfo", iiprop: "extmetadata|mime", titles: batch.map((f) => `File:${f}`).join("|") }).toString();
    const json = (await (await fetch(url, { headers: UA })).json()) as { query: { normalized?: { from: string; to: string }[]; pages: Record<string, { title: string; imageinfo?: { mime: string; extmetadata: Record<string, { value: string }> }[] }> } };
    for (const page of Object.values(json.query.pages)) {
      const info = page.imageinfo?.[0];
      const title = page.title.replace(/^File:/, "");
      for (const c of candidates.filter((x) => x.file === title)) {
        c.mime = info?.mime ?? null;
        c.license = info?.extmetadata.LicenseShortName?.value ?? null;
        c.licenseUrl = info?.extmetadata.LicenseUrl?.value ?? null;
        c.attribution = stripHtml(info?.extmetadata.Artist?.value);
      }
    }
  }

  candidates.sort((a, b) => a.country.localeCompare(b.country) || a.state.localeCompare(b.state) || (a.start ?? -9999) - (b.start ?? -9999));
  const out = path.join(process.cwd(), "data/raw/flags.json");
  await writeFile(out, JSON.stringify({ fetchedAt: new Date().toISOString(), candidates }, null, 2) + "\n");

  const withFlag = new Set(candidates.map((c) => c.state));
  for (const c of candidates) console.log(`${c.country}/${c.state} | ${c.file} | ${c.start ?? ""}–${c.end ?? ""} | ${c.rank} | ${c.license} | ${(c.attribution ?? "").slice(0, 40)}`);
  console.log(`\nNo flag on Wikidata: ${states.filter((s) => !withFlag.has(s.state)).map((s) => s.state).join(", ") || "none"}`);
  console.log(`${candidates.length} candidates → ${path.relative(process.cwd(), out)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
