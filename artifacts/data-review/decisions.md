# Review decisions: replacing the nine country files

Decided on 2026-11-17 under the rules given for the review. Every change to the data the site shows is a row in [replacement.csv](replacement.csv) (before and after, 97 rows). The questions left for a person are at the end.

## What changed for a reader of the site

| Change | Count |
| --- | ---: |
| Persian names of people changed to the fa.wikipedia title | 62 |
| Persian names that only regained a lost half-space (ZWNJ) | 32 |
| Rulers added for 1789 | 3 |
| Office terms removed or re-dated | 0 |
| States, lanes, capitals, systems, official names, flags | unchanged |

Not visible, but new in the data: 776 of the 904 office terms now carry an exact start or end date, and a term that comes from Wikidata cites the person's English Wikipedia article, where there is one, beside the Wikidata item.

## Block by block

### Head-of-state offices

27 office rules in nine countries, now in each curated file under `offices`.

- **United Kingdom:** "Duke of Brunswick-Lüneburg" dropped. Monarch of Great Britain (to 1801), monarch of the United Kingdom of Great Britain and Ireland, and Monarch of the United Kingdom are used.
- **Iran:** no dynasty-specific office is in use on Wikidata; every shah holds only the generic "shah" item. The rule keeps that item but takes only holders whose family (P53) is the Qajar or Pahlavi dynasty, and a second rule takes the Zand dynasty into the rival Zand period. This gives the result asked for; see question 6.
- **China:** President of the Republic of China and President of the National Government are added with `until: 1949`, since later holders served on Taiwan.
- **The other 22** are confirmed as found, each with the title the data already used for its holders.

### Pipeline-only holders (14)

| Decision | Who | Why |
| --- | --- | --- |
| Included | Jafar Khan Zand (to January 1789), Seyd Morad Khan (January–May 1789) | Zand rulers in their own right; the English Wikipedia infoboxes give these reigns. They sit in the rival Zand period |
| Included | Abdul Hamid I (to April 1789) | Ottoman sultan; infobox reign 21 January 1774 – 7 April 1789 |
| Excluded, R3 | Louis-Eugène Cavaignac (1848), Louis-Jules Trochu (1870–1871), Georges Bidault (1946), Friedrich Ebert Jr. (1973) | Interim or acting for less than a year |
| Excluded, never held the office | Louis XVII, Grand Duke Michael Alexandrovich, Mehmed Abdulaziz and Ali Vasib (heads of the Ottoman house in the 1970s) | Claimants; none reigned |
| Excluded, not in the lane | Hong Xiuquan (Taiping), Wang Jingwei and Chen Gongbo (Nanjing government, 1940–1945) | Heads of states the lane does not have; see question 3 |

R3 also runs as code now: a statement Wikidata marks as acting or interim for less than a year is dropped without being named. It caught Charles Dupuy (1894), Frédéric François-Marsal (1924) and Viktor Chernomyrdin (1996) on its own.

### Terms that differ from Wikidata

The hand-entered term is kept in every case, as a curated term with its source: 60 of the 676 person-and-office groups. They are of three kinds:

- **Not on Wikidata, or undated there** (26): the Qing emperors' successors in the Republic, Pétain, de Gaulle, the party leaders (R4), Iran's presidents of 1980–1989 (R8).
- **One person under two titles** (R1) or dated differently, each already checked against its source (29): Napoleon as First Consul and Emperor, Wilhelm I, Victoria as Queen and Empress of India, Atatürk, Lenin, Putin from 1999, Li Peng from 1988.
- **Two titles in one state** (5).

The other 616 groups come from Wikidata and match the old data year for year.

### Persian names

- **Applied:** 94 fa.wikipedia titles (62 real changes, 32 half-space only).
- **Kept ours, by the rule** (15): 12 where the title has brackets or a comma, or there is no article; Victoria («ملکه ویکتوریا» adds a title), A. P. J. Abdul Kalam (full formal name), Chlodwig zu Hohenlohe (the title is a bare first name).
- **State names:** all kept as confirmed.
- **English names:** 19 kept short where the Wikipedia title adds a disambiguator ("Alexander I" for "Alexander I of Russia", "Victoria" for "Queen Victoria").

One name was simply wrong and is now fixed: Fumimaro Konoe carried Keisuke Okada's Persian name.

### State years (12 differences)

All twelve keep the year in the data. Eleven are confirmed by the infobox of the state's cited article, or follow from the rule that a state ends where the next begins (the Bourbon Restoration starts in 1814 to meet the First Empire's end; its article dates it from 1815). The twelfth is question 1.

### Flags

Licences are now read from Commons by the pipeline: 59 public domain, 1 CC BY-SA 3.0, all on the allowlist. Each flag records the file's hash and the date it was read. The curated credit line is kept, because the author field on Commons is often "Own work" or a notice.

## A bug found on the way

The Wikidata query service drops the half-space (zero-width non-joiner) from every name it returns. The old heads-of-government script read names that way, which is why names such as «احمدی‌نژاد» and «مک‌دونالد» were stored without it. The pipeline now reads names from the entity API, which keeps it.

## Ten decisions to spot-check

| # | Country | Record | Before | After | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | Iran | Seyd Morad Khan, Zand ruler | not in the data | 1789, rival Zand period | [en.wikipedia](https://en.wikipedia.org/wiki/Seyd_Morad_Khan): reign 23 January – 10 May 1789 |
| 2 | Turkey | Abdul Hamid I, Sultan | not in the data | 1774–1789 | [en.wikipedia](https://en.wikipedia.org/wiki/Abdul_Hamid_I): reign to 7 April 1789 |
| 3 | France | Louis-Jules Trochu | not in the data | left out (R3) | Head of a provisional government, September 1870 – February 1871; leaves 1870 without a head of state in the Third Republic |
| 4 | Japan | Fumimaro Konoe, Persian name | کیسوکه اوکادا | فومیمارو کونوئه | The old value was another prime minister's name |
| 5 | Iran | Fath-Ali Shah, Persian name | فتحعلی‌شاه قاجار | فتحعلی‌شاه | fa.wikipedia title; the same for five other Qajar shahs |
| 6 | UK | Marquess of Salisbury, Persian name | مارکیز آو سالیسبوری | رابرت گاسکوین-سسیل | fa.wikipedia titles him by his personal name |
| 7 | Germany | Leopold II, Persian name | لئوپولد دوم | kept | The fa.wikipedia title is «لئوپولد دوم، امپراتور مقدس روم» |
| 8 | Russia | Vladimir Putin, President | 1999–2008 | kept; Wikidata says 2000 | Acting from 31 December 1999, then elected; already checked by hand |
| 9 | China | President of the Republic of China | found, not used | used until 1949 | Later holders served on Taiwan |
| 10 | Japan | Tokugawa shogunate, end | 1868 | kept; Wikidata says 1867 | [en.wikipedia](https://en.wikipedia.org/wiki/Tokugawa_shogunate) infobox: 1603–1868, and it meets the Empire's start |

## Questions for you

1. **Guangzhou government, 1917–1928 (sources conflict).** The state's cited article, "Constitutional Protection junta", dates it 1917–1921. The data and the PRD's own example (IN-6) run it to 1928, covering the later Guangzhou governments. Kept at 1928. Either the state is split into its successive governments, or it needs sources for 1921–1928.
2. **Napoleon's Hundred Days, 1815 (sources conflict with the lane).** Wikidata and the First French Empire's article give the Empire a second span in 1815. The lane has the Bourbon Restoration from 1814 without a break. Not shown. It would be a second period of the Empire in 1815.
3. **Rival governments that are not in a lane (political labels).** The Taiping Heavenly Kingdom (1851–1864) and the Japanese-backed Nanjing government (1940–1945) have heads on Wikidata. Adding either means choosing a kind and a label for it. Left out.
4. **R3 and heads of government already in the data.** Applied strictly, R3 would also remove eight existing terms of under a year: Mohammad Ali Foroughi (1925–1926), Mohammad Mokhber (2024), Sanjō Sanetomi (1889), Masayoshi Itō (1980), Walter Scheel (1974), Boris Yeltsin (1991–1992), Yegor Gaidar (1992) and Viktor Chernomyrdin's second term (1998). Removing Yeltsin and Gaidar leaves Russia without a head of government for 1991–1992. Kept.
5. **Interim heads who were not called "acting".** Cavaignac, Trochu and Bidault led provisional governments for under a year. I read R3 as covering them; France then shows no head of state for 1870 and 1946. Say if they should be shown instead.
6. **Iran's shahs.** You asked for dynasty-specific office items. None is in use on Wikidata, so the generic item is filtered by dynasty. The alternative is to create such items on Wikidata and move the statements, which is an edit to Wikidata from your account.
7. **Complete lanes (no source).** Only the United Kingdom is complete for 1800–today under D10. The other eight have 58 open gaps in [completeness.md](completeness.md): mostly years before a head-of-government office existed, and flags before a state had one. Each needs either data or a recorded "there was none" with a source; I did not write those from memory.
