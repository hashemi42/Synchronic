import china from "../../../data/merged/china.json";
import france from "../../../data/merged/france.json";
import germany from "../../../data/merged/germany.json";
import india from "../../../data/merged/india.json";
import iran from "../../../data/merged/iran.json";
import japan from "../../../data/merged/japan.json";
import russia from "../../../data/merged/russia.json";
import turkey from "../../../data/merged/turkey.json";
import uk from "../../../data/merged/uk.json";
import us from "../../../data/merged/us.json";
import presets from "../../../data/overrides/presets.json";
import world from "../../../data/overrides/world.json";
import { resolveRuledBy } from "./resolve";
import { Presets, WorldFile, type CountryFile, type WorldPeriod } from "./schema";
import { validateCountryFile } from "./validate";

// Reads the pipeline's output (PRD §6.3). The browser loads the same files per
// country from public/data/ (NF-2). The order here is the order of the country picker.
const files: Record<string, unknown> = { iran, uk, russia, turkey, france, germany, china, india, japan, us };

/** A country file as it is in data/merged/, with `ruled-by` periods pointing at other files. */
export function getMergedFile(id: string): CountryFile {
  const result = validateCountryFile(files[id]);
  if (!result.ok) {
    throw new Error(
      `Invalid data for "${id}":\n${result.issues.map((i) => `  ${i.path}: ${i.message}`).join("\n")}`,
    );
  }
  return result.data;
}

/** A country file as the site shows it: `ruled-by` periods filled in from the ruling country's file. */
export function getCountryFile(id: string): CountryFile {
  return resolveRuledBy(getMergedFile(id), (country) => (country in files ? getMergedFile(country) : undefined));
}

export function getAllCountryFiles(): CountryFile[] {
  return Object.keys(files).map(getCountryFile);
}

export function getPresets(): Presets {
  return Presets.parse(presets);
}

export function getWorldPeriods(): WorldPeriod[] {
  return WorldFile.parse(world).periods.toSorted((a, b) => a.start - b.start);
}
