/**
 * Summarise changes to data/overrides between a base git ref and the working tree, as Markdown.
 * Usage: tsx scripts/data-diff.ts <base-ref>   (used by .github/workflows/data-diff.yml)
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const base = process.argv[2];
if (!base) {
  console.error("Usage: tsx scripts/data-diff.ts <base-ref>");
  process.exit(1);
}

const DIR = "data/overrides/countries";

type Row = Record<string, unknown>;
type CountryData = Record<string, Row[] | Row>;

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

if (git(["rev-parse", "--verify", "--quiet", `${base}^{commit}`]) === null) {
  console.error(`Unknown base ref: ${base}`);
  process.exit(1);
}

function baseFile(file: string): CountryData | null {
  const text = git(["show", `${base}:${file}`]);
  return text === null ? null : JSON.parse(text);
}

const text = (v: unknown): string =>
  v && typeof v === "object" ? String((v as Record<string, unknown>).en ?? Object.values(v)[0] ?? "") : String(v ?? "");

const rows = (d: CountryData, collection: string): Row[] => (Array.isArray(d[collection]) ? (d[collection] as Row[]) : []);

const key = (r: Row, fields: string[]) => fields.map((f) => String(r[f] ?? "")).join("|");

/** Identity of a row within its collection; the rest of the row is what can "change". */
const IDENTITY: Record<string, string[]> = {
  states: ["id"],
  persons: ["id"],
  lane: ["state", "start"],
  terms: ["person", "state", "office", "start"],
  flags: ["state", "file"],
};

function label(collection: string, r: Row, persons: Map<string, string>): string {
  switch (collection) {
    case "states":
      return `${text(r.name)} (${r.start}–${r.end ?? "now"})`;
    case "persons":
      return text(r.name);
    case "lane":
      return `${r.state} ${r.start}–${r.end ?? "now"} (${r.kind})`;
    case "terms":
      return `${persons.get(String(r.person)) ?? r.person}, ${r.office} ${r.start}–${r.end ?? "now"}`;
    case "flags":
      return `${r.state}: ${r.file}${r.withheld ? " (withheld)" : ""}`;
    default:
      return JSON.stringify(r);
  }
}

function describeChange(before: Row, after: Row): string {
  return Object.keys({ ...before, ...after })
    .filter((f) => JSON.stringify(before[f]) !== JSON.stringify(after[f]))
    .map((f) => `${f} ${JSON.stringify(before[f] ?? null)} → ${JSON.stringify(after[f] ?? null)}`)
    .join("; ");
}

const lines: string[] = [];
let touched = 0;

for (const name of readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  const file = `${DIR}/${name}`;
  const after: CountryData = JSON.parse(readFileSync(file, "utf8"));
  const before = baseFile(file);
  const id = path.basename(name, ".json");
  if (!before) {
    lines.push(`### ${id}\n- **New country file** (${rows(after, "states").length} states, ${rows(after, "terms").length} terms)\n`);
    touched++;
    continue;
  }
  const persons = new Map<string, string>();
  for (const p of [...rows(before, "persons"), ...rows(after, "persons")]) persons.set(String(p.id), text(p.name));

  const out: string[] = [];
  for (const [collection, fields] of Object.entries(IDENTITY)) {
    const b = new Map(rows(before, collection).map((r) => [key(r, fields), r]));
    const a = new Map(rows(after, collection).map((r) => [key(r, fields), r]));
    for (const [k, r] of a) {
      const old = b.get(k);
      if (!old) out.push(`- ➕ ${collection}: ${label(collection, r, persons)}`);
      else if (JSON.stringify(old) !== JSON.stringify(r))
        out.push(`- ✏️ ${collection}: ${label(collection, r, persons)} — ${describeChange(old, r)}`);
    }
    for (const [k, r] of b) if (!a.has(k)) out.push(`- ➖ ${collection}: ${label(collection, r, persons)}`);
  }
  if (JSON.stringify(before.country) !== JSON.stringify(after.country)) out.push("- ✏️ country metadata changed");
  if (out.length) {
    touched++;
    const shown = out.slice(0, 40);
    lines.push(`### ${id}\n${shown.join("\n")}${out.length > shown.length ? `\n- … and ${out.length - shown.length} more` : ""}\n`);
  }
}

// Other data files: report only that they changed.
const changed = (git(["diff", "--name-only", base, "--", "data/"]) ?? "")
  .split("\n")
  .filter((f) => f && !f.startsWith(DIR));
if (changed.length) lines.push(`### Other data files\n${changed.map((f) => `- \`${f}\``).join("\n")}\n`);

console.log("<!-- data-diff -->");
console.log("## Data changes\n");
console.log(
  lines.length
    ? `${touched ? `${touched} country file(s) changed. Please check dates and sources for each line.\n\n` : ""}${lines.join("\n")}`
    : "No changes to historical data.",
);
