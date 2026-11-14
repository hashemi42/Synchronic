import { describe, expect, it } from "vitest";
import iran from "../../../data/overrides/countries/iran.json";
import { flagFor, periodsAt, termAt } from "./query";
import { Year } from "./schema";
import { checkLane, validateCountryFile } from "./validate";

const clone = () => structuredClone(iran) as typeof iran;
const messages = (input: unknown) => validateCountryFile(input).issues.map((i) => `${i.path}: ${i.message}`);

describe("schema", () => {
  it("rejects year 0 and accepts BCE years", () => {
    expect(Year.safeParse(0).success).toBe(false);
    expect(Year.safeParse(-500).success).toBe(true);
    expect(Year.safeParse(1919.5).success).toBe(false);
  });
});

describe("Iran, 1789 – today", () => {
  it("is valid", () => {
    expect(messages(iran)).toEqual([]);
  });

  it("answers who ruled in 1919", () => {
    const { data } = validateCountryFile(iran);
    const { main, rivals } = periodsAt(data!, 1919);
    expect(main?.state).toBe("qajar-iran");
    expect(rivals).toEqual([]);
    expect(termAt(data!, "qajar-iran", 1919)?.person).toBe("ahmad-shah-qajar");
  });

  it("lists the Zand rival government in 1790", () => {
    const { data } = validateCountryFile(iran);
    expect(periodsAt(data!, 1790).rivals.map((p) => p.state)).toEqual(["zand-iran"]);
  });

  it("treats ranges as half-open at a handover year", () => {
    const { data } = validateCountryFile(iran);
    expect(periodsAt(data!, 1925).main?.state).toBe("pahlavi-iran");
    expect(termAt(data!, "pahlavi-iran", 1925)?.person).toBe("reza-shah");
  });
});

describe("validation failures", () => {
  it("fails on a missing Persian label", () => {
    const file = clone();
    // @ts-expect-error — removing a required label on purpose
    delete file.states[1].name.fa;
    expect(messages(file).some((m) => m.startsWith("states.1.name.fa"))).toBe(true);
  });

  it("fails on an unsourced record", () => {
    const file = clone();
    file.terms[0].sources = [];
    expect(messages(file).join("\n")).toMatch(/terms\.0\.sources: Every record needs at least one source/);
  });

  it("fails on a gap in the lane", () => {
    const file = clone();
    file.lane[2].start = 1930;
    expect(messages(file).join("\n")).toMatch(/Gap in lane from 1925 to 1930/);
  });

  it("fails on an unmarked overlap, but allows a rival", () => {
    const file = clone();
    file.lane[1].kind = "state";
    expect(messages(file).join("\n")).toMatch(/Overlap in lane/);
  });

  it("fails when the lane does not reach today", () => {
    const file = clone();
    file.lane[3].end = 2000;
    file.states[3].end = 2000;
    file.terms = file.terms.filter((t) => t.state !== "islamic-republic-of-iran");
    expect(messages(file).join("\n")).toMatch(/must run to today/);
  });

  it("fails on unknown references", () => {
    const file = clone();
    file.terms[0].person = "nobody";
    expect(messages(file).join("\n")).toMatch(/Unknown person "nobody"/);
  });

  it("requires a note on no-state periods", () => {
    const file = clone() as unknown as { lane: Record<string, unknown>[] };
    file.lane[0] = { ...file.lane[0], kind: "no-state", state: null };
    expect(messages(file).join("\n")).toMatch(/no-state periods need a short description/);
  });
});

describe("flags", () => {
  it("fails when two flags of one state overlap", () => {
    const file = clone();
    file.flags[2].start = 1930;
    expect(messages(file).join("\n")).toMatch(/Overlaps flags\[1\] of "pahlavi-iran"/);
  });

  it("picks the flag at the cursor, or the period's last flag", () => {
    const { data } = validateCountryFile(iran);
    const pahlavi = data!.lane.find((p) => p.state === "pahlavi-iran")!;
    expect(flagFor(data!, pahlavi, 1940)?.file).toBe("State flag of Iran (1933–1964).svg");
    expect(flagFor(data!, pahlavi, 1800)?.file).toBe("State flag of Iran (1964–1980).svg");
    const qajar = data!.lane.find((p) => p.state === "qajar-iran")!;
    expect(flagFor(data!, qajar, 1850)).toBeNull();
  });
});

describe("checkLane", () => {
  it("accepts an empty rival-only edge case without crashing", () => {
    expect(checkLane([])).toEqual([]);
  });
});
