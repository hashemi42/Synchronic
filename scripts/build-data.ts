/**
 * Emits the site's data (PRD §6.3, step 5; NF-2, NF-3):
 *   public/data/countries/<id>.<hash>.json   one validated country file each,
 *                                            named by content so it can be cached forever
 *   src/generated/data-manifest.json         id → URL, read by the page at build time
 *
 * Runs before `dev`, `build`, `typecheck` and `test`. Fails on invalid data.
 *
 * Run: pnpm data:build
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveRuledBy } from "../src/lib/data/resolve";
import type { CountryFile } from "../src/lib/data/schema";
import { checkAcrossFiles, validateCountryFile } from "../src/lib/data/validate";

const root = process.cwd();
const source = path.join(root, "data/merged");
const out = path.join(root, "public/data/countries");
const manifestPath = path.join(root, "src/generated/data-manifest.json");

async function main() {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await mkdir(path.dirname(manifestPath), { recursive: true });

  const valid: CountryFile[] = [];
  for (const name of (await readdir(source)).filter((f) => f.endsWith(".json")).sort()) {
    const result = validateCountryFile(JSON.parse(await readFile(path.join(source, name), "utf8")));
    if (!result.ok) {
      console.error(`✗ ${name}\n${result.issues.map((i) => `    ${i.path}: ${i.message}`).join("\n")}`);
      process.exit(1);
    }
    valid.push(result.data);
  }
  const issues = checkAcrossFiles(valid);
  if (issues.length > 0) {
    console.error(issues.map((i) => `✗ ${i.path}: ${i.message}`).join("\n"));
    process.exit(1);
  }

  const countries: Record<string, string> = {};
  let bytes = 0;
  for (const file of valid) {
    // The browser loads one country at a time, so a ruled-by period carries its ruler's records.
    const body = JSON.stringify(resolveRuledBy(file, (country) => valid.find((f) => f.country.id === country)));
    const hash = createHash("sha256").update(body).digest("hex").slice(0, 10);
    const id = file.country.id;
    await writeFile(path.join(out, `${id}.${hash}.json`), body);
    countries[id] = `/data/countries/${id}.${hash}.json`;
    bytes += body.length;
  }

  await writeFile(manifestPath, JSON.stringify({ countries }, null, 2) + "\n");
  console.log(`${Object.keys(countries).length} countries → public/data/countries (${Math.round(bytes / 1024)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
