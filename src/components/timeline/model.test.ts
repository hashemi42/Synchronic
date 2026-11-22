import { describe, expect, it } from "vitest";
import china from "../../../data/merged/china.json";
import france from "../../../data/merged/france.json";
import india from "../../../data/merged/india.json";
import germany from "../../../data/merged/germany.json";
import russia from "../../../data/merged/russia.json";
import turkey from "../../../data/merged/turkey.json";
import uk from "../../../data/merged/uk.json";
import { validateCountryFile } from "@/lib/data/validate";
import { getCountryFile } from "@/lib/data/load";
import { buildLaneModel, governmentAt, headAt, othersAt, overlaps, reignAt, sameTerm } from "./model";

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

describe("formal heads of state and other offices (R4, R8)", () => {
  const modelOf = (id: string) => buildLaneModel(getCountryFile(id)!);

  it("keeps the party leader on the ruler row and the formal head of state apart", () => {
    const ussr = modelOf("russia");
    expect(reignAt(ussr, 1970)?.person).toBe("leonid-brezhnev");
    expect(headAt(ussr, 1970)?.person).toBe("nikolai-podgorny");
    const china = modelOf("china");
    expect(headAt(china, 1977)?.person).toBe("soong-ching-ling");
    expect(headAt(china, 1980)?.person).toBe("ye-jianying");
  });

  it("lists other offices by year, without touching the ruler row", () => {
    const iran = modelOf("iran");
    expect(othersAt(iran, 1985).map((r) => r.person)).toEqual(["ali-khamenei"]);
    expect(othersAt(iran, 1981).map((r) => r.person)).toEqual(["abolhassan-banisadr", "mohammad-ali-rajai", "ali-khamenei"]);
    expect(othersAt(iran, 1991)).toEqual([]);
    expect(reignAt(iran, 1985)?.person).toBe("ruhollah-khomeini");
  });
});

describe("one term, two offices (#11)", () => {
  const at = (id: string, year: number) => {
    const m = buildLaneModel(getCountryFile(id)!);
    return sameTerm(reignAt(m, year), governmentAt(m, year).current);
  };

  it("joins only the same person, title and years", () => {
    for (const year of [1790, 1863, 1942, 2020]) expect(at("us", year), String(year)).toBe(true);
    expect(at("uk", 1942)).toBe(false);
    expect(at("turkey", 2020)).toBe(false); // President from 2014, head of government from 2018
  });

  it("carries a term's note to its segment", () => {
    const file = structuredClone(getCountryFile("us")!);
    file.terms.find((t) => t.office === "head-of-state")!.note = { en: "a note", fa: "یادداشت" };
    expect(buildLaneModel(file).reigns[0].notes).toEqual([{ en: "a note", fa: "یادداشت" }]);
  });
});
