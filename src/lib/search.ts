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

/**
 * A rough "sounds like" form of Latin text (L-6), so transliterations of the same name meet:
 * Qajar, Ghajar, Kajar and Ghadjar all become "kjr"; Tehran and Teheran become "trn"; Isfahan and
 * Esfahan become "sfn". Vowels and a silent h go; spelling variants of one consonant are merged.
 * It is blunt on purpose and only ever ranks below real matches.
 */
export function sound(text: string): string {
  return fold(text)
    .replace(/[^a-z\s]/g, "")
    .replace(/sh/g, "$")
    .replace(/ch/g, "%")
    .replace(/kh/g, "x")
    .replace(/gh/g, "k")
    .replace(/zh|dj/g, "j")
    .replace(/ph/g, "f")
    .replace(/th/g, "t")
    .replace(/h/g, "")
    .replace(/[qc]/g, "k")
    .replace(/w/g, "v")
    .replace(/[aeiouy]/g, "")
    .replace(/(.)\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const SOUND_MIN = 3;

export type SearchEntry = { id: string; names: string[]; other: string[]; sounds: string[] };

const latinWords = (texts: string[]) =>
  texts.flatMap((t) => (/[a-z]/i.test(t) ? fold(t).split(" ").map(sound) : [])).filter((w) => w.length >= 2);

/** A country is found by its name, its aliases, or any state that stood on its land. */
export function buildSearchIndex(countries: CountrySummary[]): SearchEntry[] {
  return countries.map((c) => ({
    id: c.id,
    names: [c.name.en, c.name.fa].map(fold),
    other: [...c.aliases, ...c.stateNames].map(fold),
    sounds: [...new Set(latinWords([c.name.en, ...c.aliases, ...c.stateNames]))],
  }));
}

/** Ids in the index's order, best matches first: name prefix, name, aliases and states, then "sounds like". */
export function searchCountries(index: SearchEntry[], query: string): string[] {
  const q = fold(query);
  if (!q) return index.map((entry) => entry.id);
  const heard = /[a-z]/.test(q) ? q.split(" ").map(sound).filter((w) => w.length >= SOUND_MIN) : [];
  const rank = (entry: SearchEntry) =>
    entry.names.some((n) => n.startsWith(q)) ? 0
    : entry.names.some((n) => n.includes(q)) ? 1
    : entry.other.some((n) => n.includes(q)) ? 2
    : heard.length > 0 && heard.every((h) => entry.sounds.some((w) => w.startsWith(h))) ? 3
    : -1;
  return index
    .map((entry, i) => ({ id: entry.id, rank: rank(entry), i }))
    .filter((r) => r.rank !== -1)
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((r) => r.id);
}
