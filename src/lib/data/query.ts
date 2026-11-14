import type { CountryFile, Flag, LanePeriod, OfficeTerm } from "./schema";

/** Ranges are half-open: start ≤ year < end. */
export const covers = (r: { start: number; end: number | null }, year: number) =>
  r.start <= year && (r.end === null || year < r.end);

export function periodsAt(file: CountryFile, year: number): { main: LanePeriod | null; rivals: LanePeriod[] } {
  const active = file.lane.filter((p) => covers(p, year));
  return {
    main: active.find((p) => p.kind !== "rival") ?? null,
    rivals: active.filter((p) => p.kind === "rival"),
  };
}

export function termAt(
  file: CountryFile,
  stateId: string,
  year: number,
  office: OfficeTerm["office"] = "head-of-state",
): OfficeTerm | null {
  return file.terms.find((t) => t.state === stateId && t.office === office && covers(t, year)) ?? null;
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
