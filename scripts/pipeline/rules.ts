/**
 * Curated rules for head-of-government offices (docs/data-rules.md), used by the pipeline
 * (`pnpm data:pipeline`): which state and title a holder of each office gets, and which Wikidata
 * statements are left out, with the reason.
 */
type Localized = { en: string; fa: string };

const T = {
  pm: { en: "Prime Minister", fa: "نخست‌وزیر" },
  vizier: { en: "Grand Vizier", fa: "صدراعظم" },
  president: { en: "President", fa: "رئیس‌جمهور" },
  councilChair: { en: "Chairman of the Council of Ministers", fa: "رئیس شورای وزیران" },
  sovnarkom: { en: "Chairman of the Council of People's Commissars", fa: "رئیس شورای کمیسرهای خلق" },
  presidentCouncil: { en: "President of the Council of Ministers", fa: "رئیس شورای وزیران" },
  provisional: { en: "Chairman of the Provisional Government", fa: "رئیس دولت موقت" },
  chancellor: { en: "Chancellor", fa: "صدراعظم" },
  premier: { en: "Premier", fa: "نخست‌وزیر" },
};

/**
 * For each office: which state a term belongs to (by its start year), its
 * title, and the years in which the office was the head of government.
 * Returning null drops the term.
 */
export type Rule = (start: number) => { state: string | null; title: Localized } | null;
const byDate = (title: Localized | ((y: number) => Localized)): Rule => (y) => ({
  state: null,
  title: typeof title === "function" ? title(y) : title,
});
const only = (state: string, title: Localized, from = -Infinity, to = Infinity): Rule => (y) =>
  y >= from && y < to ? { state, title } : null;

export const RULES: Record<string, Rule> = {
  // Iran: grand viziers until the constitution of 1906, then prime ministers; the
  // office was abolished in 1989 and the president became head of government.
  Q13561063: (y) => (y < 1989 ? { state: null, title: y < 1906 ? T.vizier : T.pm } : null),
  Q838380: only("islamic-republic-of-iran", T.president, 1989),
  Q14211: byDate(T.pm),
  // Russia
  // The Council of Ministers of the Russian Empire was created in 1905.
  Q842386: (y) =>
    y < 1905 ? null : y <= 1917 ? { state: "russian-empire", title: T.councilChair } : y >= 1991 ? { state: "russian-federation", title: T.pm } : null,
  Q56919889: only("russian-sfsr", T.sovnarkom, 1917, 1923),
  Q4376682: only("soviet-union", T.sovnarkom, 1922),
  Q4376674: only("soviet-union", T.councilChair, 1946),
  // From January 1991 the office was "Prime Minister of the Soviet Union" (Valentin Pavlov).
  Q462189: (y) => (y >= 1991 ? { state: "soviet-union", title: T.pm } : y >= 1946 ? { state: "soviet-union", title: T.councilChair } : null),
  // Turkey: the president is head of government since 2018.
  Q15063567: only("ottoman-empire", T.vizier, 1700),
  Q2430415: (y) => (y < 1923 ? { state: "ankara-government", title: T.pm } : y < 2018 ? { state: "republic-of-turkey", title: T.pm } : null),
  Q1922067: only("republic-of-turkey", T.president, 2018),
  // France
  Q3409212: byDate(T.presidentCouncil),
  Q100711731: only("provisional-government-of-the-french-republic", T.provisional),
  Q1587677: (y) => (y >= 1959 ? { state: "french-fifth-republic", title: T.pm } : null),
  // Germany
  Q7050658: (y) => (y < 1949 ? { state: null, title: T.chancellor } : null),
  Q29034484: (y) => (y < 1949 ? { state: null, title: T.chancellor } : null),
  Q56022: (y) => (y < 1949 ? { state: null, title: T.chancellor } : null),
  Q4970706: only("federal-republic-of-germany", T.chancellor, 1949),
  Q2335229: only("east-germany", T.councilChair, 1949),
  // China: the Republic's premiers until 1949; later ones served on Taiwan.
  Q5369523: only("qing-dynasty", { en: "Prime Minister of the Imperial Cabinet", fa: "نخست‌وزیر کابینهٔ امپراتوری" }, 1911, 1912),
  Q30060907: only("republic-of-china", T.premier, 1912, 1949),
  Q702650: only("republic-of-china", T.premier, 1912, 1949),
  Q4122271: only("peoples-republic-of-china", T.premier, 1949),
  Q192711: byDate(T.pm),
  Q274948: byDate(T.pm),
  // United States: the President is head of government as well as head of state.
  Q11696: only("united-states", T.president),
  // Italy: the Kingdom of Sardinia's Council of Ministers began with the Albertine Statute of 1848 (R7).
  Q25174735: only("kingdom-of-sardinia", T.pm, 1848),
  Q25160174: only("kingdom-of-italy", T.pm, 1861),
  Q796897: only("italian-republic", T.pm, 1946),
};

/** Statements on Wikidata that are wrong for this purpose, with the reason. */
export const EXCLUDE: Record<string, string> = {
  Q131426522: "A person named only “David”, prime minister of the UK from 2003: vandalism on Wikidata",
  Q2512945: "Iosif Adamovich headed the government of the Byelorussian SSR, not of the USSR",
  Q4328135: "Nygmet Nurmakov headed the government of the Kazakh ASSR, not of the USSR",
  Q941748: "Panteleimon Ponomarenko headed the government of the Byelorussian SSR, not of the USSR",
  Q3893833:
    "Ata'ollah Mohajerani was never Prime Minister of Iran (Mir-Hossein Mousavi held the office 1981–1989); a wrong P39 statement on Wikidata",
};

/** Single statements to leave out, as "person:start-end", with the reason (docs/data-rules.md). */
export const EXCLUDE_TERMS: Record<string, string> = {
  "Q23530:2020-2020": "Dmitry Medvedev resigned on 15 January 2020; this is only his caretaker day, already inside his 2012–2020 term",
  "Q4082839:2020-2020": "R3: Andrey Belousov was acting prime minister for a few weeks in 2020, less than a year",
};
