# Review decisions: replacing the nine country files

Decided on 2026-11-17 in three rounds: first under the rules given for the review, then under the answers to the seven questions it raised, then closing the gaps in a second pull request. Every change to the data the site shows is a row in [replacement.csv](replacement.csv), before and after.

## What changed for a reader of the site

| Change | Count |
| --- | ---: |
| Persian names of people changed to the fa.wikipedia title | 56 |
| Persian names that only regained a lost half-space (ZWNJ) | 31 |
| Rival periods added (three new states, and the Hundred Days) | 4 |
| Office terms added | 16 |
| Office terms removed under R3 | 5 |
| Existing terms re-dated (Yikuang, 1911–1912 to 1911) | 1 |
| States renamed, existing lanes or flags changed | 0 |

One state year changed: the First French Empire now ends in 1815, to hold the Hundred Days. Two flags were added, for the Nanjing government and Manchukuo.

Not visible, but new in the data: most office terms carry an exact start or end date, and a term that comes from Wikidata cites the person's English Wikipedia article, where there is one, beside the Wikidata item.

## Round 1: the review

### Head-of-state offices

27 office rules in nine countries, now in each curated file under `offices`.

- **United Kingdom:** "Duke of Brunswick-Lüneburg" dropped. Monarch of Great Britain (to 1801), monarch of the United Kingdom of Great Britain and Ireland, and Monarch of the United Kingdom are used.
- **Iran:** no dynasty-specific office is in use on Wikidata; every shah holds only the generic "shah" item. The rule keeps that item but takes only holders whose family (P53) is the Qajar or Pahlavi dynasty, and a second rule takes the Zand dynasty into the rival Zand period. Approved as it stands.
- **China:** President of the Republic of China and President of the National Government are used with `until: 1949`, since later holders served on Taiwan.
- **The other 22** are confirmed as found, each with the title the data already used for its holders.

### Holders only Wikidata has

| Decision | Who | Why |
| --- | --- | --- |
| Included | Jafar Khan Zand (to January 1789), Seyd Morad Khan (January–May 1789) | Zand rulers in their own right; the English Wikipedia infoboxes give these reigns. They sit in the rival Zand period |
| Included | Abdul Hamid I (to April 1789) | Ottoman sultan; infobox reign 21 January 1774 – 7 April 1789 |
| Excluded, never held the office | Louis XVII, Grand Duke Michael Alexandrovich, Mehmed Abdulaziz and Ali Vasib (heads of the Ottoman house in the 1970s) | Claimants; none reigned |

### Terms that differ from Wikidata

The hand-entered term is kept in every case, as a curated term with its source. They are of three kinds:

- **Not on Wikidata, or undated there:** the Republic of China's early presidents, Pétain, de Gaulle, the party leaders (R4), Iran's presidents of 1980–1989 (R8).
- **One person under two titles** (R1) or dated differently, each already checked against its source: Napoleon as First Consul and Emperor, Wilhelm I, Victoria as Queen and Empress of India, Atatürk, Lenin, Putin from 1999, Li Peng from 1988.
- **Two titles in one state.**

All other terms come from Wikidata and match the old data year for year. The split per country is in [pipeline.md](pipeline.md).

### Persian names

- **Applied:** 87 fa.wikipedia titles (56 real changes, 31 half-space only).
- **Kept ours, the dynasty is part of the common name** (6): the Qajar shahs from Fath-Ali Shah to Ahmad Shah keep «… قاجار» («احمدشاه قاجار», where the fa.wikipedia title is «احمدشاه»). Decided after the first review of this pull request. The other 56 changed names were checked for the same pattern; none drops a dynasty or house name.
- **Kept ours, by the rule** (15): 12 where the title has brackets or a comma, or there is no article; Victoria («ملکه ویکتوریا» adds a title), A. P. J. Abdul Kalam (full formal name), Chlodwig zu Hohenlohe (the title is a bare first name).
- **State names:** all kept as confirmed.
- **English names:** 19 kept short where the Wikipedia title adds a disambiguator ("Alexander I" for "Alexander I of Russia", "Victoria" for "Queen Victoria").

One name was simply wrong and is now fixed: Fumimaro Konoe carried Keisuke Okada's Persian name.

### State years

All twelve differences keep the year in the data. They are confirmed by the infobox of the state's cited article, or follow from the rule that a state ends where the next begins (the Bourbon Restoration starts in 1814 to meet the First Empire's end; its article dates it from 1815).

### Flags

Licences are read from Commons by the pipeline: all public domain but one CC BY-SA 3.0, all on the allowlist. Each flag records the file's hash and the date it was read. The curated credit line is kept, because the author field on Commons is often "Own work" or a notice.

## Round 2: your answers to the seven questions

### R3 never creates a gap

An acting or interim holder of under a year is now left out only when someone else covers every year of the term in the same state. The rule runs in the pipeline, for holders Wikidata marks as acting and for those named in a curated file with an "R3" reason.

| Outcome | Who |
| --- | --- |
| Restored: nobody else covers the year | Louis-Jules Trochu (1870–1871), Georges Bidault (1946) |
| Kept: nobody else covers the year | Boris Yeltsin as head of government (1991–1992), Mohammad Ali Foroughi (1925–1926) |
| Kept by your decision, although someone else covers the year | Louis-Eugène Cavaignac (1848), Yegor Gaidar (1992) |
| Removed: someone else covers the years | Walter Scheel (1974), Mohammad Mokhber (2024), Sanjō Sanetomi (1889), Masayoshi Itō (1980), Viktor Chernomyrdin's stint of August–September 1998 |
| Still left out, as before | Alain Poher, Karl Arnold, Friedrich Ebert Jr., Jens Böhrnsen, Horst Seehofer, Mohammad Hidayatullah, B. D. Jatti, Vasily Kuznetsov, Ivan Silayev, and Turkey's five acting presidents |

"Covers" is judged by year, which is what the lanes show. Judged by day, every acting holder fills a vacancy and R3 would remove nobody. That is why Cavaignac and Gaidar needed your decision: Louis-Napoléon also holds 1848, and Chernomyrdin also holds 1992.

### Guangzhou government, 1917–1928

Kept. The state and its lane period now cite the three later governments as well: the Canton government (2 April 1921 – 16 June 1922), the Army and Navy Generalissimo's Headquarters (21 February 1923 – 1 July 1925) and the Nationalist government, established in Guangzhou in 1925. The sources show a break between June 1922 and February 1923; the period is not split.

### New rival periods

| Period | Years | Label | Head | Source |
| --- | --- | --- | --- | --- |
| Hundred Days (France) | 20 March – 8 July 1815 | Hundred Days | Napoleon, Emperor, to 22 June | [Hundred Days](https://en.wikipedia.org/wiki/Hundred_Days), Napoleon's infobox |
| Taiping Heavenly Kingdom (China) | 1851–1864 | its own name | Hong Xiuquan, Heavenly King | [Taiping Heavenly Kingdom](https://en.wikipedia.org/wiki/Taiping_Heavenly_Kingdom) |
| Nanjing government (China) | 30 March 1940 – 16 August 1945 | "Japanese puppet government", official name beneath (PRD §7.3) | Wang Jingwei, then Chen Gongbo | [Wang Jingwei regime](https://en.wikipedia.org/wiki/Wang_Jingwei_regime): "puppet government of the Empire of Japan" |
| Manchukuo (China) | 1932–1945 | "Japanese puppet state" | Puyi, Chief Executive, then Emperor from 1934 | [Manchukuo](https://en.wikipedia.org/wiki/Manchukuo): "a puppet state of the Empire of Japan" |

- **Manchukuo was not covered.** It is added the same way as the Nanjing government, with its two prime ministers and its flag.
- **The Hundred Days begins and ends within 1815.** A rival period may now have the same start and end year, as an office term may. The First French Empire's end moves to 1815 to hold it; its place in the lane still ends in 1814.
- **Persian wording.** «دولت دست‌نشاندهٔ ژاپن» follows fa.wikipedia, which calls both «دولت دست‌نشانده». The Persian of the notes, of "Heavenly King" and "Chief Executive", and of three titles for the restored French heads is my translation. Three people have no fa.wikipedia article and are transliterated in `data/overrides/persian-names.json`: Louis-Jules Trochu, Hong Xiuquan, Zheng Xiaoxu. All of these are for your review. The kingdom's name, «پادشاهی آسمانی تایپینگ», is confirmed.

### Gaps: 58 became 44

Sixteen recorded vacancies are in `data/policy/coverage-exceptions.json`, each with its source:

- **The office did not exist yet** (14): no head of government before the Imperial Cabinet of 8 May 1911 (Qing), the Prime Minister of Japan of 22 December 1885, the Council of Ministers of 6 November 1905 (Russia), the Soviet Council of People's Commissars of 6 July 1923, the Prime Minister of India of 15 August 1947 (Company rule, the Raj), the chancellorship of 1 July 1867 (the four German states before it) and the President of the Council of 9 July 1815 (France to 1814). Each date is the "formation" field of the office's English Wikipedia article.
- **Allied-occupied Germany** (2): no head of state or government under military occupation.

The Nanjing government and Manchukuo came with their heads of government and flags, so they add no gaps. The Taiping kingdom adds two (head of government, flag).

The 44 that remain are in [completeness.md](completeness.md). They are left for the next pull request, as you set out: rulers entered from Wikipedia list articles, and a "no documented flag" status in place of a source for absence.

## Round 3: closing the gaps (the pull request after this one)

The 44 open gaps became 1. Eight of nine lanes are complete for 1800 to today.

### Office-holders entered from list articles

71 terms for 46 new people and 11 already in the data. Each term cites the list or article it was read from.

| Country | What was entered | Source |
| --- | --- | --- |
| France | Presidents of the Council 1815–1830 (Talleyrand to Polignac), 1848–1851 (Barrot, Hautpoul, Faucher), Dufaure 1871–1873, de Gaulle as Chairman of the Provisional Government 1944–1946 | [List of prime ministers of France](https://en.wikipedia.org/wiki/List_of_prime_ministers_of_France) |
| Iran | Grand viziers from Hajji Ebrahim Shirazi (1794) to Mirza Yusuf Ashtiani (1886), and Amin al-Soltan's acting years 1886–1888 | [List of grand viziers of Persia](https://en.wikipedia.org/wiki/List_of_grand_viziers_of_Persia) |
| Iran | Prime ministers of 1907–1911 that were missing: Moshir al-Saltaneh, Naser ol-Molk, Tonekaboni | [List of prime ministers of Iran](https://en.wikipedia.org/wiki/List_of_prime_ministers_of_Iran) |
| China | Premiers of the Republic 1915–1926, 18 terms | [List of premiers of the Republic of China](https://en.wikipedia.org/wiki/List_of_premiers_of_the_Republic_of_China) |
| China | Heads of the Guangzhou governments 1917–1926: Sun Yat-sen, Cen Chunxuan, Hu Hanmin, Wang Jingwei | The infoboxes of the three governments' articles, and Wang Jingwei's |
| Turkey | Âli Pasha's fifth term 1867–1871, Ahmed Cevad Pasha 1891–1895 | [List of Ottoman grand viziers](https://en.wikipedia.org/wiki/List_of_Ottoman_grand_viziers) |
| Turkey | Fevzi Çakmak 1921–1922 and Rauf Orbay 1922–1923, Ankara government | [List of prime ministers of Turkey](https://en.wikipedia.org/wiki/List_of_prime_ministers_of_Turkey) |
| Germany | Heads of the presiding power of the German Confederation: Francis I 1815–1835, Ferdinand I 1835–1848, Franz Joseph I 1850–1866 | [German Confederation](https://en.wikipedia.org/wiki/German_Confederation), infobox |
| India | Chhatrapatis Shahu II (to 1808) and Pratap Singh (1808–1818); Peshwa Baji Rao II (1796–1802, 1803–1818) | Their articles' infoboxes, and [Peshwa](https://en.wikipedia.org/wiki/Peshwa) |
| India | Daulat Rao Shinde, the last entry in the list of Mughal grand viziers, 1794–1803 | [List of Mughal grand viziers](https://en.wikipedia.org/wiki/List_of_Mughal_grand_viziers) |

R3 applied as before: the lists' acting holders of under a year are not entered where someone else covers the year (the Republic of China's acting premiers of 1917–1926, Sa'd al-Dowleh in Iran in 1909).

**Confirmed by the audit.** The audit now also reads a list's table row: the full name followed by the start year and then the end year, with no other year between. It confirmed 29 of the new terms that way and the rest by the existing checks. Eight it could not confirm by itself, because the list spells the name differently ("Asef od-Dowleh", "Jean-Joseph, Marquis Dessolles") or gives the term in two or more rows; each was read by hand and is recorded, with the row's wording, in `data/policy/audit-exceptions.json`.

### "No documented flag"

A new record, `noFlag`, with the status `no-documented-flag` (data rule R9, PRD §7.7). It needs no source. 16 are entered, for exactly the years where the data has no flag:

Qing to 1862 · Taiping kingdom · Guangzhou government 1925–1928 · Confederation of the Rhine · German Confederation · North German Confederation 1866 · Weimar Republic 1918 · Allied-occupied Germany 1945 · Company rule to 1801 · Mughal Empire · British Raj to 1880 · Qajar Iran to 1907 · Tokugawa shogunate · Empire of Japan to 1870 · Russian SFSR 1917 · Ottoman Empire to 1844.

For five of these the state's article has an empty flag field (Taiping, the German Confederation, the Confederation of the Rhine, Company rule, the Mughal Empire). The site does not show the status yet; that is display work.

Two flags were added where an article does show one: the Guangzhou government flies the five-coloured flag for 1917–1921 and the Republic's flag for 1921–1925, as the infoboxes of its governments give them.

### Recorded vacancies: 16 became 27

| State | Missing | Years | What the source says |
| --- | --- | --- | --- |
| Qajar Iran | head of government | 1863–1864 | The list: "The office was vacant", late 1862 to 23 March 1865 |
| Second French Empire | head of government | 1852–1869 | The list: "Position vacant (absolute rule by Napoleon III)" |
| Free France | head of government | 1940–1943 | The infobox lists only the Chairman of the National Committee, de Gaulle |
| Holy Roman Empire | capital | 1800–1805 | The infobox gives the capital as "Multiple" |
| German Confederation | head of state | 1849 | The infobox lists nobody between 1848 and 1850 |
| North German Confederation | head of state | 1866 | The President is listed from 1867 |
| Weimar Republic | head of state | 1918 | The presidency was created on 11 February 1919 |
| Company rule in India | head of state | 1800–1857 | The infobox lists only the Governor-General |
| Mughal Empire | head of government | 1804–1856 | The list of grand viziers ends in 1803 |
| Guangzhou government | head of government | 1917–1927 | Its governments' infoboxes list only a leader |
| Taiping Heavenly Kingdom | head of government | 1851–1863 | The infobox lists the Heavenly King and subordinate kings |

Free France's capital is entered as "London (de facto, to 1942), then Algiers", from its infobox.

### Escalated

- **Not sourced: who headed the Guangzhou government in 1927.** Wang Jingwei's infobox gives him as Chairman of the National Government Committee until 23 March 1926; Tan Yankai's begins on 7 February 1928. Nothing I read states who held it between. It is the one open gap.
- **Sources disagree: the last Mughal grand vizier.** The list of grand viziers ends with Daulat Rao Shinde, 1794–1803. The Mughal Empire's infobox ends the grand viziers with Asaf-ud-Daula in 1797 and names Shinde as Vicegerent, 1794–1818. The list is followed, as you asked for list articles.
- **A label to confirm: Company rule has no head of state.** The vacancy follows the infobox, but it is a statement about sovereignty.

### Persian wording for review

- 25 people have no fa.wikipedia article and no Persian label on Wikidata. They are transliterated in `data/overrides/persian-names.json`: the eight French presidents of the council, the four Indian office-holders, Ahmed Cevad Pasha, and twelve Chinese premiers.
- New titles are my translation: «کفیل صدارت» (Acting Grand Vizier), «رئیس‌الوزرا» (Chief Minister), «رئیس شورای دولت» (Head of the State Council), «چهاتراپاتی», «پیشوا», «وزیر اعظم» (Mughal Grand Vizier), «رئیس قدرت ریاست‌کننده (امپراتور اتریش)», «فرمانده کل» (Generalissimo), «رئیس هیئت رئیسه», «فرمانده کل ارتش و نیروی دریایی», «رئیس دولت ملی».
- Francis I of Austria appears under the name the data already has for him, "Francis II", his number as Holy Roman Emperor.

## Round 4: your decisions on the three escalations (the third pull request)

All nine lanes are now complete: 0 open gaps.

### Guangzhou government ends in 1926

The sources do show when the Nationalist government left Guangzhou: [Wuhan government of the Republic of China](https://en.wikipedia.org/wiki/Wuhan_government_of_the_Republic_of_China) says "the Nationalist government based in Guangzhou moved there in December 1926". So the state and its rival period now end in 1926 (exact end December 1926), not 1928, and the "1927 head of state" gap no longer exists. Nothing is named for 1927 from memory.

- Wang Jingwei's term as Chairman of the National Government Committee (1 July 1925 – 23 March 1926) is the last entry. His infobox gives no successor until Tan Yankai in 1928, and by then the government sat in Wuhan and Nanjing.
- The "no documented flag" record and the head-of-government vacancy of the Guangzhou government end in 1926 too.
- The period's note now says the government moved to Wuhan in December 1926.
- **Not entered:** the Wuhan government itself (5 December 1926 – 21 September 1927), a rival to Nanjing. Its article gives dates and leaders, so it can be added as a rival period in the next China pass; it was not part of this decision.

### Mughal grand vizier: the list is kept, with a note (PRD §7.4)

Daulat Rao Shinde stays as Grand Vizier 1794–1803, from the list of grand viziers. The term now carries a `note`: the infobox of the Mughal Empire ends the office with Asaf-ud-Daula in 1797 and lists Daulat Rao Shinde as Vicegerent, 1794–1818. The infobox article is cited on the term too. This needs one schema change: an office term may now carry an optional `note` in both languages, for any term where sources disagree.

### Company rule in India: no head of state, confirmed, with a note

The vacancy stands. The period's note states the ambiguity, from two articles it cites: [Mughal Empire](https://en.wikipedia.org/wiki/Mughal_Empire) ("lip service continued to be paid to the Mughal Emperor as the highest manifestation of sovereignty") and [British East India Company](https://en.wikipedia.org/wiki/British_East_India_Company) (the Law Officers' Pratt–Yorke opinion of 1757, that the Crown of Great Britain enjoyed sovereignty over the Company's acquisitions).

The Persian of the three notes is my translation, for your review.

## The audit gate

`pnpm data:audit` now separates open rows from closed ones. A row closes only by a correction or a recorded exception: a term checked by hand or confirmed by its cited source, a holder left out by rule, a Persian name recorded in the overrides. Open rows go to [audit.csv](audit.csv); closed rows, with what closed each, to [audit-closed.csv](audit-closed.csv).

The audit needs the network (it fetches every source), so CI does not repeat it. CI runs `pnpm data:audit --check`, which fails unless the audit was run on exactly the data now committed and left no open row. Any change to the data therefore needs a fresh audit before it can merge.

What the gate found on its first run: 16 open rows. Twelve were state names you had confirmed, now recorded as such. Two terms (Bismarck 1867–1890, Demirel 1975–1978) were checked against their infoboxes and recorded. Walter Scheel's removal under R3 is recorded. And one was a real error, corrected: **Yikuang's term as Prime Minister of the Imperial Cabinet ran from 8 May to 1 November 1911**, not to 1912; Yuan Shikai succeeded him. The audit now has 0 open rows and 248 closed.

## A bug found on the way

The Wikidata query service drops the half-space (zero-width non-joiner) from every name it returns. The old heads-of-government script read names that way, which is why names such as «احمدی‌نژاد» and «مک‌دونالد» were stored without it. The pipeline now reads names from the entity API, which keeps it.

## Ten decisions to spot-check

| # | Country | Record | Before | After | Basis |
| --- | --- | --- | --- | --- | --- |
| 1 | Iran | Seyd Morad Khan, Zand ruler | not in the data | 1789, rival Zand period | [en.wikipedia](https://en.wikipedia.org/wiki/Seyd_Morad_Khan): reign 23 January – 10 May 1789 |
| 2 | Turkey | Abdul Hamid I, Sultan | not in the data | 1774–1789 | [en.wikipedia](https://en.wikipedia.org/wiki/Abdul_Hamid_I): reign to 7 April 1789 |
| 3 | France | Louis-Jules Trochu | not in the data | 1870–1871, President of the Government of National Defence | Nobody else covers 1870, so R3 keeps him |
| 4 | Germany | Walter Scheel, Chancellor | 1974 | removed | Acting for nine days in May 1974; Brandt and Schmidt cover the year |
| 5 | Japan | Fumimaro Konoe, Persian name | کیسوکه اوکادا | فومیمارو کونوئه | The old value was another prime minister's name |
| 6 | Iran | Fath-Ali Shah, Persian name | فتحعلی‌شاه قاجار | kept; the fa.wikipedia title is «فتحعلی‌شاه» | The dynasty is part of the common name; the same for five other Qajar shahs |
| 7 | Germany | Leopold II, Persian name | لئوپولد دوم | kept | The fa.wikipedia title is «لئوپولد دوم، امپراتور مقدس روم» |
| 8 | China | Nanjing government, 1940–1945 | not in the data | rival period, "Japanese puppet government" | Infobox status: "puppet government of the Empire of Japan" |
| 9 | China | President of the Republic of China | found, not used | used until 1949 | Later holders served on Taiwan |
| 10 | Japan | Tokugawa shogunate, end | 1868 | kept; Wikidata says 1867 | [en.wikipedia](https://en.wikipedia.org/wiki/Tokugawa_shogunate) infobox: 1603–1868, and it meets the Empire's start |
