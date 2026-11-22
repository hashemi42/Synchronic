import { describe, expect, it } from "vitest";
import { buildLaneModel, reignAt, wholeOf } from "@/components/timeline/model";
import { getAllCountryFiles, getMergedFile } from "./load";
import { flagFor, periodsAt } from "./query";
import { resolveRuledBy } from "./resolve";
import type { CountryFile } from "./schema";
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

  it("is found by the ruling state's name, not by its capital", () => {
    const { stateNames } = summarize(file, 2026);
    expect(stateNames).toContain("Ottoman Empire");
    expect(turkey.states.find((s) => s.id === "ottoman-empire")?.capital?.en).toBeTruthy();
    expect(stateNames).not.toContain(turkey.states.find((s) => s.id === "ottoman-empire")!.capital!.en);
  });

  it("leaves the other file, and files without such periods, alone", () => {
    expect(getMergedFile("turkey")).toEqual(turkey);
    expect(resolveRuledBy(turkey, lookup)).toBe(turkey);
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
