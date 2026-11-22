/** Validates every country file in data/merged/, presets and the world row. Run: pnpm data:validate */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Presets, WorldFile, type CountryFile } from "../src/lib/data/schema";
import { checkAcrossFiles, validateCountryFile } from "../src/lib/data/validate";

const dir = path.join(process.cwd(), "data/merged");

async function main() {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  let failed = 0;
  const valid: CountryFile[] = [];

  for (const name of files) {
    const result = validateCountryFile(JSON.parse(await readFile(path.join(dir, name), "utf8")));
    if (result.ok) {
      valid.push(result.data);
      const { lane, terms, persons, states } = result.data;
      console.log(`✓ ${name} — ${states.length} states, ${lane.length} lane periods, ${persons.length} people, ${terms.length} terms`);
    } else {
      failed++;
      console.error(`✗ ${name}`);
      for (const issue of result.issues) console.error(`    ${issue.path}: ${issue.message}`);
    }
  }

  const across = checkAcrossFiles(valid);
  if (across.length > 0) {
    failed++;
    console.error("✗ across files");
    for (const issue of across) console.error(`    ${issue.path}: ${issue.message}`);
  }

  for (const [name, schema] of [["presets.json", Presets], ["world.json", WorldFile]] as const) {
    const result = schema.safeParse(JSON.parse(await readFile(path.join(process.cwd(), "data/overrides", name), "utf8")));
    if (result.success) {
      console.log(`✓ ${name}`);
    } else {
      failed++;
      console.error(`✗ ${name}`);
      for (const issue of result.error.issues) console.error(`    ${issue.path.join(".")}: ${issue.message}`);
    }
  }

  if (files.length === 0) {
    console.error("No country files found.");
    process.exit(1);
  }
  if (failed > 0) {
    console.error(`\n${failed} file(s) failed validation.`);
    process.exit(1);
  }
  console.log(`\n${files.length} file(s) valid.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
