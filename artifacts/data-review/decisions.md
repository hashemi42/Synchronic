# Review decisions: replacing the nine country files

Decided on 2026-11-17 in two rounds: first under the rules given for the review, then under the answers to the seven questions it raised. Every change to the data the site shows is a row in [replacement.csv](replacement.csv), before and after.

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
