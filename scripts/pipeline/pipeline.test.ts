import { describe, expect, it } from "vitest";
import { gaps } from "./complete";
import { diffCountry, spans } from "./diff";
import type { Raw } from "./fetch";
import { clean, joinTerms, normalize, persianName, slug, type Config, type Curated, type Term } from "./normalize";
import { when } from "./wikidata";

const GREGORIAN = "http://www.wikidata.org/entity/Q1985727";
const JULIAN = "http://www.wikidata.org/entity/Q1985786";
const E = "http://www.wikidata.org/entity/";
const src = [{ title: "t", url: "https://example.org" }];
const term = (person: string, start: number, end: number | null, more: Partial<Term> = {}): Term => ({
  person, state: "s", office: "head-of-government", title: { en: "PM", fa: "ن" }, start, end, sources: src, ...more,
});

describe("when", () => {
  it("gives the year, and an exact date only for Gregorian dates known to the month or day", () => {
    expect(when("1925-12-15T00:00:00Z", "11", GREGORIAN)).toEqual({ year: 1925, exact: "1925-12-15" });
    expect(when("1925-12-01T00:00:00Z", "10", GREGORIAN)).toEqual({ year: 1925, exact: "1925-12" });
    expect(when("1925-01-01T00:00:00Z", "9", GREGORIAN)).toEqual({ year: 1925 });
    expect(when("1796-11-17T00:00:00Z", "11", JULIAN)).toEqual({ year: 1796 });
  });
  it("reads BCE years and refuses anything vaguer than a year", () => {
    expect(when("-0549-01-01T00:00:00Z", "9", GREGORIAN)).toEqual({ year: -549 });
    expect(when("1800-01-01T00:00:00Z", "7", GREGORIAN)).toBeNull();
    expect(when(undefined)).toBeNull();
  });
});

describe("names", () => {
  it("drops a Wikipedia disambiguator and makes kebab-case ids", () => {
    expect(clean("Abbas Mirza (prince)")).toBe("Abbas Mirza");
    expect(slug("Émile Ollivier")).toBe("emile-ollivier");
  });
  it("takes the fa.wikipedia title, keeping its zero-width non-joiner", () => {
    expect(persianName({ wikiFa: "سید علی خامنه‌ای", labelFa: "x" }, undefined)).toEqual({ value: "سید علی خامنه‌ای", from: "fa.wikipedia" });
  });
  it("passes over a title with brackets or a comma for the label, then the manual list", () => {
    expect(persianName({ wikiFa: "لئوپولد دوم، امپراتور مقدس روم", labelFa: "لئوپولد دوم" }, undefined)).toEqual({ value: "لئوپولد دوم", from: "Wikidata label" });
    expect(persianName({ wikiFa: "عباس میرزا (شاهزاده)" }, "عباس میرزا")).toEqual({ value: "عباس میرزا", from: "persian-names.json" });
    expect(persianName({}, undefined)).toEqual({ value: null, from: "none" });
  });
});

describe("joinTerms", () => {
  it("joins overlapping terms of one person but keeps back-to-back cabinets apart", () => {
    const out = joinTerms([term("a", 1900, 1905), term("a", 1903, 1908), term("a", 1908, 1910), term("b", 1905, 1906)]);
    expect(out.map((t) => [t.person, t.start, t.end])).toEqual([["a", 1900, 1908], ["a", 1908, 1910], ["b", 1905, 1906]]);
  });
  it("keeps the better title and the later exact end", () => {
    const generic = term("a", 1900, 1905, { title: { en: "Head of government", fa: "ر" }, exactEnd: "1905-02-01" });
    const ruled = term("a", 1902, 1906, { exactEnd: "1906-03-04" });
    const [out] = joinTerms([generic, ruled], (t) => (t === generic ? 1 : 0));
    expect(out).toMatchObject({ start: 1900, end: 1906, exactEnd: "1906-03-04", title: { en: "PM" } });
  });
});

describe("spans", () => {
  it("counts cabinets in a row, across states, as one unbroken time in office", () => {
    expect(spans([term("a", 1912, 1914), term("a", 1914, 1917, { state: "t" }), term("a", 1920, 1921)])).toMatchObject([
      { start: 1912, end: 1917, states: ["s", "t"] },
      { start: 1920, end: 1921 },
    ]);
  });
});

// A kingdom "s" from 1700, in the lane from 1800, with a rival court "r" in 1800–1810.
const curated: Curated = {
  country: { id: "x", name: { en: "X", fa: "ایکس" }, wikidata: "Q1" },
  states: [
    { id: "s", name: { en: "Kingdom of X", fa: "پادشاهی ایکس" }, start: 1700, end: null, wikidata: "Q2", capital: { en: "C", fa: "س" }, system: { en: "Monarchy", fa: "پادشاهی" }, sources: src },
    { id: "r", name: { en: "Rival court", fa: "دربار رقیب" }, start: 1790, end: 1810, wikidata: "Q3", sources: src },
  ],
  lane: [
    { country: "x", state: "s", start: 1800, end: null, kind: "state" },
    { country: "x", state: "r", start: 1800, end: 1810, kind: "rival" },
  ],
  offices: [
    { office: "Q100", title: { en: "King", fa: "شاه" }, family: ["Q500"], until: 1900 },
    { office: "Q100", title: { en: "Rival king", fa: "شاه رقیب" }, family: ["Q501"], state: "r" },
  ],
  persons: [
    { id: "king-a", wikidata: "Q10" },
    { id: "queen-b", wikidata: "Q11", name: { fa: "ب" }, note: "kept" },
    { id: "leader-l", wikidata: "Q15" },
  ],
  terms: [term("leader-l", 1950, 1960, { office: "leader", title: { en: "Leader", fa: "رهبر" } })],
  titles: [{ person: "queen-b", office: "head-of-state", state: "s", title: { en: "Queen", fa: "ملکه" } }],
  exclude: [{ wikidata: "Q14", office: "head-of-state", reason: "a claimant who never reigned" }],
  flags: [{ state: "s", file: "Flag of X.svg", start: 1800, end: null, certainty: "documented", license: "old", attribution: "Someone", withheld: false, sources: src }],
};
const NORMAL = "http://wikiba.se/ontology#NormalRank";
const t = (k: string, iso: string) => ({ [k]: `${iso}T00:00:00Z`, [`${k}Prec`]: "11", [`${k}Cal`]: GREGORIAN });
const holder = (person: string, start: string, end?: string, more: Record<string, string> = {}) => ({
  office: `${E}Q100`, person: `${E}${person}`, rank: NORMAL, ...t("start", start), ...(end ? t("end", end) : {}), ...more,
});
const family = (person: string, f: string) => ({ item: `${E}${person}`, prop: "P53", value: `${E}${f}`, rank: NORMAL });
const raw: Raw = {
  states: [],
  holders: [
    holder("Q10", "1780-01-01", "1850-05-02"),
    holder("Q11", "1850-05-02", "1910-01-01"),
    holder("Q12", "1850-05-02", "1850-06-01", { nature: `${E}Q900` }),
    holder("Q13", "1800-02-01", "1810-03-01"),
    holder("Q14", "1860-01-01", "1870-01-01"),
    holder("Q16", "1700-01-01", "1750-01-01"),
    holder("Q17", "1820-01-01", "1830-01-01"),
  ],
  people: [
    family("Q10", "Q500"), family("Q11", "Q500"), family("Q12", "Q500"), family("Q13", "Q501"), family("Q14", "Q500"), family("Q16", "Q500"), family("Q17", "Q777"),
    { item: `${E}Q10`, prop: "P570", value: "1850-05-02T00:00:00Z", rank: NORMAL, ...t("at", "1850-05-02") },
  ],
  names: [
    { item: `${E}Q10`, kind: "wiki:en", name: "A (king)" }, { item: `${E}Q10`, kind: "wiki:fa", name: "آ" },
    { item: `${E}Q11`, kind: "label:en", name: "B" }, { item: `${E}Q11`, kind: "wiki:fa", name: "ب دوم" },
    { item: `${E}Q13`, kind: "label:en", name: "R" }, { item: `${E}Q13`, kind: "label:fa", name: "ر" },
    { item: `${E}Q15`, kind: "label:en", name: "L" },
    { item: `${E}Q900`, kind: "label:en", name: "acting" },
  ],
  flags: [{ file: "Flag of X.svg", sha1: "a".repeat(40), mime: "image/svg+xml", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", attribution: "Own work" }],
  flagsRetrieved: "2026-11-16",
};
const cfg: Config = { curated, hogOffices: [], hogFrom: {}, manualFa: { Q15: "ل" }, addedTerms: [] };

describe("normalize", () => {
  const out = normalize(raw, cfg);
  const rows = out.file.terms.map((x) => [x.person, x.state, x.office, x.title.en, x.start, x.end]);
  it("turns holders of a curated office into terms, placed and titled by the office's rule", () => {
    // A term that began before the lane keeps its true start; the office stops counting in 1900.
    expect(rows).toContainEqual(["king-a", "s", "head-of-state", "King", 1780, 1850]);
    expect(rows).toContainEqual(["queen-b", "s", "head-of-state", "Queen", 1850, 1900]);
    expect(out.file.terms.find((x) => x.person === "king-a")).toMatchObject({ exactEnd: "1850-05-02" });
  });
  it("tells one family's holders of a shared title from another's", () => {
    expect(rows).toContainEqual(["r", "r", "head-of-state", "Rival king", 1800, 1810]);
    expect(out.file.persons.map((p) => p.wikidata)).not.toContain("Q17");
  });
  it("leaves out brief stand-ins (R3), named exclusions and holders before the lane", () => {
    expect(out.file.persons.map((p) => p.wikidata).sort()).toEqual(["Q10", "Q11", "Q13", "Q15"]);
    expect(out.notes).toContainEqual(expect.objectContaining({ kind: "R3: acting or interim for less than a year, left out" }));
  });
  it("adds curated terms and keeps curated names and ids", () => {
    expect(rows).toContainEqual(["leader-l", "s", "leader", "Leader", 1950, 1960]);
    expect(out.file.persons.find((p) => p.id === "queen-b")?.name).toEqual({ en: "B", fa: "ب" });
    expect(out.file.persons.find((p) => p.id === "king-a")).toMatchObject({ name: { en: "A", fa: "آ" }, died: 1850 });
    expect([out.persian.get("Q10"), out.persian.get("Q11"), out.persian.get("Q15")]).toEqual(["fa.wikipedia", "override", "persian-names.json"]);
    expect(out.origin).toEqual({ wikidata: 3, curated: 1 });
  });
  it("lets a curated term replace the pipeline's terms for that person and office", () => {
    const own = term("king-a", 1800, 1849, { office: "head-of-state", title: { en: "King", fa: "شاه" } });
    const patched = normalize(raw, { ...cfg, curated: { ...curated, terms: [own] } });
    expect(patched.file.terms.filter((x) => x.person === "king-a").map((x) => [x.start, x.end])).toEqual([[1800, 1849]]);
  });
  it("reads each flag's licence from Commons and keeps the curated credit", () => {
    expect(out.file.flags[0]).toMatchObject({ license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", attribution: "Someone", sha1: "a".repeat(40), retrieved: "2026-11-16" });
    const bad = normalize({ ...raw, flags: [{ ...raw.flags[0], license: "CC BY-NC 4.0" }] }, cfg);
    expect(bad.notes).toContainEqual(expect.objectContaining({ kind: "flag: licence not on the allowlist" }));
  });
});

describe("gaps", () => {
  const { file } = normalize(raw, cfg);
  it("lists the years of a state with no head of state, head of government or flag", () => {
    const open = gaps(file, 1800, 1960);
    expect(open).toContainEqual({ state: "s", need: "head of state", start: 1901, end: 1949 });
    expect(open).toContainEqual({ state: "s", need: "head of government", start: 1800, end: 1960 });
    expect(open).toContainEqual({ state: "r", need: "capital", start: 1800, end: 1809 });
    expect(open.filter((g) => g.need === "flag").map((g) => g.state)).toEqual(["r"]);
    expect(open.some((g) => g.need === "lane")).toBe(false);
  });
  it("closes a gap only by a recorded exception", () => {
    const open = gaps(file, 1800, 1960, [{ country: "x", state: "s", need: "head of government", start: 1800, end: 1960, reason: "no cabinet", source: "https://example.org" }]);
    expect(open.some((g) => g.state === "s" && g.need === "head of government")).toBe(false);
  });
});

describe("diffCountry", () => {
  const before = normalize(raw, cfg).file;
  const after = normalize(raw, { ...cfg, curated: { ...curated, exclude: [...curated.exclude, { wikidata: "Q13", office: "head-of-state", reason: "x" }], persons: curated.persons.map((p) => (p.id === "queen-b" ? { id: p.id, wikidata: p.wikidata } : p)) } }).file;
  const { rows, counts } = diffCountry(before, after, { notes: [], verified: {}, first: 1800 });
  it("counts what agrees and lists what does not", () => {
    expect(counts["term: head-of-state"]).toEqual({ same: 2, differs: 0, onlyOurs: 1, onlyPipeline: 0 });
    expect(rows.map((r) => [r.entity, r.field, r.status, r.ours, r.pipeline])).toEqual([
      ["person", "name.fa", "differs", "ب", "ب دوم"],
      ["term", "years", "only in hand data", "1800–1810", ""],
    ]);
  });
});
