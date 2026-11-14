import { describe, expect, it } from "vitest";
import china from "../../../data/overrides/countries/china.json";
import france from "../../../data/overrides/countries/france.json";
import india from "../../../data/overrides/countries/india.json";
import germany from "../../../data/overrides/countries/germany.json";
import russia from "../../../data/overrides/countries/russia.json";
import turkey from "../../../data/overrides/countries/turkey.json";
import uk from "../../../data/overrides/countries/uk.json";
import { validateCountryFile } from "@/lib/data/validate";
import { buildLaneModel, governmentAt, overlaps, reignAt } from "./model";

const model = (input: unknown) => {
  const result = validateCountryFile(input);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return buildLaneModel(result.data);
};
const find = (m: ReturnType<typeof model>, person: string) => m.reigns.filter((r) => r.person === person);

describe("buildLaneModel", () => {
  it("joins a reign that spans a change of state", () => {
    const m = model(uk);
    expect(find(m, "george-iii")).toEqual([expect.objectContaining({ start: 1760, end: 1820 })]);
    expect(find(m, "george-v")).toEqual([expect.objectContaining({ start: 1910, end: 1936 })]);
  });

  it("keeps a reign within one year, but gives the cursor to the successor", () => {
    const m = model(uk);
    expect(find(m, "edward-viii")).toEqual([expect.objectContaining({ start: 1936, end: 1936 })]);
    expect(reignAt(m, 1936)?.person).toBe("george-vi");
    expect(m.boundaries).not.toContain(1935);
    expect(overlaps(find(m, "edward-viii")[0], { start: 1925, end: 1941 })).toBe(true);
  });

  it("answers the PRD question for 1919", () => {
    expect(reignAt(model(uk), 1919)?.person).toBe("george-v");
    expect(reignAt(model(russia), 1919)?.person).toBe("vladimir-lenin");
    expect(reignAt(model(turkey), 1919)?.person).toBe("mehmed-vi");
    expect(reignAt(model(france), 1919)?.person).toBe("raymond-poincare");
    expect(reignAt(model(germany), 1919)?.person).toBe("friedrich-ebert");
    expect(reignAt(model(china), 1919)?.person).toBe("xu-shichang");
  });

  it("prefers de facto leaders where a state has them", () => {
    expect(reignAt(model(russia), 1950)?.title.en).toBe("Soviet leader");
    expect(reignAt(model(china), 1985)?.person).toBe("deng-xiaoping");
  });

  it("does not join the same person under a different title", () => {
    const m = model(france);
    expect(find(m, "napoleon-iii").map((r) => [r.title.en, r.start, r.end])).toEqual([
      ["President", 1848, 1852],
      ["Emperor", 1852, 1870],
    ]);
  });

  it("cuts a term to the years its state held the lane", () => {
    const m = model(turkey);
    expect(find(m, "mustafa-kemal-ataturk").map((r) => [r.start, r.end])).toEqual([
      [1922, 1923],
      [1923, 1938],
    ]);
    expect(reignAt(m, 1921)?.person).toBe("mehmed-vi");
  });

  it("has no ruler where the data names none", () => {
    expect(reignAt(model(france), 1793)).toBeNull();
    expect(reignAt(model(germany), 1947)).toBeNull();
  });
});

describe("governmentAt", () => {
  const name = (m: ReturnType<typeof model>, id?: string) => (id ? m.persons.get(id)?.name.en : undefined);

  it("answers who was head of government in 1919", () => {
    const fr = model(france);
    expect(name(fr, governmentAt(fr, 1919).current?.person)).toBe("Georges Clemenceau");
    const gb = model(uk);
    expect(name(gb, governmentAt(gb, 1919).current?.person)).toBe("David Lloyd George");
  });

  it("joins a term that spans a change of state", () => {
    const m = model(india);
    const nehru = m.governments.filter((g) => m.persons.get(g.person)?.name.en === "Jawaharlal Nehru");
    expect(nehru.map((g) => [g.start, g.end])).toEqual([[1947, 1964]]);
  });

  it("lists the others who held the office that year", () => {
    const m = model(france);
    const { others } = governmentAt(m, 1920);
    expect(others.length).toBeGreaterThan(0);
  });

  it("has no head of government before the office existed", () => {
    expect(governmentAt(model(germany), 1850).current).toBeNull();
  });
});
