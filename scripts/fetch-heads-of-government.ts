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

/** country id → Wikidata items of its head-of-government offices, oldest first. */
export const OFFICES: Record<string, string[]> = {
  iran: ["Q13561063", "Q838380"], // Prime Minister of Iran; President of Iran (head of government from 1989)
  uk: ["Q14211"], // Prime Minister of the United Kingdom
  // Chairman of the Council of People's Commissars of the RSFSR; … of the USSR; Chairman of the
  // Council of Ministers of the USSR; Premier of the Soviet Union; Prime Minister of Russia
  russia: ["Q56919889", "Q4376682", "Q4376674", "Q462189", "Q842386"],
  turkey: ["Q15063567", "Q2430415", "Q1922067"], // Grand vizier; Prime Minister; President (from 2018)
  // President of the Council (1815–1958); Chairman of the Provisional Government; Prime Minister (1959–)
  france: ["Q3409212", "Q100711731", "Q1587677"],
  // Reich Chancellor (both items); Chancellor of Germany; Federal Chancellor; Prime Minister of East Germany
  germany: ["Q7050658", "Q29034484", "Q56022", "Q4970706", "Q2335229"],
  // Imperial Cabinet (1911); Premier of the Cabinet (Beiyang); Premier of the Republic of China; Premier of the PRC
  china: ["Q5369523", "Q30060907", "Q702650", "Q4122271"],
  india: ["Q192711"], // Prime Minister of India
  japan: ["Q274948"], // Prime Minister of Japan
};

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
