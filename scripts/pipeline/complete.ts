/**
 * Is a country's lane complete for a range of years? (PRD §2 metrics; data phase proposal, D10.)
 *
 * Complete means: every year has a lane period, and every year of a state (a main, rival, parallel
 * or occupation period) has a head of state or leader, a head of government, a capital, a system
 * and a flag, in both languages. A year that truly had none of these is closed by a recorded
 * exception with a source (data/policy/coverage-exceptions.json), never by leaving it blank.
 * Pure.
 */
import type { CountryFile } from "./normalize";

export type Need = "lane" | "head of state" | "head of government" | "capital" | "system" | "flag";
export type Gap = { state: string | null; need: Need; start: number; end: number };
export type CoverageException = { country: string; state: string; need: Need; start: number; end: number; reason: string; source: string };

const ranges = (years: number[]): [number, number][] => {
  const out: [number, number][] = [];
  for (const y of [...years].sort((a, b) => a - b)) {
    const last = out.at(-1);
    if (last && y <= last[1] + 1) last[1] = y;
    else out.push([y, y]);
  }
  return out;
};

export function gaps(file: CountryFile, from: number, to: number, exceptions: CoverageException[] = []): Gap[] {
  const out: Gap[] = [];
  const years = Array.from({ length: to - from + 1 }, (_, i) => from + i).filter((y) => y !== 0);
  const holds = (r: { start: number; end: number | null }, y: number) => r.start <= y && (r.end === null || y <= r.end);
  const inLane = (p: { start: number; end: number | null }, y: number) => p.start <= y && (p.end === null || y < p.end);
  const main = file.lane.filter((p) => p.kind !== "rival" && p.kind !== "parallel");
  const excused = (state: string, need: Need, y: number) =>
    exceptions.some((e) => e.country === file.country.id && e.state === state && e.need === need && e.start <= y && y <= e.end);
  const add = (state: string | null, need: Need, list: number[]) => {
    for (const [start, end] of ranges(list)) out.push({ state, need, start, end });
  };

  add(null, "lane", years.filter((y) => !main.some((p) => inLane(p, y))));
  for (const id of new Set(file.lane.flatMap((p) => (p.state ? [p.state] : [])))) {
    const state = file.states.find((s) => s.id === id)!;
    const mine = years.filter((y) => file.lane.some((p) => p.state === id && inLane(p, y)));
    const terms = file.terms.filter((t) => t.state === id);
    const missing = (need: Need, has: (y: number) => boolean) => add(id, need, mine.filter((y) => !has(y) && !excused(id, need, y)));
    missing("head of state", (y) => terms.some((t) => (t.office === "head-of-state" || t.office === "leader") && holds(t, y)));
    missing("head of government", (y) => terms.some((t) => t.office === "head-of-government" && holds(t, y)));
    missing("flag", (y) => file.flags.some((f) => f.state === id && holds(f, y)));
    if (!state.capital) missing("capital", () => false);
    if (!state.system) missing("system", () => false);
  }
  return out;
}
