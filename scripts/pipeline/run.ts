/**
 * The data pipeline (PRD §6.3): fetch → normalize → overrides → validate, for every country in
 * data/overrides/countries/, and a report of how the result differs from the hand-entered data.
 *
 * Writes
 *   data/raw/<country>/*.json                 the Wikidata responses
 *   data/merged/<country>.json                the pipeline's country file
 *   artifacts/data-review/pipeline-diff.md    summary of the differences
 *   artifacts/data-review/pipeline-diff.csv   every difference, one row each
 *   artifacts/data-review/persian-conflicts.csv   Persian names that need a decision
 *
 * It never writes to data/overrides/: the site keeps reading the hand-entered files.
 *
 * Run: pnpm data:pipeline            (add --refresh to query Wikidata again; name countries to limit the run)
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateCountryFile } from "../../src/lib/data/validate";
import { HEAD_OF_GOVERNMENT_FROM, OFFICES } from "../offices";
import { diffCountry, type Counts, type DiffRow } from "./diff";
import { fetchCountry } from "./fetch";
import { indexNames, normalize, type AddedTerm, type CountryFile, type HeadOffice } from "./normalize";
import { chunks, fetchRaw, officeSizeQuery, qid, statementsQuery, when, type Row } from "./wikidata";

const root = process.cwd();
const args = process.argv.slice(2);
const refresh = args.includes("--refresh");
const only = args.filter((a) => !a.startsWith("--"));
const json = async <T>(file: string) => JSON.parse(await readFile(path.join(root, file), "utf8")) as T;
const csv = (cells: unknown[]) => cells.map((c) => (/[",\n]/.test(String(c ?? "")) ? `"${String(c).replaceAll('"', '""')}"` : String(c ?? ""))).join(",");

/**
 * Which office an exception in data/policy/audit-exceptions.json leaves a person out of. The file
 * keys them by person only, and one person can hold both offices (Ali Khamenei: left out as head
 * of government under R8, kept as Supreme Leader), so the office is read from the reason.
 */
const excludedOffice = (reason: string) =>
  /Prime Minister|head of government|Council of Ministers|economic committee/i.test(reason) ? "head-of-government" : "head-of-state";

type Discovery = { office: string; name: string; matched: number; holders: number; known: number; state: string | null; accepted: boolean; why: string };

/**
 * Finds the head-of-state offices. Wikidata's P35 on a state item rarely lists past holders (Qajar
 * Iran has none), so heads of state have to come from P39, office by office, as heads of
 * government do. The offices are found from the people the hand data already has: an office is a
 * candidate when at least two hand-entered head-of-state terms sit inside a P39 statement of it.
 */
function candidates(hand: CountryFile, p39: Row[], skip: Set<string>) {
  const byPerson = Map.groupBy(p39, (r) => qid(r.item));
  const personQ = new Map(hand.persons.map((p) => [p.id, p.wikidata]));
  const mainline = new Set(hand.lane.filter((p) => p.kind !== "rival").map((p) => p.state));
  const found = new Map<string, { matched: number; states: Set<string>; terms: Set<string> }>();
  for (const t of hand.terms.filter((x) => x.office === "head-of-state")) {
    const seen = new Set<string>();
    for (const r of byPerson.get(personQ.get(t.person) ?? "") ?? []) {
      const office = qid(r.value);
      const start = when(r.start, r.startPrec, r.startCal)?.year;
      if (start == null || skip.has(office) || seen.has(office)) continue;
      const end = when(r.end, r.endPrec, r.endCal)?.year ?? 9999;
      const length = Math.max(1, (t.end ?? 9999) - t.start);
      const shared = Math.min(end, t.end ?? 9999) - Math.max(start, t.start);
      if (shared < 0 || Math.max(shared, 1) / length < 0.5) continue;
      seen.add(office);
      const e = found.get(office) ?? { matched: 0, states: new Set<string>(), terms: new Set<string>() };
      e.matched++;
      e.states.add(t.state);
      e.terms.add(`${t.person}|${t.state}|${t.start}`);
      found.set(office, e);
    }
  }
  return [...found].filter(([, e]) => e.matched >= 2).map(([office, e]) => ({
    office,
    matched: e.matched,
    terms: e.terms,
    // An office whose holders all sit in one state off the main sequence (the Mughal emperors) stays there.
    state: e.states.size === 1 && !mainline.has([...e.states][0]) ? [...e.states][0] : null,
  }));
}

async function main() {
  const dir = path.join(root, "data/overrides/countries");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  const exceptions = await json<{ missing: Record<string, string>; verified: Record<string, string> }>("data/policy/audit-exceptions.json");
  const manualFa = (await json<{ names: Record<string, string> }>("data/overrides/persian-names.json")).names;
  const addedTerms = (await json<{ terms: AddedTerm[] }>("data/overrides/heads-of-government.json")).terms;
  const excluded = new Map(Object.entries(exceptions.missing).map(([q, why]) => [`${q}:${excludedOffice(why)}`, why]));

  const all: DiffRow[] = [];
  const persianRows: string[][] = [];
  const summary: { country: string; counts: Counts; issues: string[]; notes: Map<string, number>; offices: Discovery[]; titles: Map<string, number>; persons: number; terms: number }[] = [];
  await mkdir(path.join(root, "data/merged"), { recursive: true });

  for (const name of files) {
    const hand = await json<CountryFile>(`data/overrides/countries/${name}`);
    const id = hand.country.id;
    if (only.length && !only.includes(id)) continue;
    const rawDir = path.join(root, "data/raw", id);
    const hog = OFFICES[id] ?? [];

    // Head-of-state offices: candidates from the hand data's people, then checked against all holders.
    const handHeads = [...new Set(hand.terms.filter((t) => t.office === "head-of-state").map((t) => hand.persons.find((p) => p.id === t.person)?.wikidata).filter((q): q is string => !!q))].sort();
    const p39 = await fetchRaw(path.join(rawDir, "positions.json"), chunks(handHeads, 150).map((b) => statementsQuery(b, ["P39"])), refresh);
    const cands = candidates(hand, p39, new Set(hog));
    const stateItems = hand.states.flatMap((s) => (s.wikidata ? [s.wikidata] : []));
    const candIds = cands.map((c) => c.office).sort();
    // Two cheap questions about each candidate before its holders are fetched: how many holders it
    // has (a seat in parliament is not a head-of-state office), and whose office it is.
    const sizes = new Map((await fetchRaw(path.join(rawDir, "office-sizes.json"), candIds.length ? [officeSizeQuery(candIds)] : [], refresh)).map((r) => [qid(r.office), Number(r.n)]));
    const about = await fetchRaw(path.join(rawDir, "offices.json"), candIds.length ? [statementsQuery(candIds, ["P1001", "P17"])] : [], refresh);
    const ownItems = new Set([hand.country.wikidata, ...stateItems]);
    const jurisdiction = (office: string) => {
      const of = about.filter((r) => qid(r.item) === office).map((r) => qid(r.value));
      return of.length === 0 ? "unknown" : of.some((q) => ownItems.has(q)) ? "own" : "elsewhere";
    };
    const tooBig = (c: (typeof cands)[number]) => (sizes.get(c.office) ?? 0) > 100 * c.matched;
    const eligible = cands.filter((c) => !tooBig(c));
    const raw = await fetchCountry(rawDir, stateItems, [...hog, ...eligible.map((c) => c.office)], candIds, refresh);

    const first = Math.min(...hand.lane.map((p) => p.start));
    const names = indexNames(raw.names);
    const known = new Set(handHeads);
    const named = new Set(raw.states.filter((r) => r.prop === "P1906").map((r) => qid(r.value)));
    const scored = cands.map((c) => {
      const holders = new Set(
        raw.holders.filter((r) => qid(r.office) === c.office && r.start && (when(r.end, r.endPrec, r.endCal)?.year ?? 9999) >= first).map((r) => qid(r.person)),
      );
      const hit = [...holders].filter((q) => known.has(q)).length;
      return { ...c, holders: holders.size, known: hit, precision: holders.size ? hit / holders.size : 0, tier: named.has(c.office) ? 0 : jurisdiction(c.office) === "own" ? 1 : jurisdiction(c.office) === "unknown" ? 2 : 3 };
    });
    // Taken in order: the office Wikidata names as the state's head of state, then other offices of
    // the lane's states, then the rest; within each, the most exact first. Any office but the
    // first kind is used only when at least half the hand-entered terms it matches are not
    // covered yet. That is what tells a throne from a side title of the same people (co-prince of
    // Andorra, monarch of Canada, commander-in-chief).
    const TIER = ["named by a state as its head-of-state office", "an office of one of the lane's states", "no jurisdiction on Wikidata", "its jurisdiction on Wikidata is another item"];
    const covered = new Set<string>();
    const offices: Discovery[] = scored
      .sort((a, b) => a.tier - b.tier || b.precision - a.precision || b.matched - a.matched || a.office.localeCompare(b.office))
      .map((c) => {
        const n = names.get(c.office);
        const fresh = [...c.terms].filter((t) => !covered.has(t)).length;
        const enough = c.tier === 0 ? fresh > 0 : fresh >= Math.max(1, c.matched / 2);
        const why = tooBig(c)
          ? `${sizes.get(c.office)} holders in all: not a head-of-state office`
          : c.precision < 0.6
            ? "most holders are not heads of state in the hand data"
            : !enough
              ? `a side title: ${fresh} of its ${c.matched} terms are not covered by the offices above`
              : TIER[c.tier];
        const accepted = !tooBig(c) && c.precision >= 0.6 && enough;
        if (accepted) for (const t of c.terms) covered.add(t);
        return { office: c.office, name: n?.labelEn ?? n?.wikiEn ?? n?.labelMul ?? c.office, matched: c.matched, holders: tooBig(c) ? (sizes.get(c.office) ?? 0) : c.holders, known: c.known, state: c.state, accepted, why };
      });
    const hosOffices: HeadOffice[] = offices.filter((o) => o.accepted).map((o) => ({ office: o.office, state: o.state }));

    const result = normalize(raw, { curated: hand, hogOffices: hog, hogFrom: HEAD_OF_GOVERNMENT_FROM, hosOffices, excluded, manualFa, addedTerms });
    await writeFile(path.join(root, "data/merged", `${id}.json`), JSON.stringify(result.file, null, 2) + "\n");

    const check = validateCountryFile(result.file);
    const issues = check.ok ? [] : check.issues.map((i) => `${i.path}: ${i.message}`);
    const { rows, counts, titles } = diffCountry(hand, result.file, { notes: result.notes, flagCandidates: result.flagCandidates, verified: exceptions.verified, first });
    all.push(...rows);
    summary.push({ country: id, counts, issues, notes: new Map([...Map.groupBy(result.notes, (n) => n.kind)].map(([k, v]) => [k, v.length])), offices, titles, persons: result.file.persons.length, terms: result.file.terms.length });

    // Persian names that need a decision (D4).
    const handFa = new Map<string, string>();
    for (const r of [...hand.persons, ...hand.states]) if (r.wikidata) handFa.set(r.wikidata, r.name.fa);
    const confirmed = new Set(hand.states.map((s) => s.wikidata));
    for (const r of [...result.file.states.map((s) => ({ ...s, type: "state" })), ...result.file.persons.map((p) => ({ ...p, type: "person" }))]) {
      const src = r.wikidata ? result.persian.get(r.wikidata) : undefined;
      if (!src) continue;
      const ours = handFa.get(r.wikidata!) ?? "";
      const reasons: string[] = [];
      if (src.from !== "fa.wikipedia") reasons.push(`a: no fa.wikipedia article (name from ${src.from})`);
      if (src.title) reasons.push(`b: the fa.wikipedia title has a suffix: ${src.title}`);
      if (r.type === "state" && confirmed.has(r.wikidata) && src.from === "fa.wikipedia" && ours && ours !== r.name.fa) reasons.push("c: differs from the confirmed state name");
      if (reasons.length) persianRows.push([id, r.type, r.id, r.name.en, ours, r.name.fa, reasons.join("; "), `https://www.wikidata.org/wiki/${r.wikidata}`, ""]);
    }
    console.log(`${id.padEnd(8)} ${String(result.file.terms.length).padStart(4)} terms, ${String(rows.length).padStart(4)} differences, ${issues.length} validation issues`);
  }

  const out = path.join(root, "artifacts/data-review");
  await writeFile(path.join(out, "pipeline-diff.csv"), "﻿" + [csv(["country", "entity", "record", "field", "status", "ours", "pipeline", "note", "link", "decision"]), ...all.map((r) => csv([r.country, r.entity, r.record, r.field, r.status, r.ours, r.pipeline, r.note, r.link, ""]))].join("\n") + "\n");
  await writeFile(path.join(out, "persian-conflicts.csv"), "﻿" + [csv(["country", "type", "record", "name", "ours", "pipeline", "why", "link", "decision"]), ...persianRows.map(csv)].join("\n") + "\n");

  // ---------------------------------------------------------------- the summary
  const groups = [...new Set(summary.flatMap((s) => Object.keys(s.counts)))].sort();
  const total = (g: string, f: keyof Counts[string]) => summary.reduce((n, s) => n + (s.counts[g]?.[f] ?? 0), 0);
  const md: string[] = [
    "# Pipeline against the hand-entered data",
    "",
    `Generated by \`pnpm data:pipeline\`. It compares \`data/overrides/countries/\` (hand-entered, what the site reads) with \`data/merged/\` (built from Wikidata by the pipeline). Nothing in \`data/overrides/\` was changed.`,
    "",
    "Every difference is a row in [pipeline-diff.csv](pipeline-diff.csv) with an empty `decision` column. Persian names that need a decision are in [persian-conflicts.csv](persian-conflicts.csv).",
    "",
    "## All nine countries",
    "",
    "| What | Same | Differs | Only in hand data | Only in pipeline |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...groups.map((g) => `| ${g} | ${total(g, "same")} | ${total(g, "differs")} | ${total(g, "onlyOurs")} | ${total(g, "onlyPipeline")} |`),
    "",
    "Terms are compared as a person's unbroken time in an office, so two cabinets in a row count once. A term that began before the lane's first year matches whatever its true start.",
    "",
    "## Terms by country",
    "",
    "| Country | Office | Same | Differs | Only in hand data | Only in pipeline |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...summary.flatMap((s) => Object.entries(s.counts).filter(([g]) => g.startsWith("term: ")).sort().map(([g, c]) => `| ${s.country} | ${g.slice(6)} | ${c.same} | ${c.differs} | ${c.onlyOurs} | ${c.onlyPipeline} |`)),
    "",
    "## Head-of-state offices found on Wikidata",
    "",
    "Wikidata's \"head of state\" statements on state items rarely list past holders, so the pipeline reads heads of state from \"position held\", office by office. These offices were found from the people already in the data. An office is used when at least 60% of its dated holders in the lane's years are people the hand data has as heads of state, and it is not a side title of an office already taken (at least half the terms it matches are new). **The offices marked yes become curated configuration and need your confirmation.**",
    "",
    "| Country | Office | Hand terms it matches | Holders in the lane's years | Of them known | Used | Why |",
    "| --- | --- | ---: | ---: | ---: | --- | --- |",
    ...summary.flatMap((s) => s.offices.sort((a, b) => Number(b.accepted) - Number(a.accepted) || b.matched - a.matched || a.office.localeCompare(b.office)).map((o) => `| ${s.country} | [${o.name}](https://www.wikidata.org/wiki/${o.office})${o.state ? ` (only in \`${o.state}\`)` : ""} | ${o.matched} | ${o.holders} | ${o.known} | ${o.accepted ? "**yes**" : "no"} | ${o.why} |`)),
    "",
    "## What the pipeline could not use",
    "",
    "| Country | Kind | Count |",
    "| --- | --- | ---: |",
    ...summary.flatMap((s) => [...s.notes].sort().map(([k, n]) => `| ${s.country} | ${k} | ${n} |`)),
    "",
    "## Titles",
    "",
    "Where the years agree but the title differs. The hand data's titles are short (\"Shah\"); the pipeline takes the office's name from Wikidata, or a generic title where the statement names no office.",
    "",
    "| Country | Office | Hand data | Pipeline | Terms |",
    "| --- | --- | --- | --- | ---: |",
    ...summary.flatMap((s) => [...s.titles].sort((a, b) => b[1] - a[1]).map(([k, n]) => `| ${s.country} | ${k.split(" | ").join(" | ")} | ${n} |`)),
    "",
    "## Is the pipeline's output valid?",
    "",
    "| Country | People | Terms | Validation issues |",
    "| --- | ---: | ---: | ---: |",
    ...summary.map((s) => `| ${s.country} | ${s.persons} | ${s.terms} | ${s.issues.length} |`),
    "",
    ...summary.filter((s) => s.issues.length).flatMap((s) => [`**${s.country}**`, "", ...s.issues.slice(0, 12).map((i) => `- ${i}`), ...(s.issues.length > 12 ? [`- … and ${s.issues.length - 12} more`] : []), ""]),
  ];
  await writeFile(path.join(out, "pipeline-diff.md"), md.join("\n"));
  console.log(`${all.length} differences → artifacts/data-review/pipeline-diff.csv; ${persianRows.length} Persian names to decide`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
