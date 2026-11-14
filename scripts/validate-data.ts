/** Validates every country file in data/overrides/countries/. Run: pnpm data:validate */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { validateCountryFile } from "../src/lib/data/validate";

const dir = path.join(process.cwd(), "data/overrides/countries");

async function main() {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  let failed = 0;

  for (const name of files) {
    const result = validateCountryFile(JSON.parse(await readFile(path.join(dir, name), "utf8")));
    if (result.ok) {
      const { lane, terms, persons, states } = result.data;
      console.log(`✓ ${name} — ${states.length} states, ${lane.length} lane periods, ${persons.length} people, ${terms.length} terms`);
    } else {
      failed++;
      console.error(`✗ ${name}`);
      for (const issue of result.issues) console.error(`    ${issue.path}: ${issue.message}`);
    }
  }

  if (files.length === 0) {
    console.error("No country files found.");
    process.exit(1);
  }
  if (failed > 0) {
    console.error(`\n${failed} of ${files.length} files failed validation.`);
    process.exit(1);
  }
  console.log(`\n${files.length} file(s) valid.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
