import { describe, expect, it, vi } from "vitest";
import { buildLaneModel, governmentAt, othersAt, reignAt, rulersDuring, sameTerm, wholeOf, type Reign } from "@/components/timeline/model";
import { buildSearchIndex, searchCountries } from "../search";
import { getAllCountryFiles, getCountryFile, getMergedFile } from "./load";
import { flagFor, periodsAt } from "./query";
import { resolveRuledBy } from "./resolve";
import type { CountryFile, OfficeTerm } from "./schema";
import { summarize } from "./summary";
import { checkAcrossFiles, validateCountryFile } from "./validate";

const src = [{ title: "Test", url: "https://example.org" }];
const name = (en: string) => ({ en, fa: en });

/** A small country, ruled by the Ottomans until 1830; its first own ruler shares an id with a sultan. */
const raw = () => ({
  country: { id: "testland", name: name("Testland"), wikidata: "Q1", sources: src },
  states: [{ id: "kingdom-of-testland", name: name("Kingdom of Testland"), start: 1830, end: null as number | null, wikidata: "Q2", sources: src }],
  persons: [{ id: "mahmud-ii", name: name("Another Mahmud"), wikidata: "Q3", sources: src }],
  lane: [
    {
      country: "testland",
      state: null as string | null,
      ruler: { country: "turkey", state: "ottoman-empire" } as { country: string; state: string } | undefined,
      kind: "ruled-by",
      label: name("Ottoman Testland") as { en: string; fa: string } | undefined,
      start: 1789,
      end: 1830 as number | null,
      sources: src,
    },
    { country: "testland", state: "kingdom-of-testland", kind: "state", start: 1830, end: null, sources: src },
  ],
  terms: [{ person: "mahmud-ii", state: "kingdom-of-testland", office: "head-of-state", title: name("King"), start: 1830, end: 1850, sources: src }],
});
const valid = (input: unknown): CountryFile => {
  const result = validateCountryFile(input);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.data;
};
const messages = (edit: (f: ReturnType<typeof raw>) => void) => {
  const f = raw();
  edit(f);
  return validateCountryFile(f).issues.map((i) => i.message).join("\n");
};
const turkey = getMergedFile("turkey");
const lookup = (id: string) => (id === "turkey" ? turkey : undefined);

describe("ruled-by periods in one file", () => {
  it("need a ruler, a label and no state of their own", () => {
    expect(validateCountryFile(raw()).issues).toEqual([]);
    expect(messages((f) => (f.lane[0].ruler = undefined))).toMatch(/`ruler` is required/);
    expect(messages((f) => (f.lane[0].label = undefined))).toMatch(/need their own `label`/);
    expect(messages((f) => (f.lane[0].state = "kingdom-of-testland"))).toMatch(/must be null for no-state and ruled-by/);
    expect(messages((f) => (f.lane[1].ruler = { country: "turkey", state: "ottoman-empire" }))).toMatch(/allowed for no other kind/);
  });

  it("are part of the main sequence, so gaps and overlaps still count", () => {
    expect(messages((f) => (f.lane[0].end = 1820))).toMatch(/Gap in lane from 1820 to 1830/);
    expect(messages((f) => (f.lane[0].end = 1840))).toMatch(/Overlap in lane/);
  });
});

describe("checks across files", () => {
  const across = (edit: (f: ReturnType<typeof raw>) => void = () => {}) => {
    const f = raw();
    edit(f);
    return checkAcrossFiles([turkey, valid(f)]).map((i) => i.message).join("\n");
  };

  it("pass for the data and for a sound ruled-by period", () => {
    expect(checkAcrossFiles(getAllCountryFiles().map((f) => getMergedFile(f.country.id)))).toEqual([]);
    expect(across()).toBe("");
  });

  it("reject a ruler that does not exist or is in the same file", () => {
    expect(across((f) => (f.lane[0].ruler = { country: "atlantis", state: "ottoman-empire" }))).toMatch(/Unknown country "atlantis"/);
    expect(across((f) => (f.lane[0].ruler = { country: "turkey", state: "atlantis" }))).toMatch(/Unknown state "atlantis"/);
    expect(across((f) => (f.lane[0].ruler = { country: "testland", state: "kingdom-of-testland" }))).toMatch(/another country/);
  });

  it("reject years in which the ruling state does not hold its own lane", () => {
    const late = across((f) => {
      f.lane[0].end = 1990;
      f.lane[1].start = 1990;
    });
    expect(late).toMatch(/does not hold the lane of "turkey" for all of 1789–1990/);
  });

  it("reject a ruler that only stands beside its own country's lane", () => {
    const germany = getMergedFile("germany");
    const f = raw();
    f.lane[0] = { ...f.lane[0], start: 1949, end: 1990, ruler: { country: "germany", state: "east-germany" } };
    f.lane[1].start = f.states[0].start = f.terms[0].start = 1990;
    f.terms[0].end = 2000;
    expect(checkAcrossFiles([germany, valid(f)]).map((i) => i.message).join()).toMatch(/"east-germany" does not hold the lane of "germany"/);
    f.lane[0].ruler = { country: "germany", state: "federal-republic-of-germany" };
    expect(checkAcrossFiles([germany, valid(f)])).toEqual([]);
  });

  it("reject a country id used in two files", () => {
    expect(checkAcrossFiles([turkey, valid(raw()), turkey]).map((i) => i.message)).toEqual(['Country id "turkey" is used in two files']);
  });

  it("reject a state id used in two files", () => {
    const f = raw();
    f.states[0].id = f.lane[1].state = f.terms[0].state = "ottoman-empire";
    expect(checkAcrossFiles([turkey, valid(f)]).map((i) => i.message).join()).toMatch(/also used in "turkey"/);
  });
});

describe("resolveRuledBy", () => {
  const file = resolveRuledBy(valid(raw()), lookup);

  it("reads the ruling state, its rulers and its flag from the other file", () => {
    const model = buildLaneModel(file);
    expect(periodsAt(file, 1800).main).toMatchObject({ kind: "ruled-by", state: "ottoman-empire", label: name("Ottoman Testland") });
    expect(model.persons.get(reignAt(model, 1800)!.person)?.name.en).toBe("Selim III");
    // The Ottoman flag's records reach this lane, or the record that none is documented.
    expect(file.flags.length + file.noFlag.length).toBeGreaterThan(0);
    expect(flagFor(file, file.lane[0], 1800)?.state ?? "ottoman-empire").toBe("ottoman-empire");
  });

  it("takes only the years of the period", () => {
    const ottoman = file.terms.filter((t) => t.state === "ottoman-empire");
    expect(ottoman.length).toBeGreaterThan(5);
    expect(ottoman.every((t) => t.start < 1830)).toBe(true);
    expect(ottoman.length).toBeLessThan(turkey.terms.filter((t) => t.state === "ottoman-empire").length);
  });

  /** The same country with its ruled-by years moved, and the rulers they bring. */
  const during = (start: number, end: number, source = turkey) => {
    const f = raw();
    Object.assign(f.lane[0], { start, end });
    f.lane[1].start = f.states[0].start = f.terms[0].start = end;
    f.terms[0].end = end + 1;
    return resolveRuledBy(valid(f), () => source);
  };
  const sultans = (f: CountryFile) => f.terms.filter((t) => t.state === "ottoman-empire" && t.office === "head-of-state").map((t) => t.person);

  it("takes no ruler, flag or flag gap that only touches the period (ranges are half-open)", () => {
    // Abdul Hamid I ended in 1789, the period's first year; Abdulmejid I began in 1839, the year it ends.
    expect(sultans(during(1789, 1839))).toEqual(["selim-iii", "mustafa-iv", "turkey-mahmud-ii"]);
    expect(buildLaneModel(during(1789, 1839)).boundaries).toEqual([1789, 1807, 1808, 1839]);
    // The Ottoman flag is documented from 1844, and recorded as not documented until then.
    expect(during(1800, 1844).flags).toEqual([]);
    expect(during(1844, 1870).noFlag).toEqual([]);
    expect(during(1844, 1870).flags.length).toBeGreaterThan(0);
  });

  it("keeps a term within one year of the period, its first year included", () => {
    expect(sultans(during(1870, 1880))).toEqual(["abdulaziz", "murad-v", "abdul-hamid-ii"]);
    expect(sultans(during(1876, 1880))).toEqual(["murad-v", "abdul-hamid-ii"]);
    expect(sultans(during(1870, 1876))).toEqual(["abdulaziz"]);
  });

  it("is not led by a leader who came only in the year the period ends", () => {
    const later = structuredClone(turkey);
    later.terms.push({ ...later.terms.find((t) => t.person === "mahmud-ii")!, office: "leader", start: 1830, end: 1839 });
    expect(reignAt(buildLaneModel(during(1789, 1830, later)), 1800)?.person).toBe("selim-iii");
  });

  it("draws a ruler only to the end of the period but keeps the true years to write", () => {
    const sultan = reignAt(buildLaneModel(file), 1820)!;
    expect([sultan.start, sultan.end]).toEqual([1808, 1830]);
    expect(wholeOf(sultan)).toEqual({ start: 1808, end: 1839 });
    expect(reignAt(buildLaneModel(turkey), 1820)!.whole).toBeUndefined();
  });

  it("keeps two people with the same id apart", () => {
    const model = buildLaneModel(file);
    expect(model.persons.get(reignAt(model, 1820)!.person)?.wikidata).toBe(turkey.persons.find((p) => p.id === "mahmud-ii")!.wikidata);
    expect(model.persons.get(reignAt(model, 1840)!.person)?.name.en).toBe("Another Mahmud");
  });

  it("is found by the period's label and the ruling state's name, not by the ruler's capital", () => {
    const f = raw();
    f.lane[0].label = { en: "Ottoman Testland", fa: "آزمون‌لند عثمانی" };
    const index = buildSearchIndex([summarize(resolveRuledBy(valid(f), lookup), 2026), summarize(turkey, 2026)]);
    for (const q of ["ottoman testland", "آزمون‌لند عثمانی"]) expect(searchCountries(index, q), q).toEqual(["testland"]);
    expect(searchCountries(index, "ottoman empire")).toEqual(["testland", "turkey"]);
    expect(searchCountries(index, "constantinople")).toEqual(["turkey"]);
    // The label of any other kind is still not searched.
    const china = getMergedFile("china");
    expect(china.lane.some((p) => p.kind === "rival" && p.label?.en === "Japanese puppet state")).toBe(true);
    expect(summarize(china, 2026).stateNames).not.toContain("Japanese puppet state");
  });

  it("leaves the other file, and files without such periods, alone", () => {
    expect(getMergedFile("turkey")).toEqual(turkey);
    expect(resolveRuledBy(turkey, lookup)).toBe(turkey);
  });
});

/** Invented countries, for what no real lane shows yet. A term is [person, state, office, start, end]. */
type Term = [string, string, OfficeTerm["office"], number, number | null];
const country = (id: string, lane: { state: string | null; start: number; end: number | null; kind?: string; [k: string]: unknown }[], terms: Term[]) => {
  const own = [...new Set(lane.flatMap((p) => (p.state ? [p.state] : [])))];
  return valid({
    country: { id, name: name(id), wikidata: "Q9", sources: src },
    states: own.map((s) => ({ id: s, name: name(s), start: lane.find((p) => p.state === s)!.start, end: lane.findLast((p) => p.state === s)!.end, wikidata: "Q9", sources: src })),
    persons: [...new Set(terms.map(([person]) => person))].map((person) => ({ id: person, name: name(person), wikidata: "Q9", sources: src })),
    lane: lane.map((p) => ({ country: id, kind: "state", sources: src, ...p })),
    terms: terms.map(([person, state, office, start, end]) => ({ person, state, office, title: name(office), start, end, sources: src })),
  });
};
const ruledBy = (ruler: string, state: string, start: number, end: number) => ({ state: null, kind: "ruled-by", ruler: { country: ruler, state }, label: name(`${start}`), start, end });

describe("officials where a ruled-by period meets another state", () => {
  const empire = (id: string) =>
    country(id, [{ state: `${id}-empire`, start: 1700, end: null }], [
      [`${id}-pm-1`, `${id}-empire`, "head-of-government", 1795, 1810],
      [`${id}-pm-2`, `${id}-empire`, "head-of-government", 1810, 1825],
      [`${id}-other-1`, `${id}-empire`, "other", 1795, 1810],
      [`${id}-other-2`, `${id}-empire`, "other", 1810, 1825],
      [`${id}-other-3`, `${id}-empire`, "other", 1805, 1820],
    ]);
  const rulers: Record<string, CountryFile> = { red: empire("red"), blue: empire("blue") };
  /** An own state to 1800, the years between, and an own state from 1820, each with its officials. */
  const model = (...between: Parameters<typeof country>[1]) =>
    buildLaneModel(
      resolveRuledBy(
        country("testland", [{ state: "old-state", start: 1789, end: 1800 }, ...between, { state: "new-state", start: 1820, end: null }], [
          ["old-pm", "old-state", "head-of-government", 1790, 1800],
          ["old-other", "old-state", "other", 1790, 1800],
          ["new-pm-brief", "new-state", "head-of-government", 1820, 1820],
          ["new-pm", "new-state", "head-of-government", 1820, 1830],
          ["new-other", "new-state", "other", 1820, 1830],
        ]),
        (id) => rulers[id],
      ),
    );
  const at = (m: ReturnType<typeof model>, year: number) => {
    const { current, others } = governmentAt(m, year);
    return { pm: current?.person, also: others.map((r) => r.person), other: othersAt(m, year).map((r) => r.person) };
  };

  it("the ruler's officials are not named in the first year of the land's own state, whether they left that year or stayed on at home", () => {
    // red-pm-2 and red-other-2 stayed on in their own country; red-other-3 left office in 1820.
    expect(at(model(ruledBy("red", "red-empire", 1800, 1820)), 1820)).toEqual({ pm: "new-pm", also: ["new-pm-brief"], other: ["new-other"] });
  });

  it("the land's own officials are not named in the first year of the ruler", () => {
    expect(at(model(ruledBy("red", "red-empire", 1800, 1820)), 1800)).toEqual({ pm: "red-pm-1", also: [], other: ["red-other-1"] });
  });

  it("nor is one ruler's official named under the next ruler, or where no state followed", () => {
    expect(at(model(ruledBy("red", "red-empire", 1800, 1810), ruledBy("blue", "blue-empire", 1810, 1820)), 1810)).toEqual({
      pm: "blue-pm-2",
      also: [],
      other: ["blue-other-2", "blue-other-3"],
    });
    const gap = { state: null, kind: "no-state", start: 1810, end: 1820, note: name("None") };
    expect(at(model(ruledBy("red", "red-empire", 1800, 1810), gap), 1810)).toEqual({ pm: undefined, also: [], other: [] });
  });

  it("but two periods under the same ruling state read as that state's own lane does", () => {
    const split = at(model(ruledBy("red", "red-empire", 1800, 1810), ruledBy("red", "red-empire", 1810, 1820)), 1810);
    expect(split).toEqual({ pm: "red-pm-2", also: ["red-pm-1"], other: ["red-other-1", "red-other-3", "red-other-2"] });
    expect(split).toEqual(at(buildLaneModel(rulers.red), 1810));
  });

  it("and between two states of one country nothing changes", () => {
    const between = model({ state: "middle-state", start: 1800, end: 1820 });
    expect(at(between, 1800)).toEqual({ pm: undefined, also: ["old-pm"], other: ["old-other"] });
    expect(governmentAt(buildLaneModel(getCountryFile("germany")), 1945).others.map((r) => r.person)).toContain("adolf-hitler");
  });
});

describe("the rulers during a reign", () => {
  it("name one who ruled the land in two separate periods once, with their whole years", () => {
    const file = resolveRuledBy(
      country("testland", [
        ruledBy("turkey", "ottoman-empire", 1789, 1821),
        { state: "free-state", start: 1821, end: 1830 },
        ruledBy("turkey", "ottoman-empire", 1830, 1876),
        { state: "new-state", start: 1876, end: null },
      ], [["free-king", "free-state", "head-of-state", 1821, 1830]]),
      lookup,
    );
    const model = buildLaneModel(file);
    expect(model.reigns.filter((r) => r.person === "mahmud-ii").map((r) => [r.start, r.end])).toEqual([[1808, 1821], [1830, 1839]]);
    const rows = rulersDuring(model, { start: 1808, end: 1839 });
    expect(rows.map((r) => [r.person, wholeOf(r).start, wholeOf(r).end])).toEqual([["mahmud-ii", 1808, 1839], ["free-king", 1821, 1830]]);
  });

  it("still name a person twice under two titles", () => {
    const rows = rulersDuring(buildLaneModel(getCountryFile("france")), { start: 1848, end: 1870 });
    expect(rows.filter((r) => r.person === "napoleon-iii").map((r) => r.title.en)).toEqual(["President", "Emperor"]);
  });
});

describe("a term split by a break in the lane", () => {
  const red = country("red", [{ state: "red-empire", start: 1900, end: null }], [["red-king", "red-empire", "head-of-state", 1920, 1960]]);
  const lane = (...periods: Parameters<typeof country>[1]) => (...terms: Term[]) => buildLaneModel(resolveRuledBy(country("testland", periods, terms), () => red));
  const occupied = { state: "occupied-land", kind: "occupation", start: 1941, end: 1944 };
  const none = { state: null, kind: "no-state", note: name("None"), start: 1941, end: 1944 };
  const republic = { state: "republic", start: 1950, end: null };
  /** A kingdom of 1930–1950 that loses its lane in 1941–1944. */
  const kingdom = (gap: Parameters<typeof country>[1][number]) => lane({ state: "kingdom", start: 1930, end: 1941 }, gap, { state: "kingdom", start: 1944, end: 1950 }, republic);
  const king = (start: number, end: number | null, office: Term[2] = "head-of-state", person = "king"): Term => [person, "kingdom", office, start, end];
  /** The years drawn, and the years written where they are others. */
  const rows = (segments: Reign[], person = "king") =>
    segments.filter((r) => r.person === person).map((r) => `${r.start}–${r.end}${r.whole ? ` as ${r.whole.start}–${r.whole.end}` : ""}`);

  it.each([
    ["an occupation", occupied, undefined],
    ["no state", none, undefined],
    ["a ruled-by period", ruledBy("red", "red-empire", 1941, 1944), "red-king"],
  ])("is drawn on both sides of %s and written with its own years", (_, gap, between) => {
    const m = kingdom(gap)(king(1935, 1947), king(1938, 1946, "head-of-government", "pm"), king(1931, 1948, "other", "speaker"));
    expect(rows(m.reigns)).toEqual(["1935–1941 as 1935–1947", "1944–1947 as 1935–1947"]);
    expect(rows(m.heads)).toEqual(rows(m.reigns));
    expect(rows(m.governments, "pm")).toEqual(["1938–1941 as 1938–1946", "1944–1946 as 1938–1946"]);
    expect(rows(m.others, "speaker")).toEqual(["1931–1941 as 1931–1948", "1944–1948 as 1931–1948"]);
    expect([1940, 1942, 1944].map((y) => reignAt(m, y)?.person)).toEqual(["king", between, "king"]);
    expect(m.boundaries).toEqual(between ? [1935, 1941, 1944] : [1935, 1944]);
  });

  it("is one ruler in the list of a whole reign", () => {
    const m = kingdom(ruledBy("red", "red-empire", 1941, 1944))(king(1930, 1935, "head-of-state", "old-king"), king(1935, 1947), king(1947, 1950, "head-of-state", "new-king"));
    const during = (start: number, end: number) => rulersDuring(m, { start, end }).map((r) => [r.person, wholeOf(r).start, wholeOf(r).end]);
    expect(during(1935, 1947)).toEqual([["king", 1935, 1947], ["red-king", 1920, 1960]]);
    expect(during(1930, 1950).map(([person]) => person)).toEqual(["old-king", "king", "red-king", "new-king"]);
    // Where the king did not hold the land he is not listed.
    expect(during(1941, 1944)).toEqual([["red-king", 1920, 1960]]);
  });

  it("is written whole while it goes on, across every break and in the lane's first period", () => {
    // The lane begins in 1930, its first state earlier.
    const older = lane({ state: "kingdom", kind: "rival", start: 1910, end: 1915 }, { state: "kingdom", start: 1930, end: 1941 }, occupied, { state: "kingdom", start: 1944, end: 1950 }, republic);
    expect(rows(older(king(1920, 1947)).reigns)).toEqual(["1920–1941 as 1920–1947", "1944–1947 as 1920–1947"]);
    const open = lane({ state: "kingdom", start: 1930, end: 1941 }, occupied, { state: "kingdom", start: 1944, end: null });
    expect(rows(open(king(1935, null)).reigns)).toEqual(["1935–1941 as 1935–null", "1944–null as 1935–null"]);
    const twice = lane({ state: "kingdom", start: 1930, end: 1936 }, { ...none, start: 1936, end: 1938 }, { state: "kingdom", start: 1938, end: 1941 }, occupied, { state: "kingdom", start: 1944, end: 1950 }, republic);
    expect(rows(twice(king(1935, 1947)).reigns)).toEqual(["1935–1936 as 1935–1947", "1938–1941 as 1935–1947", "1944–1947 as 1935–1947"]);
  });

  it("is one reign with the terms it is joined to at a change of state", () => {
    const before = { state: "old-kingdom", start: 1920, end: 1930 };
    const after = [{ state: "new-kingdom", start: 1950, end: 1960 }, { ...none, start: 1960, end: 1962 }, { state: "new-kingdom", start: 1962, end: null }];
    const m = lane(before, { state: "kingdom", start: 1930, end: 1941 }, occupied, { state: "kingdom", start: 1944, end: 1950 }, ...after);
    const old: Term = ["king", "old-kingdom", "head-of-state", 1925, 1930];
    const next = (end: number): Term => ["king", "new-kingdom", "head-of-state", 1950, end];
    expect(rows(m(old, king(1930, 1947)).reigns)).toEqual(["1925–1941 as 1925–1947", "1944–1947 as 1925–1947"]);
    expect(rows(m(king(1935, 1950), next(1955)).reigns)).toEqual(["1935–1941 as 1935–1955", "1944–1955 as 1935–1955"]);
    expect(rows(m(old, king(1930, 1950), next(1970)).reigns)).toEqual(["1925–1941 as 1925–1970", "1944–1960 as 1925–1970", "1962–1970 as 1925–1970"]);
  });

  it("is not one that only touches the break: what is drawn is what is written", () => {
    const m = kingdom(occupied);
    for (const [start, end, drawn] of [
      [1935, 1941, "1935–1941"], // ends as the break begins
      [1944, 1947, "1944–1947"], // begins as the break ends
      [1935, 1943, "1935–1941"], // ends within the break
      [1935, 1944, "1935–1941"], // ends as the kingdom returns
      [1942, 1947, "1944–1947"], // begins within the break
      [1941, 1947, "1944–1947"], // begins as the break begins
    ] as const) expect(rows(m(king(start, end)).reigns), `${start}–${end}`).toEqual([drawn]);
    expect(m(king(1941, 1944)).reigns).toEqual([]);
    // Two terms of one person, one on each side, stay two reigns.
    const two = m(king(1935, 1941), king(1944, 1947));
    expect(rows(two.reigns)).toEqual(["1935–1941", "1944–1947"]);
    expect(rulersDuring(two, { start: 1930, end: 1950 })).toHaveLength(2);
  });

  it("is not one cut for another reason", () => {
    // Begun before the state held the lane (Atatürk in Ankara), and not ended when it lost it for good.
    const rival = { state: "kingdom", kind: "rival" };
    const m = lane({ ...rival, start: 1920, end: 1930 }, { state: "old-kingdom", start: 1920, end: 1930 }, { state: "kingdom", start: 1930, end: 1950 }, republic, { ...rival, start: 1950, end: 1960 });
    expect(rows(m(king(1925, 1935)).reigns)).toEqual(["1930–1935"]);
    expect(rows(m(king(1945, 1955)).reigns)).toEqual(["1945–1950"]);
    expect(buildLaneModel(turkey).reigns.filter((r) => r.person === "mustafa-kemal-ataturk").map((r) => [r.start, r.end, r.whole])).toEqual([[1922, 1923, undefined], [1923, 1938, undefined]]);
    // Two periods of one state that meet are no break; nor is the start of the data.
    const meeting = lane({ ...rival, start: 1910, end: 1915 }, { state: "kingdom", start: 1930, end: 1941 }, { state: "kingdom", start: 1941, end: 1950 }, republic);
    expect(rows(meeting(king(1920, 1947)).reigns)).toEqual(["1920–1947"]);
    // A person who ruled in the break too, under the same title, is drawn as one reign.
    const union = kingdom(occupied)(king(1935, 1947), ["king", "occupied-land", "head-of-state", 1941, 1944]);
    expect(rows(union.reigns)).toEqual(["1935–1947"]);
  });

  it("has its own years also where the state held the lane for only some of them", () => {
    const m = lane({ state: "kingdom", kind: "rival", start: 1920, end: 1930 }, { state: "old-kingdom", start: 1920, end: 1930 }, { state: "kingdom", start: 1930, end: 1941 }, occupied, { state: "kingdom", start: 1944, end: 1950 }, republic);
    expect(rows(m(king(1925, 1947)).reigns)).toEqual(["1930–1941 as 1925–1947", "1944–1947 as 1925–1947"]);
  });

  it("is both offices in one row only when both have the same years", () => {
    const m = kingdom(occupied)(king(1935, 1947), king(1935, 1947, "head-of-government"));
    const as = (title: string) => (r: Reign | null) => r && { ...r, title: name(title) };
    for (const year of [1940, 1945]) expect(sameTerm(as("x")(reignAt(m, year)), as("x")(governmentAt(m, year).current)), String(year)).toBe(true);
    // Drawn alike to 1941, but the head of government left office then and the head of state did not.
    const left = kingdom(occupied)(king(1935, 1947), king(1935, 1941, "head-of-government"));
    expect(sameTerm(as("x")(reignAt(left, 1940)), as("x")(governmentAt(left, 1940).current))).toBe(false);
  });

  it("is anchored and shared with its own years", async () => {
    const file = kingdom(occupied)(king(1935, 1947)).file;
    vi.doMock("./load", () => ({ getAllCountryFiles: () => [file] }));
    const { describeComparison } = await import("../share");
    const title = (locale: "en" | "fa", year: number) => describeComparison({ year, lanes: ["testland"], anchor: "king", view: null }, locale)!.title;
    for (const year of [1938, 1942, 1945]) {
      expect(title("en", year)).toBe("testland during the reign of king (1935–1947)");
      expect(title("fa", year)).toBe("testland در دوران king (۱۳۱۴–۱۳۲۶)");
    }
    vi.doUnmock("./load");
  });
});

describe("parallel states", () => {
  it("stand beside the lane like rivals, and East Germany is one (D8)", () => {
    const germany = getMergedFile("germany");
    const { main, beside } = periodsAt(germany, 1970);
    expect(main?.state).toBe("federal-republic-of-germany");
    expect(beside.map((p) => [p.state, p.kind])).toEqual([["east-germany", "parallel"]]);
    expect(buildLaneModel(germany).mainline.some((p) => p.state === "east-germany")).toBe(false);
  });
});
