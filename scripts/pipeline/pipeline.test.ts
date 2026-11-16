import { describe, expect, it } from "vitest";
import { diffCountry, spans } from "./diff";
import type { Raw } from "./fetch";
import { clean, joinTerms, normalize, slug, type Config, type CountryFile, type Term } from "./normalize";
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
    expect(clean("عباس میرزا (شاهزاده)")).toBe("عباس میرزا");
    expect(slug("Émile Ollivier")).toBe("emile-ollivier");
  });
});

describe("joinTerms", () => {
  it("joins overlapping terms of one person but keeps back-to-back cabinets apart", () => {
    const out = joinTerms([term("a", 1900, 1905), term("a", 1903, 1908), term("a", 1908, 1910), term("b", 1905, 1906)]);
    expect(out.map((t) => [t.person, t.start, t.end])).toEqual([["a", 1900, 1908], ["b", 1905, 1906], ["a", 1908, 1910]]);
  });
  it("keeps the better title and the later exact end", () => {
    const generic = term("a", 1900, 1905, { title: { en: "Head of government", fa: "ر" }, exactEnd: "1905-02-01" });
    const ruled = term("a", 1902, 1906, { exactEnd: "1906-03-04" });
    const [out] = joinTerms([generic, ruled], (t) => (t === generic ? 2 : 0));
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

const hand: CountryFile = {
  country: { id: "x", name: { en: "X", fa: "ایکس" }, wikidata: "Q1" },
  states: [{ id: "s", name: { en: "Kingdom of X", fa: "پادشاهی ایکس" }, start: 1800, end: null, wikidata: "Q2", sources: src }],
  persons: [
    { id: "king-a", name: { en: "A", fa: "آ" }, wikidata: "Q10", sources: src },
    { id: "pm-b", name: { en: "B", fa: "ب" }, wikidata: "Q11", sources: src },
  ],
  lane: [{ country: "x", state: "s", start: 1800, end: null, kind: "state" }],
  terms: [
    term("king-a", 1800, 1850, { office: "head-of-state", title: { en: "King", fa: "شاه" } }),
    term("pm-b", 1810, 1820),
    term("king-a", 1840, 1850, { office: "leader" }),
  ],
  flags: [],
};
const row = (o: Record<string, string>) => ({ rank: "http://wikiba.se/ontology#NormalRank", ...o });
const t = (k: string, iso: string) => ({ [k]: iso, [`${k}Prec`]: "11", [`${k}Cal`]: GREGORIAN });
const raw: Raw = {
  states: [
    row({ item: `${E}Q2`, prop: "P571", value: "1800-03-01T00:00:00Z", ...t("at", "1800-03-01T00:00:00Z") }),
    row({ item: `${E}Q2`, prop: "P35", value: `${E}Q10`, ...t("start", "1800-03-01T00:00:00Z"), ...t("end", "1851-05-02T00:00:00Z") }),
    row({ item: `${E}Q2`, prop: "P6", value: `${E}Q11`, ...t("start", "1810-01-05T00:00:00Z"), ...t("end", "1820-06-07T00:00:00Z") }),
    row({ item: `${E}Q2`, prop: "P6", value: `${E}Q12`, ...t("start", "1820-06-07T00:00:00Z"), ...t("end", "1821-01-01T00:00:00Z") }),
    row({ item: `${E}Q2`, prop: "P6", value: `${E}Q13` }),
  ],
  holders: [],
  people: [row({ item: `${E}Q10`, prop: "P570", value: "1851-05-02T00:00:00Z", ...t("at", "1851-05-02T00:00:00Z") })],
  names: [
    { item: `${E}Q2`, kind: "wiki:en", name: "Kingdom of X" }, { item: `${E}Q2`, kind: "wiki:fa", name: "پادشاهی ایکس" },
    { item: `${E}Q10`, kind: "wiki:en", name: "A (king)" }, { item: `${E}Q10`, kind: "wiki:fa", name: "آ (شاه)" },
    { item: `${E}Q11`, kind: "label:en", name: "B" }, { item: `${E}Q11`, kind: "label:fa", name: "ب" },
    { item: `${E}Q12`, kind: "label:en", name: "C" },
    { item: `${E}Q13`, kind: "label:en", name: "D" }, { item: `${E}Q13`, kind: "label:fa", name: "د" },
  ],
};
const cfg: Config = { curated: hand, hogOffices: [], hogFrom: {}, hosOffices: [], excluded: new Map(), manualFa: { Q12: "ث" }, addedTerms: [] };

describe("normalize", () => {
  const out = normalize(raw, cfg);
  it("builds terms from statements, with exact dates, and keeps the curated ids", () => {
    expect(out.file.terms.map((x) => [x.person, x.office, x.start, x.end, x.exactStart])).toEqual([
      ["king-a", "head-of-state", 1800, 1851, "1800-03-01"],
      ["pm-b", "head-of-government", 1810, 1820, "1810-01-05"],
      ["c", "head-of-government", 1820, 1821, "1820-06-07"],
    ]);
    expect(out.file.persons.find((p) => p.id === "king-a")).toMatchObject({ name: { en: "A", fa: "آ" }, died: 1851 });
  });
  it("says where each Persian name came from and notes what it could not use", () => {
    expect(out.persian.get("Q10")).toEqual({ from: "fa.wikipedia", title: "آ (شاه)" });
    expect(out.persian.get("Q11")).toEqual({ from: "Wikidata label" });
    expect(out.persian.get("Q12")).toEqual({ from: "persian-names.json" });
    expect(out.notes).toContainEqual(expect.objectContaining({ kind: "statement without a start date" }));
  });
  it("leaves out a holder an exception names, for that office only", () => {
    const less = normalize(raw, { ...cfg, excluded: new Map([["Q12:head-of-government", "R3"], ["Q10:head-of-government", "R8"]]) });
    expect(less.file.terms.map((x) => x.person)).toEqual(["king-a", "pm-b"]);
  });
});

describe("diffCountry", () => {
  const out = normalize(raw, cfg);
  const { rows, counts } = diffCountry(hand, out.file, { notes: out.notes, flagCandidates: out.flagCandidates, verified: {}, first: 1800 });
  it("counts what agrees and lists what does not", () => {
    expect(counts["term: head-of-government"]).toEqual({ same: 1, differs: 0, onlyOurs: 0, onlyPipeline: 1 });
    expect(rows.filter((r) => r.entity === "term").map((r) => [r.status, r.ours, r.pipeline])).toEqual([
      ["differs", "1800–1850", "1800–1851"],
      ["only in hand data", "1840–1850", ""],
      ["only in pipeline", "", "1820–1821"],
    ]);
    expect(rows.find((r) => r.status === "only in hand data")?.note).toContain("R4");
  });
});
