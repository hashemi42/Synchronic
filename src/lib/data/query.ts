import { isBeside } from "./kinds";
import type { CountryFile, Flag, LanePeriod, NoFlag, OfficeTerm } from "./schema";

/** Ranges are half-open: start ≤ year < end. */
export const covers = (r: { start: number; end: number | null }, year: number) =>
  r.start <= year && (r.end === null || year < r.end);

/** The lane's main period at a year, and the rival governments and parallel states beside it. */
export function periodsAt(file: CountryFile, year: number): { main: LanePeriod | null; beside: LanePeriod[] } {
  // A period beside the lane that began and ended within one year (start === end) is active in that year.
  const active = file.lane.filter((p) => covers(p, year) || (isBeside(p.kind) && p.start === p.end && p.start === year));
  return {
    main: active.find((p) => !isBeside(p.kind)) ?? null,
    beside: active.filter((p) => isBeside(p.kind)),
  };
}

export function termAt(
  file: CountryFile,
  stateId: string,
  year: number,
  office: OfficeTerm["office"] = "head-of-state",
): OfficeTerm | null {
  const terms = file.terms.filter((t) => t.state === stateId && t.office === office);
  // A term that began and ended within the year (Napoleon's Hundred Days, 1815) counts in that
  // year when no other does.
  return terms.find((t) => covers(t, year)) ?? terms.findLast((t) => t.start === year && t.end === year) ?? null;
}

/**
 * The flag to draw for a state within a lane period: the one flying at `year`
 * when the cursor is inside the period, otherwise the period's last flag.
 * Null when no flag is on record for those years.
 */
export function flagFor(file: CountryFile, period: { state: string | null; start: number; end: number | null }, year: number): Flag | null {
  if (!period.state) return null;
  const flags = file.flags
    .filter((f) => f.state === period.state && f.start < (period.end ?? Infinity) && period.start < (f.end ?? Infinity))
    .sort((a, b) => a.start - b.start);
  if (covers(period, year)) return flags.find((f) => covers(f, year)) ?? null;
  return flags.at(-1) ?? null;
}

/**
 * The years for which a state's flag is recorded as not documented (PRD §7.7, R9): the record that
 * covers `year` when the cursor is inside the period, otherwise every record within the period.
 */
export function noFlagsFor(file: CountryFile, period: { state: string | null; start: number; end: number | null }, year: number): NoFlag[] {
  const records = file.noFlag.filter(
    (n) => n.state === period.state && n.start < (period.end ?? Infinity) && period.start < (n.end ?? Infinity),
  );
  return covers(period, year) ? records.filter((n) => covers(n, year)) : records;
}
