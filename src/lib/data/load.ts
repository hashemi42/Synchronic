import china from "../../../data/overrides/countries/china.json";
import france from "../../../data/overrides/countries/france.json";
import germany from "../../../data/overrides/countries/germany.json";
import india from "../../../data/overrides/countries/india.json";
import iran from "../../../data/overrides/countries/iran.json";
import japan from "../../../data/overrides/countries/japan.json";
import russia from "../../../data/overrides/countries/russia.json";
import turkey from "../../../data/overrides/countries/turkey.json";
import uk from "../../../data/overrides/countries/uk.json";
import presets from "../../../data/overrides/presets.json";
import world from "../../../data/overrides/world.json";
import { Presets, WorldFile, type CountryFile, type WorldPeriod } from "./schema";
import { validateCountryFile } from "./validate";

// Reads the curated override files directly. The pipeline (PRD §6.3) will
// replace this with pre-built JSON in public/data/, loaded per country (NF-2).
// The order here is the order of the country picker.
const files: Record<string, unknown> = { iran, uk, russia, turkey, france, germany, china, india, japan };

export function getCountryFile(id: string): CountryFile {
  const result = validateCountryFile(files[id]);
  if (!result.ok) {
    throw new Error(
      `Invalid data for "${id}":\n${result.issues.map((i) => `  ${i.path}: ${i.message}`).join("\n")}`,
    );
  }
  return result.data;
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
