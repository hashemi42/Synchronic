/**
 * Checks that go beyond the shape of a record (PRD §6.3 step 4):
 * references resolve, lanes have no unmarked gaps or overlaps, and office
 * terms sit inside their state's lifetime.
 */
import { isBeside } from "./kinds";
import { CountryFile, type LanePeriod } from "./schema";

export type Issue = { path: string; message: string };
export type ValidationResult =
  | { ok: true; data: CountryFile; issues: [] }
  | { ok: false; data: null; issues: Issue[] };

const END_OF_TIME = Number.POSITIVE_INFINITY;
const endOf = (r: { end: number | null }) => r.end ?? END_OF_TIME;
const fmt = (y: number) => (y === END_OF_TIME ? "today" : y < 0 ? `${-y} BCE` : String(y));

/** The main sequence of a lane: everything except rival governments and parallel states, which overlap by design (IN-6). */
const isMainline = (p: LanePeriod) => !isBeside(p.kind);

export function checkLane(lane: LanePeriod[]): Issue[] {
  const issues: Issue[] = [];
  const main = lane
    .map((period, index) => ({ period, index }))
    .filter(({ period }) => isMainline(period))
    .sort((a, b) => a.period.start - b.period.start);

  for (let i = 1; i < main.length; i++) {
    const prev = main[i - 1];
    const next = main[i];
    const prevEnd = endOf(prev.period);
    if (next.period.start > prevEnd) {
      issues.push({
        path: `lane[${next.index}]`,
        message: `Gap in lane from ${fmt(prevEnd)} to ${fmt(next.period.start)}. Add a period, or a "no-state" period with a note.`,
      });
    } else if (next.period.start < prevEnd) {
      issues.push({
        path: `lane[${next.index}]`,
        message: `Overlap in lane: ${fmt(next.period.start)} starts before the previous period ends (${fmt(prevEnd)}). Mark a government that contested the state as kind "rival", and a second state as "parallel".`,
      });
    }
  }

  const last = main.at(-1);
  if (last && last.period.end !== null) {
    issues.push({
      path: `lane[${last.index}]`,
      message: `Lane stops at ${fmt(last.period.end)}; the final period must run to today (end: null).`,
    });
  }
  return issues;
}

export function checkReferences(file: CountryFile): Issue[] {
  const issues: Issue[] = [];
  const states = new Map(file.states.map((s) => [s.id, s]));
  const persons = new Set(file.persons.map((p) => p.id));

  const duplicates = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const id of duplicates(file.states.map((s) => s.id)))
    issues.push({ path: "states", message: `Duplicate state id "${id}"` });
  for (const id of duplicates(file.persons.map((p) => p.id)))
    issues.push({ path: "persons", message: `Duplicate person id "${id}"` });

  file.lane.forEach((period, i) => {
    if (period.country !== file.country.id)
      issues.push({ path: `lane[${i}].country`, message: `Expected "${file.country.id}", found "${period.country}"` });
    if (period.state === null) return;
    const state = states.get(period.state);
    if (!state) {
      issues.push({ path: `lane[${i}].state`, message: `Unknown state "${period.state}"` });
    } else if (period.start < state.start || endOf(period) > endOf(state)) {
      issues.push({
        path: `lane[${i}]`,
        message: `Period ${fmt(period.start)}–${fmt(endOf(period))} falls outside "${state.id}" (${fmt(state.start)}–${fmt(endOf(state))})`,
      });
    }
  });

  file.terms.forEach((term, i) => {
    if (!persons.has(term.person))
      issues.push({ path: `terms[${i}].person`, message: `Unknown person "${term.person}"` });
    const state = states.get(term.state);
    if (!state) {
      issues.push({ path: `terms[${i}].state`, message: `Unknown state "${term.state}"` });
    } else if (term.start < state.start || endOf(term) > endOf(state)) {
      issues.push({
        path: `terms[${i}]`,
        message: `Term of "${term.person}" (${fmt(term.start)}–${fmt(endOf(term))}) falls outside "${state.id}" (${fmt(state.start)}–${fmt(endOf(state))})`,
      });
    }
  });

  file.flags.forEach((flag, i) => {
    if (!states.has(flag.state)) issues.push({ path: `flags[${i}].state`, message: `Unknown state "${flag.state}"` });
    // A state shows one flag at a time.
    const clash = file.flags.findIndex(
      (other, j) => j < i && other.state === flag.state && flag.start < endOf(other) && other.start < endOf(flag),
    );
    if (clash !== -1)
      issues.push({ path: `flags[${i}]`, message: `Overlaps flags[${clash}] of "${flag.state}" (${fmt(flag.start)}–${fmt(endOf(flag))})` });
  });

  file.noFlag.forEach((none, i) => {
    if (!states.has(none.state)) issues.push({ path: `noFlag[${i}].state`, message: `Unknown state "${none.state}"` });
    // "No documented flag" and a flag cannot both hold for the same years.
    const clash = file.flags.findIndex((flag) => flag.state === none.state && flag.start < endOf(none) && none.start < endOf(flag));
    if (clash !== -1) issues.push({ path: `noFlag[${i}]`, message: `Overlaps flags[${clash}] of "${none.state}"` });
  });

  return issues;
}

export function validateCountryFile(input: unknown): ValidationResult {
  const parsed = CountryFile.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      data: null,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join(".") || "(root)",
        message: issue.message,
      })),
    };
  }
  const issues = [...checkReferences(parsed.data), ...checkLane(parsed.data.lane)];
  return issues.length === 0 ? { ok: true, data: parsed.data, issues: [] } : { ok: false, data: null, issues };
}


/**
 * Checks that need every country file at once: country ids and state ids are unique across files
 * (border features and `ruled-by` periods name states by id), and each `ruled-by` period points at
 * a state that exists and that holds its own country's lane for all the years claimed.
 */
export function checkAcrossFiles(files: CountryFile[]): Issue[] {
  const issues: Issue[] = [];
  const byCountry = new Map(files.map((f) => [f.country.id, f]));

  files.forEach(({ country: { id } }, i) => {
    if (files.findIndex((f) => f.country.id === id) < i) issues.push({ path: `${id}: country.id`, message: `Country id "${id}" is used in two files` });
  });

  const owner = new Map<string, string>();
  for (const file of files)
    for (const state of file.states) {
      const other = owner.get(state.id);
      if (other && other !== file.country.id) issues.push({ path: `${file.country.id}: states`, message: `State id "${state.id}" is also used in "${other}"` });
      owner.set(state.id, file.country.id);
    }

  for (const file of files)
    file.lane.forEach((period, i) => {
      if (!period.ruler) return;
      const path = `${file.country.id}: lane[${i}].ruler`;
      const { country, state: id } = period.ruler;
      if (country === file.country.id) return issues.push({ path, message: "A ruled-by period names a state of another country; use \"state\" for one of this file" });
      const ruling = byCountry.get(country);
      if (!ruling) return issues.push({ path, message: `Unknown country "${country}"` });
      if (!ruling.states.some((s) => s.id === id)) return issues.push({ path, message: `Unknown state "${id}" in "${country}"` });

      // The years the ruling state holds its own lane, joined where they meet. A rival or parallel state does not hold it.
      const held = ruling.lane.filter((p) => isMainline(p) && p.state === id).sort((a, b) => a.start - b.start);
      let reach = period.start;
      for (const p of held) if (p.start <= reach) reach = Math.max(reach, endOf(p));
      if (reach < endOf(period) || !held.some((p) => p.start <= period.start && period.start < endOf(p)))
        issues.push({ path, message: `"${id}" does not hold the lane of "${country}" for all of ${fmt(period.start)}–${fmt(endOf(period))}` });
    });
  return issues;
}
