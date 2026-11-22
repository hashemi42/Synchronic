/**
 * Fills in `ruled-by` periods (data phase proposal, D3). Such a period points at a state in another
 * country's file instead of copying it, so the data has one record of it. The site loads one file
 * per country, so when the files are emitted the ruling state, its terms, its people and its flags
 * are read from the other file, for the years of the period. Pure; data/merged/ is never changed.
 */
import type { CountryFile, LanePeriod, OfficeTerm, Person } from "./schema";

type Span = { start: number; end: number | null };
/** Ranges are half-open, so ending in the year the other starts is not enough; a term within one year is in that year. */
const endOf = (r: Span) => (r.end === null ? Infinity : r.end === r.start ? r.start + 1 : r.end);
const meets = (a: Span, b: Span) => a.start < endOf(b) && b.start < endOf(a);

export function resolveRuledBy(file: CountryFile, others: (country: string) => CountryFile | undefined): CountryFile {
  if (!file.lane.some((p) => p.kind === "ruled-by")) return file;

  const out: CountryFile = {
    ...file,
    states: [...file.states],
    persons: [...file.persons],
    terms: [...file.terms],
    flags: [...file.flags],
    noFlag: [...file.noFlag],
  };
  /** The same person in both files keeps one record; a different one with the same id is renamed. */
  const personId = (person: Person, country: string): string => {
    const mine = out.persons.find((p) => p.id === person.id);
    if (mine && mine.wikidata === person.wikidata) return mine.id;
    const id = mine ? `${country}-${person.id}` : person.id;
    if (!out.persons.some((p) => p.id === id)) out.persons.push({ ...person, id });
    return id;
  };

  // Periods of one ruling state share its record and take only the years they need.
  const byRuler = Map.groupBy(
    file.lane.filter((p): p is LanePeriod & { ruler: NonNullable<LanePeriod["ruler"]> } => p.kind === "ruled-by" && !!p.ruler),
    (p) => `${p.ruler.country}/${p.ruler.state}`,
  );
  for (const periods of byRuler.values()) {
    const { country, state } = periods[0].ruler;
    const source = others(country);
    const ruling = source?.states.find((s) => s.id === state);
    if (!source || !ruling) throw new Error(`${file.country.id}: ruled by unknown state "${country}/${state}"`);
    const needed = (r: Span) => periods.some((p) => meets(r, p));
    const people = new Map(source.persons.map((p) => [p.id, p]));

    out.states.push(ruling);
    out.terms.push(
      ...source.terms
        .filter((t) => t.state === state && needed(t))
        .map((t): OfficeTerm => ({ ...t, person: personId(people.get(t.person)!, country) })),
    );
    out.flags.push(...source.flags.filter((f) => f.state === state && needed(f)));
    out.noFlag.push(...source.noFlag.filter((n) => n.state === state && needed(n)));
  }
  out.lane = file.lane.map((p) => (p.kind === "ruled-by" && p.ruler ? { ...p, state: p.ruler.state } : p));
  return out;
}
