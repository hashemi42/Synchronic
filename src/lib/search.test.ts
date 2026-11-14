import { describe, expect, it } from "vitest";
import { getAllCountryFiles, getPresets } from "./data/load";
import { buildSearchIndex, fold, searchCountries } from "./search";
import { summarize } from "./data/summary";

const files = getAllCountryFiles();
const index = buildSearchIndex(files.map((f) => summarize(f, 2026)));
const find = (q: string) => searchCountries(index, q);

describe("searchCountries", () => {
  it("lists every country for an empty query", () => {
    expect(find("  ")).toHaveLength(9);
  });

  it("matches partial English and Persian names", () => {
    expect(find("tur")).toEqual(["turkey"]);
    expect(find("ترک")).toEqual(["turkey"]);
    expect(find("JAP")).toEqual(["japan"]);
  });

  it("matches aliases and historical states", () => {
    expect(find("persia")).toContain("iran");
    expect(find("ottoman")).toEqual(["turkey"]);
    expect(find("قاجار")).toEqual(["iran"]);
    expect(find("soviet")).toEqual(["russia"]);
  });

  it("ranks a name match above a state match", () => {
    // "Indian Empire" is the Raj's official name; "India" the country comes first.
    expect(find("india")[0]).toBe("india");
  });

  it("ignores Arabic letter forms, half-spaces and diacritics", () => {
    expect(fold("تركيه")).toBe(fold("ترکیه"));
    expect(fold("شوگون‌سالاری")).toBe("شوگونسالاری");
    expect(fold("Türkiye")).toBe("turkiye");
    expect(find("turkiye")).toEqual(["turkey"]);
  });

  it("returns nothing for no match", () => {
    expect(find("atlantis")).toEqual([]);
  });
});

describe("presets", () => {
  it("only name countries that exist", () => {
    const ids = new Set(files.map((f) => f.country.id));
    const { presets, oftenCompared } = getPresets();
    expect(presets.length).toBeGreaterThan(0);
    for (const id of [...presets.flatMap((p) => p.countries), ...Object.keys(oftenCompared), ...Object.values(oftenCompared).flat()])
      expect(ids.has(id), id).toBe(true);
  });
});
