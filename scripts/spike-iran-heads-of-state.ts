/**
 * Phase 0 spike (PRD §12): one SPARQL query for Iran's heads of state with
 * start and end qualifiers.
 *
 * Two simple patterns, unioned (property paths over predecessor states time
 * out on the public endpoint):
 *   1. Iran's own P35 (head of state) statements with P580/P582 qualifiers.
 *   2. People whose P39 (position held) is an office in OFFICES, with qualifiers.
 * Wikidata's P35 coverage for Iran is thin before 1979 — which is exactly what
 * the spike is meant to find out. Gaps go to data/overrides/.
 *
 * Run: pnpm spike:iran   → writes data/raw/iran-heads-of-state.json
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ENDPOINT = "https://query.wikidata.org/sparql";

// wd:Q794 = Iran. wd:Q332486 = Supreme Leader of Iran.
const OFFICES = ["Q332486"];

const QUERY = /* sparql */ `
SELECT DISTINCT ?person ?personLabel ?personFa ?office ?officeLabel ?start ?end WHERE {
  {
    wd:Q794 p:P35 ?term .
    ?term ps:P35 ?person .
  } UNION {
    VALUES ?office { ${OFFICES.map((q) => `wd:${q}`).join(" ")} }
    ?person p:P39 ?term .
    ?term ps:P39 ?office .
    ?office rdfs:label ?officeLabel . FILTER(LANG(?officeLabel) = "en")
  }
  OPTIONAL { ?term pq:P580 ?start . }
  OPTIONAL { ?term pq:P582 ?end . }
  ?person rdfs:label ?personLabel . FILTER(LANG(?personLabel) = "en")
  OPTIONAL { ?person rdfs:label ?personFa . FILTER(LANG(?personFa) = "fa") }
}
ORDER BY ?start
`;

type Binding = Record<string, { type: string; value: string } | undefined>;

const year = (iso?: string) => {
  if (!iso) return null;
  // Wikidata dates look like "1909-07-16T00:00:00Z" or "-0500-01-01T00:00:00Z".
  const m = /^(-?)(\d+)-/.exec(iso);
  if (!m) return null;
  return (m[1] ? -1 : 1) * Number(m[2]);
};

async function main() {
  const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(QUERY)}`, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "SynchronicDataPipeline/0.1 (open-source history timeline)",
    },
  });
  if (!res.ok) throw new Error(`Wikidata responded ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { results: { bindings: Binding[] } };

  const rows = json.results.bindings.map((b) => ({
    person: b.person?.value.split("/").pop(),
    name: { en: b.personLabel?.value, fa: b.personFa?.value ?? null },
    office: b.officeLabel?.value ?? "head of state (P35)",
    officeId: b.office?.value.split("/").pop() ?? null,
    start: year(b.start?.value),
    end: year(b.end?.value),
  }));

  const out = path.join(process.cwd(), "data/raw/iran-heads-of-state.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify({ fetchedAt: new Date().toISOString(), query: QUERY, rows }, null, 2) + "\n");

  console.table(rows.map((r) => ({ person: r.name.en, fa: r.name.fa, office: r.office, start: r.start, end: r.end })));
  console.log(`\n${rows.length} rows → ${path.relative(process.cwd(), out)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
