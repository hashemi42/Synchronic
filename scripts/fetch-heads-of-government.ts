/**
 * Fetches head-of-government terms (PRD §6.3, step 1): everyone who held one of
 * the offices below (P39), with start and end qualifiers and Persian labels.
 *
 * Writes data/raw/heads-of-government.json. Terms are reviewed and merged into
 * each country file's `terms[]` by hand or with a merge script; the site never
 * reads this file.
 *
 * Run: pnpm fetch:hog
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { OFFICES } from "./offices";

const UA = { "User-Agent": "SynchronicDataPipeline/0.1 (open-source history timeline)" };

const year = (iso?: string) => {
  const m = iso ? /^(-?)(\d+)-/.exec(iso) : null;
  return m ? (m[1] ? -1 : 1) * Number(m[2]) : null;
};

async function main() {
  const values = [...new Set(Object.values(OFFICES).flat())].map((q) => `wd:${q}`).join(" ");
  const query = `
SELECT ?office ?officeLabel ?person ?personLabel ?enTitle ?personFa ?faTitle ?start ?end ?rank WHERE {
  VALUES ?office { ${values} }
  ?person p:P39 ?st . ?st ps:P39 ?office ; wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank)
  OPTIONAL { ?st pq:P580 ?start . }
  OPTIONAL { ?st pq:P582 ?end . }
  OPTIONAL { ?person rdfs:label ?personFa . FILTER(LANG(?personFa) = "fa") }
  OPTIONAL { ?fa schema:about ?person ; schema:isPartOf <https://fa.wikipedia.org/> ; schema:name ?faTitle . }
  OPTIONAL { ?en schema:about ?person ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enTitle . }
  # Many common names now live only in the language-neutral "mul" label.
  OPTIONAL { ?person rdfs:label ?enLabel . FILTER(LANG(?enLabel) = "en") }
  OPTIONAL { ?person rdfs:label ?mulLabel . FILTER(LANG(?mulLabel) = "mul") }
  BIND(COALESCE(?enLabel, ?mulLabel, STRAFTER(STR(?person), "entity/")) AS ?personLabel)
  OPTIONAL { ?office rdfs:label ?officeEn . FILTER(LANG(?officeEn) = "en") }
  BIND(COALESCE(?officeEn, STRAFTER(STR(?office), "entity/")) AS ?officeLabel)
}`;
  const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`, {
    headers: { ...UA, Accept: "application/sparql-results+json" },
  });
  if (!res.ok) throw new Error(`Wikidata responded ${res.status}: ${await res.text()}`);
  const bindings = ((await res.json()) as { results: { bindings: Record<string, { value: string } | undefined>[] } })
    .results.bindings;

  const officeCountry = new Map(Object.entries(OFFICES).flatMap(([c, qs]) => qs.map((q) => [q, c] as const)));
  const seen = new Set<string>();
  const rows = bindings
    .map((b) => {
      const office = b.office!.value.split("/").pop()!;
      return {
        country: officeCountry.get(office)!,
        office,
        officeLabel: b.officeLabel!.value,
        person: b.person!.value.split("/").pop()!,
        name: { en: b.personLabel!.value, enWiki: b.enTitle?.value ?? null, fa: b.personFa?.value ?? null, faWiki: b.faTitle?.value ?? null },
        start: year(b.start?.value),
        end: year(b.end?.value),
      };
    })
    .filter((r) => {
      const key = `${r.office}|${r.person}|${r.start}|${r.end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.country.localeCompare(b.country) || (a.start ?? 9999) - (b.start ?? 9999));

  const out = path.join(process.cwd(), "data/raw/heads-of-government.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify({ fetchedAt: new Date().toISOString(), offices: OFFICES, rows }, null, 2) + "\n");

  for (const [country, list] of Object.entries(OFFICES)) {
    const mine = rows.filter((r) => r.country === country);
    const dated = mine.filter((r) => r.start !== null);
    console.log(
      `${country.padEnd(8)} ${String(mine.length).padStart(4)} terms, ${mine.length - dated.length} undated, ` +
        `${mine.filter((r) => !r.name.fa && !r.name.faWiki).length} without Persian, ` +
        `years ${Math.min(...dated.map((r) => r.start!))}–${Math.max(...dated.map((r) => r.end ?? r.start!))} (${list.length} offices)`,
    );
  }
  console.log(`${rows.length} terms → ${path.relative(process.cwd(), out)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
