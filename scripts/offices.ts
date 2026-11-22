/** country id → Wikidata items of its head-of-government offices, oldest first. */
export const OFFICES: Record<string, string[]> = {
  iran: ["Q13561063", "Q838380"], // Prime Minister of Iran; President of Iran (head of government from 1989)
  uk: ["Q14211"], // Prime Minister of the United Kingdom
  // Chairman of the Council of People's Commissars of the RSFSR; … of the USSR; Chairman of the
  // Council of Ministers of the USSR; Premier of the Soviet Union; Prime Minister of Russia
  russia: ["Q56919889", "Q4376682", "Q4376674", "Q462189", "Q842386"],
  turkey: ["Q15063567", "Q2430415", "Q1922067"], // Grand vizier; Prime Minister; President (from 2018)
  // President of the Council (1815–1958); Chairman of the Provisional Government; Prime Minister (1959–)
  france: ["Q3409212", "Q100711731", "Q1587677"],
  // Reich Chancellor (both items); Chancellor of Germany; Federal Chancellor; Prime Minister of East Germany
  germany: ["Q7050658", "Q29034484", "Q56022", "Q4970706", "Q2335229"],
  // Imperial Cabinet (1911); Premier of the Cabinet (Beiyang); Premier of the Republic of China; Premier of the PRC
  china: ["Q5369523", "Q30060907", "Q702650", "Q4122271"],
  india: ["Q192711"], // Prime Minister of India
  japan: ["Q274948"], // Prime Minister of Japan
  us: ["Q11696"], // President of the United States: head of state and of government from 1789
  // Prime Minister of the Kingdom of Sardinia (from 1848); of the Kingdom of Italy; of the Italian Republic
  italy: ["Q25174735", "Q25160174", "Q796897"],
};

/**
 * Offices that became the head of government in a given year: a term already under way then counts
 * from that year (Erdoğan's presidency from 2018). Used by the merge script and the audit (A1).
 */
export const HEAD_OF_GOVERNMENT_FROM: Record<string, number> = { Q1922067: 2018, Q838380: 1989, Q11696: 1789 };
