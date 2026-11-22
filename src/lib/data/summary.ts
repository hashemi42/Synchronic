/**
 * The small part of a country file every page carries (NF-2): enough to search
 * for a country, preview what it was in a given year and name it while its
 * full data loads. Everything else is fetched per country on demand.
 */
import { buildLaneModel } from "@/components/timeline/model";
import { flagFor } from "./query";
import type { CountryFile, Flag, LaneKind, Localized } from "./schema";

export type CountrySummary = {
  id: string;
  name: Localized;
  aliases: string[];
  /** Names of every state that stood on the land, and their capitals, for search. */
  stateNames: string[];
  mainline: { name: Localized | null; note: Localized | null; start: number; end: number | null; kind: LaneKind }[];
  reigns: { name: Localized; title: Localized; start: number; end: number | null }[];
  /** Today's flag, shown only in the Add-country dialog (AC-5). */
  flag: Flag | null;
};

export function summarize(file: CountryFile, today: number): CountrySummary {
  const model = buildLaneModel(file);
  const last = model.mainline.at(-1);
  // The capital of a state that ruled this land from another lane is not on this land.
  const ruling = new Set(file.lane.filter((p) => p.kind === "ruled-by").map((p) => p.state));
  return {
    id: file.country.id,
    name: file.country.name,
    aliases: file.country.aliases,
    stateNames: file.states.flatMap((s) =>
      [s.name.en, s.name.fa, s.officialName?.en, s.officialName?.fa, s.localName, ...(ruling.has(s.id) ? [] : [s.capital?.en, s.capital?.fa])].filter((n): n is string => !!n),
    ),
    mainline: model.mainline.map((p) => ({
      name: p.label ?? (p.state ? (model.states.get(p.state)?.name ?? null) : null),
      note: p.note ?? null,
      start: p.start,
      end: p.end,
      kind: p.kind,
    })),
    reigns: model.reigns
      .filter((r) => r.start !== r.end)
      .map((r) => ({ name: model.persons.get(r.person)!.name, title: r.title, start: r.start, end: r.end })),
    flag: last ? flagFor(file, last, today) : null,
  };
}
