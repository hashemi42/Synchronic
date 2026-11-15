# Data modelling rules (draft, not applied)

**Status: proposed.** Nothing here has changed the data or the audit yet. Each rule says what it would do and which rows of [the audit](../artifacts/data-review/audit.csv) it resolves. Approve, change or reject each one; then I apply the approved ones and rerun `pnpm data:audit`.

The audit raised **7 high rows** (years differ by more than one) and **48 rows where Wikidata has a holder we don't**. Every one of them is covered below:

| Rule | High rows | "Wikidata has a holder we don't" |
| --- | ---: | ---: |
| R1 One term per state and title | 6 | — |
| R2 De facto head of state | (1, with R1) | (2, with R4) |
| R3 Acting and interim holders | — | 15 |
| R4 Party leader and formal head of state | — | 13 |
| R5 Representatives are not heads of state | — | 2 |
| R6 Regional offices leave the lane | — | 13 |
| R7 No head of government before a cabinet existed | — | 2 |
| R8 Iran's presidency, 1980–1989 | — | 2 |
| A1 Audit: P39 offices only in their own years | 1 | — |
| E2 Data error: missing term | — | 1 |
| **Total** | **7** | **48** |

The audit also turned up three outright data errors (E1–E3, at the end), which need fixing whatever is decided about the rules.

---

## R1. One term per state and title

**Rule.** When a person heads successive states of the same lane, each state and title is its own term: "First Consul of the French Republic, 1799–1804" and "Emperor of the French, 1804–1814" are two terms, not one 1799–1814 term. The data already stores them this way. The change is to the **audit**: it should compare each piece with the matching state's Wikidata item, instead of joining them first. Joining stays for pieces with the *same* title (cabinets, or George III across 1801).

**Resolves (high):**

| Person | Ours (joined) | Wikidata | Pieces in our data |
| --- | --- | --- | --- |
| Napoleon | 1799–1814 | 1804–1814 (P35 on the First Empire) | First Consul 1799–1804 · Emperor 1804–1814 |
| Napoleon III | 1848–1870 | 1852–1870 (P35 on the Second Empire) | President 1848–1852 · Emperor 1852–1870 |
| Wilhelm I | 1867–1888 | 1871–1888 (P35 on the German Empire) | President of the North German Confederation 1867–1871 · Emperor 1871–1888 |
| George VI (India) | 1936–1950 | 1947–1950 (P35 on the Dominion of India) | Emperor of India 1936–1947 · King of India 1947–1950 |
| Vladimir Lenin | 1917–1924 | 1922–1924 (P6 on the USSR) | Chairman of Sovnarkom of the RSFSR 1917–1924 · of the USSR 1923–1924 |
| Mustafa Kemal Atatürk | 1920–1938 | 1923–1938 (P35 on Turkey) | Speaker of the Grand National Assembly 1920–1923 (see R2) · President 1923–1938 |

After the change, the earlier pieces are compared on their own; where Wikidata has no statement for them (Lenin in the RSFSR, Atatürk in Ankara), they fall to the source check, which already confirms most such rows.

## R2. De facto head of state

**Rule.** Where a state had no formal head-of-state office, or it was vacant or abolished, record the person who exercised its functions, with a title that says how (for example "Speaker of the Grand National Assembly (de facto head of state)"), and cite a source that says so.

**Applies to:** Atatürk in the Ankara government, 1920–1923 (already in the data; only the title gains "de facto"); and, with R4, China's chairmen of the NPC Standing Committee while the state chairmanship was abolished (Zhu De 1975–1976, Ye Jianying 1978–1983).

## R3. Acting and interim holders

**Rule.** Leave out a person who only filled a vacancy (acting, interim, ad interim) for **less than a year**, unless the constitution made them head of state in their own right. Keep acting holders who served a year or more, with "Acting" in the title.

**Resolves — left out (14):** Alain Poher (France 1969), Horst Seehofer (Germany 2012), Jens Böhrnsen (Germany 2010), Karl Arnold (Germany 1949), Basappa Danappa Jatti (India 1977), Mohammad Hidayatullah (India 1969), Abdülhalik Renda (Turkey 1938), Hüsamettin Cindoruk (Turkey 1993), İbrahim Şevki Atasagun (Turkey 1966), İhsan Sabri Çağlayangil (Turkey 1980), Tekin Arıburun (Turkey 1973), Vasily Kuznetsov (USSR 1984 and 1985), Ivan Silayev (USSR 1991), Erdal İnönü (Turkey, acting prime minister 1993).

**Resolves — kept (1):** Sabine Bergmann-Pohl (GDR, April–October 1990). As President of the Volkskammer she was the GDR's head of state after the Council of State was abolished, not a stand-in.

**Would also change existing data:** Andrey Belousov (Russia, acting prime minister for a few weeks in 2020) would be removed.

## R4. Party leader and formal head of state

**Rule.** In one-party states the ruler row keeps the party leader (office `leader`: "Soviet leader", "Paramount leader"), as now. **In addition**, record the formal head of state (USSR: Chairman of the Presidium of the Supreme Soviet; PRC: Chairman, later President) as `head-of-state` terms. The politics card then shows both, "Leader" and "Head of state", instead of only the leader. This needs a small change to the card and the lane model.

**Resolves (13):**

- **USSR (6):** Mikhail Kalinin 1922–1946, Nikolai Shvernik 1946–1953, Kliment Voroshilov 1953–1960, Anastas Mikoyan 1964–1965, Mykola Pidhornyi 1965–1977, Andrei Gromyko 1985–1988. (Kuznetsov is under R3.)
- **PRC (7):** Liu Shaoqi 1959–1968, Li Xiannian 1983–1988, Yang Shangkun 1988–1993; Zhu De 1975–1976 and Ye Jianying 1978–1983 (with R2); **Dong Biwu and Soong Ching-ling**, whom Wikidata lists as joint acting chairs 1968–1975. Sources usually give Dong Biwu alone, as acting chairman 1972–1975. **This pair needs a human decision.**

**Would also add:** formal head-of-state terms for leaders who held the post themselves (Mao 1949–1959, Brezhnev 1977–1982, Andropov 1983–1984, Chernenko 1984–1985, Gorbachev 1988–1991, Jiang Zemin 1993–2003, Hu Jintao, Xi Jinping). This also clears the 12 low rows "leader's years differ from a P35/P6 office".

## R5. Representatives are not heads of state

**Rule.** Governors-general and viceroys represent the monarch; the monarch is the head of state. They are not recorded as heads of state. A later "Representative" line on the card could show them.

**Resolves (2):** Louis Mountbatten (Governor-General of India, 1947–1948), C. Rajagopalachari (Governor-General of India, 1948–1950). George VI stays head of state.

## R6. Regional offices leave the lane

**Rule.** A lane records the offices of the state that holds it. From 1922 Russia's lane is the Soviet Union, so offices of the RSFSR, by then one of its republics, are regional and are not recorded.

**Resolves (13), all Chairmen of the Council of People's Commissars / Ministers of the RSFSR:** Sergei Syrtsov 1929–1930, Daniil Sulimov 1930–1937, Vasily Vakhrushev 1939–1940, Ivan Khokhlov 1940–1943, Boris Chernousov 1949–1952, Alexander Puzanov 1952–1956, Mikhail Yasnov 1956–1957, Frol Kozlov 1957–1958, Dmitry Polyansky 1958–1962, Gennady Voronov 1962–1971, Mikhail Solomentsev 1971–1983, Vitaly Vorotnikov 1983–1988, Alexander Vlasov 1988–1990.

## R7. No head of government before a cabinet existed

**Rule.** Record a head of government only where an office led a cabinet. In the Russian Empire that begins with the Council of Ministers in 1905 (Witte). Earlier chairmen of the Committee of Ministers or the State Council are not recorded.

**Resolves (2):** Nikolay Rumyantsev (1810–1812), and Ivan Shcheglovitov (1917), who was Chairman of the State Council, not of the Council of Ministers. The latter is an error in Wikidata.

## R8. Iran's presidency, 1980–1989

**Rule.** From 1979 the Supreme Leader is Iran's head of state, and until 1989 the Prime Minister was head of government. The President in those years was neither, so the presidency is not recorded as either office. From 1989 the President is head of government, as now. A later "Other offices" line on the card could show the 1980–1989 presidents.

**Resolves (2):** Abolhassan Banisadr (1980–1981) and Ali Khamenei (1981–1989), whom Wikidata lists as heads of government (P6) of Iran.

## A1. Audit: P39 offices only in their own years

**Rule (audit only).** When the audit falls back to P39, use each office only for the years in which it was the head of government. The merge script already knows these years: Turkey's presidency counts from 2018 and Iran's from 1989. Today the audit matches Cemal Gürsel's prime ministership (1960–1961) against his presidency (1960–1966).

**Resolves (1, high):** Cemal Gürsel.

---

## Data errors found (fix regardless of the rules)

- **E1. Ata'ollah Mohajerani is not a prime minister of Iran.** The data has him as Prime Minister 1985–1989, overlapping Mir-Hossein Mousavi. The only source is his Wikidata item, which carries a wrong "position held" statement. Fix: remove the term and add him to the merge script's exclusion list.
- **E2. Valentin Pavlov is missing.** He was Premier of the Soviet Union from January to August 1991; Nikolai Ryzhkov's term should end in January 1991. (Resolves the remaining "Wikidata has a holder we don't" row.)
- **E3. Russia, 2020.** Besides Belousov (R3), the data has a separate "Dmitry Medvedev 2020–2020" piece, though Medvedev resigned in January 2020. It should be checked and probably joined into his 2012–2020 term.
