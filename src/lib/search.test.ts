import { describe, expect, it } from "vitest";
import { getAllCountryFiles, getPresets } from "./data/load";
import { buildSearchIndex, fold, searchCountries, sound } from "./search";
import { summarize } from "./data/summary";

const files = getAllCountryFiles();
const index = buildSearchIndex(files.map((f) => summarize(f, 2026)));
const find = (q: string) => searchCountries(index, q);

describe("searchCountries", () => {
  it("lists every country for an empty query", () => {
    expect(find("  ")).toHaveLength(files.length);
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

describe("transliteration variants (L-6)", () => {
  it("gives spellings of one name the same sound", () => {
    expect(new Set(["Qajar", "Ghajar", "Kajar", "Ghadjar"].map(sound)).size).toBe(1);
    expect(sound("Tehran")).toBe(sound("Teheran"));
    expect(sound("Isfahan")).toBe(sound("Esfahan"));
    expect(sound("Mohammad")).toBe(sound("Muhammad"));
    expect(sound("Qajar")).not.toBe(sound("Pahlavi"));
  });

  it("finds Iran by Qajar, Ghajar and Kajar", () => {
    for (const q of ["Qajar", "Ghajar", "Kajar", "ghadjar", "GHAJAR dynasty".split(" ")[0]]) expect(find(q), q).toEqual(["iran"]);
  });

  it("finds a country by the spelling of its capital", () => {
    expect(find("Teheran")).toContain("iran");
    expect(find("Tehran")).toContain("iran");
    expect(find("Peking")).toEqual([]); // not a known variant of anything we hold; no false hit
    expect(find("Beijing")).toContain("china");
    expect(find("Tokyo")).toContain("japan");
    expect(find("Edo")).toContain("japan");
    expect(find("Shiraz")).toContain("iran");
    expect(find("Shiraaz")).toContain("iran");
    expect(find("Guangzhou")).toContain("china");
  });

  it("ranks real matches above sounds-alike ones and keeps short queries exact", () => {
    // "iran" matches Iran by name; Qajar-like sounds never outrank it.
    expect(find("iran")[0]).toBe("iran");
    expect(find("tur")).toEqual(["turkey"]);
    expect(find("zz")).toEqual([]);
  });

  it("does not guess for Persian script", () => {
    expect(find("قاجار")).toEqual(["iran"]);
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
