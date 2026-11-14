import type { CountrySummary } from "./data/summary";

/**
 * Folds text for matching (AC-1, L-6): case, Latin diacritics, the Arabic
 * forms of Persian letters, zero-width joiners and Persian or Arabic digits.
 */
export function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟ]/g, "") // combining marks, Arabic vowel signs
    .replace(/[‌‍ـ]/g, "") // ZWNJ, ZWJ, tatweel
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[أإآ]/g, "ا")
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type SearchEntry = { id: string; names: string[]; other: string[] };

/** A country is found by its name, its aliases, or any state that stood on its land. */
export function buildSearchIndex(countries: CountrySummary[]): SearchEntry[] {
  return countries.map((c) => ({
    id: c.id,
    names: [c.name.en, c.name.fa].map(fold),
    other: [...c.aliases, ...c.stateNames].map(fold),
  }));
}

/** Ids in the index's order, best matches first: name prefix, name, then aliases and states. */
export function searchCountries(index: SearchEntry[], query: string): string[] {
  const q = fold(query);
  if (!q) return index.map((entry) => entry.id);
  const rank = (entry: SearchEntry) =>
    entry.names.some((n) => n.startsWith(q)) ? 0
    : entry.names.some((n) => n.includes(q)) ? 1
    : entry.other.some((n) => n.includes(q)) ? 2
    : -1;
  return index
    .map((entry, i) => ({ id: entry.id, rank: rank(entry), i }))
    .filter((r) => r.rank !== -1)
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((r) => r.id);
}
