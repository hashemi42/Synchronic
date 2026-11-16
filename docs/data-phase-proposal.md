# Data phase: proposed schema and country list

**Status: approved on 2026-11-16.** Covers step 1 (schema for every entity), the outline of step 2 (the Wikidata pipeline) and the country list for step 3. The decisions, numbered **D1–D11**, and their outcomes are at the end. The schema changes are applied to `schema.ts` with the step that first needs them, not all at once.

**Basis.** PRD §6 (data model and pipeline), §7 (content policy) and §11 (licences, CI), checked against [src/lib/data/schema.ts](../src/lib/data/schema.ts). Field names follow the PRD. Every place this proposal departs from the PRD is listed in [section 8](#8-where-this-departs-from-the-prd), so each can be accepted as a PRD edit or dropped.

## Where the data stands (v0.1.0)

| | |
| --- | --- |
| Countries | 9, each 1789–today: Iran, UK, Russia, Turkey, France, Germany, China, India, Japan |
| Records | 50 states, 627 people, 901 office terms, 60 flags |
| Relations, events, borders, narratives | none |
| Audit rows | 234: 107 Persian names (18 differ from Wikidata, 89 have no Wikidata label), 127 low rows on terms |
| How it was made | Heads of government fetched from Wikidata and merged by script; states, lanes, heads of state and flags entered by hand |

Two things in that table conflict with the definition of done and shape the proposal:

- **"Zero open audit rows" needs a meaning for "open".** Today the audit lists 127 low rows that are already confirmed against a source; they stay in the CSV for ever. See D1.
- **"100% sourced" is met on paper only.** 1,091 of the roughly 1,700 citations are the record's own Wikidata item page, which is where the one outright error so far came from (Mohajerani, a statement "imported from Wikimedia project"). See D2.

## 1. Conventions that apply to every entity

Kept as they are: integer years, BCE negative, no year 0, half-open ranges, `end: null` for current, `circa`, both languages required, `sources[]` required.

Changes:

| Change | Why |
| --- | --- |
| **Optional exact date beside the year.** `exactStart` / `exactEnd` / `exactDate` as `"1919-06-28"` or `"1919-06"`, CE only, and it must agree with the year field. The PRD's `start`, `end` and `date` stay integer years and stay the fields all range logic uses. | Treaties and events have dates. Terms within one year need an order (Iran had three presidents in 1981). Wikidata supplies the precision, so the pipeline fills it at no cost. |
| **`wikidata` required** on states, people, relations and events. A record without an item is listed, with the reason, in `data/policy/audit-exceptions.json`. | The pipeline and the audit key on it. Today every person has one and one state does not. |
| **A second source beside Wikidata** on every term, relation and event: a page the audit can fetch and that states the years (D2). | Makes "100% sourced" checkable by machine. Stricter than PRD §7.8. |
| **State ids unique across all files**, checked by validation. | Border features carry `state` ids (PRD §6.1), and `ruled-by` points across files. Today ids are only unique within a file. |

## 2. Entities inside a country file

`Country` and `Person` keep their shape. Changes to the rest:

### Narrative (PRD §6.1, for PO-5)

```ts
Narrative {
  country: Id
  period: { start: Year; end: Year | null }
  label: Localized
  text: { en: string; fa: string; local?: string }
  sources: Source[]
}
```

Kept exactly as the PRD and `schema.ts` have it, in the country file's `narratives[]`, curated only (overrides; the pipeline never writes it). No country has one yet. It is not part of the "complete" definition (D10), because the PRD puts "How \<country> tells it" (PO-5) after the MVP and content policy §7.5 leaves it to contributors from that country.

### LanePeriod: a fifth kind, `ruled-by`

```ts
kind: "state" | "rival" | "parallel" | "occupation" | "no-state" | "ruled-by"
/** Only for `ruled-by`: the state of another country's file that governed this one. */
ruler?: { country: Id; state: Id }
```

### LanePeriod: `parallel`, beside `rival` (D8)

The two kinds say different things, and today `rival` is used for both:

| Kind | Meaning | Examples |
| --- | --- | --- |
| `rival` | A government that contested the same state | Guangzhou government 1917–1928; the Mughal emperor under Company rule |
| `parallel` | A second state on the same land, existing in its own right | DPRK from 1948; East Germany 1949–1990 |

Validation treats both alike (they may overlap the main sequence). The difference is the wording: the badge and the list it opens say "parallel state" / «دولت هم‌زمان» for `parallel` and keep "rival government" for `rival`. Which state holds the main sequence is still a choice the lane has to make; `parallel` only stops the data from calling the other one a rival. East Germany moves to `parallel` in the same PR that adds the kind (batch 4, with Korea), since it needs two UI strings.

Many of the next 21 countries were governed directly by another lane's state for part of 1800–today, with no polity of their own: Iraq and the Hejaz as Ottoman provinces, Armenia and Azerbaijan as governorates of the Russian Empire, Pakistan under the Raj, Mexico under Spain and Brazil under Portugal until the 1820s. Today's schema would force each file to copy the ruling state and all its office terms. `ruled-by` points at them instead, with its own `label` ("Ottoman Iraq") and sources. Validation then has to resolve references across files, which it does not do today.

`ruled-by` is only for land that had no polity of its own. An entity with its own government and Wikidata item stays a state in the country's own file: the British Raj (as now), the Dutch East Indies, Mandatory Iraq, the Armenian SSR. Whether such a period is `state` or `occupation`, and what its primary label is, follows content policy §7.3, as in the PRD's Lithuanian SSR example.

### State

No new fields. `wikidata` becomes required (above).

### OfficeTerm

```ts
exactStart?: PartialDate
exactEnd?: PartialDate
/** Dates come from tradition, not from a contemporary record (step 6). */
traditional?: boolean
```

`traditional` is for the extension to 500 BCE: Japan's early emperors, the first Roman consuls. It is shown the way `circa` is. Adding it now avoids a second schema change in step 6.

### Flag

```ts
licenseUrl: string        // required unless the licence is public domain or CC0
sha1: string              // of the file as mirrored
retrieved: string         // date the file and its licence were read from Commons
```

Plus two rules in the audit rather than the schema:

- **Licence allowlist:** public domain, CC0, CC BY, CC BY-SA. Anything else is an audit row.
- **Coverage:** every year of every `state`, `rival` and `occupation` period has a flag, or the state is listed in `data/policy/` as having none, with a reason.

`sha1` is there because a Commons file can be overwritten under the same name; the record should describe the file the site serves.

## 3. Relation (cross-country, its own file)

```ts
Relation {
  id: Id
  type: "treaty" | "war" | "alliance" | "union" | "partition"
  name: Localized
  date?: Year               // either `date` (a treaty) or `start`/`end` (a war), as in the PRD
  start?: Year
  end?: Year | null
  exactDate?, exactStart?, exactEnd?: PartialDate
  parties: Party[]          // at least two with different `country`
  wikidata: WikidataId
  sources: Source[]
}

Party {
  country: Id               // the lane
  state?: Id                // set only when the lane has a rival that year
  as?: Localized            // the actor, when it is not the lane's state: "Prussia", "Sardinia"
  side?: 1 | 2              // wars and partitions: who stood with whom
  start?, end?: Year        // when this party joined and left, if not the whole span
}
```

Differences from the current sketch in `schema.ts`:

- **Parties are countries, not bare ids.** The card's "Links to your lanes" works on lanes; the state follows from the year.
- **`side`** is what lets the card say "at war with" instead of "in the same war as". Wikidata's participant lists carry no sides, so sides come from an override citing the war's Wikipedia infobox. That is the main manual cost of step 4.
- **Per-party years** cover late entry and changed sides (the United States in 1941; Italy in 1943 as two entries).
- **`as`** covers actors that hold no lane: the partitions of Poland were made by Prussia, not by the Holy Roman Empire that holds Germany's lane.
- **`alliance`** added (Triple Entente, Axis, NATO, Warsaw Pact).

**Scope rule (D5):** a relation needs at least two covered countries. A war with one covered party (Iran–Iraq before Iraq is added) is recorded as an event on that lane and becomes a relation when the second country arrives.

## 4. Event (cross-country, its own file)

```ts
HistoricalEvent {
  id: Id
  name: Localized
  kind: "revolution" | "coup" | "uprising" | "battle" | "assassination"
      | "constitution" | "independence" | "founding" | "disaster" | "other"
  date: Year
  end?: Year                // multi-year events: the Constitutional Revolution, 1905–1911
  exactDate?: PartialDate
  countries: Id[]           // at least one
  place: { lat: number; lon: number; name: Localized } | null
  relation?: Id             // a battle's war
  tier: 1 | 2 | 3
  wikidata: WikidataId
  sources: Source[]
}
```

- **`place` is required and may be `null`.** `null` means "checked: no single place" (a constitution, a famine). A missing key fails validation, so no event skips the check by accident.
- **`tier`** decides which dots show at which zoom. It is computed, not judged (D6).
- **`countries`**, not the PRD's `states[]`. Lanes are countries, and a state can sit in several lanes: a battle in the Balkans is an Ottoman event, but it belongs on Turkey's lane and not on the lane of Ottoman-ruled Iraq. The state follows from the country and the year, so the map loses nothing.
- **`kind`** is mapped from Wikidata's "instance of" by a table in the pipeline.

**Inclusion rule (D6):** an event is included when its Wikidata item has both an English and a Persian Wikipedia article, belongs to one of the kinds above, and its count of Wikipedia language editions passes a threshold. Tiers are bands of the same count. The threshold is tuned on the nine current countries in step 4, aiming at roughly 40–60 events per country for 1800–today. This keeps selection out of anyone's memory or taste; overrides can add or remove an event with a reason.

## 5. Border snapshot (provisional until the step 5 spike)

The PRD settles the model: world snapshots at fixed years, with the nearest one shown and its year selectable (MA-2), features carrying `state` ids (§6.1), and "Historical basemaps" as the intended source with its licence unconfirmed. `schema.ts` has no such entity yet. The PRD's `year` and features are kept; the rest is the metadata needed to state a licence per snapshot (§11) and to re-import a new version:

```ts
BorderSnapshot {
  id: Id
  year: Year                // the year the geometry depicts
  file: string              // GeoJSON or TopoJSON under data/borders/
  dataset: { name: string; version: string; url: string }
  license: string
  licenseUrl: string
  attribution: string
  simplified?: string       // tolerance applied, if any
  sources: Source[]
}
// each feature's properties
{ country: Id | null; state: Id | null; name: Localized; disputed?: boolean }
```

A curated table maps the dataset's feature names to our state ids, so a new dataset version can be re-imported. Maps show states that hold no lane (Prussia, Hanover); those features get `state: null` and a name, not a new state record.

The spike's first question is the licence of Historical basemaps, which I have not checked and will not assume. Curated data is CC BY-SA 4.0, so a non-commercial or copyleft-software licence on the borders would need a separate decision, and a second candidate should be compared in the same spike.

## 6. Layout and pipeline (step 2, outline)

The PRD's three places are kept (§6.3, §11), so the licence split by directory still holds:

```
data/raw/<country>/                   cached SPARQL responses, with the query and the fetch time      CC0
data/overrides/countries/<country>.json   curated only: Wikidata ids of the country, its states and    CC BY-SA
                                      offices; the lane; and patches (add / replace / remove,
                                      keyed by Wikidata id, each with a source and a reason)
data/overrides/relations.json, events.json   patches for the cross-country sets                      CC BY-SA
data/policy/                          exceptions and withheld lists, as now
data/merged/                          pipeline output, committed so a refresh is a reviewable diff (§6.3 step 6)
public/data/                          emitted for the site by the build, as now
```

Stages, as PRD §6.3: **fetch** (states, people, P35/P6 on states, P39 on offices, flags, labels and Wikipedia titles in both languages) → **normalize** into the schema, applying R1–R8 as code → **merge** overrides, which always win → **validate and audit**, failing CI on any open row → **emit**.

The change from today is that `data/overrides/countries/*.json` stops holding whole records typed by hand. Those files shrink to the lane, the Wikidata ids and sourced patches; full records exist only as pipeline output. `data/merged/` is new and needs a line in `DATA_LICENSE`.

Emitting by century (§6.3 step 5, NF-2) and the search index are left as they are; the build emits by country today, and changing that is display work.

**"Complete lane" needs a definition (D10).** The PRD measures the 30 and the 10 by a "data validation report" that does not exist yet. Proposed: a country is complete for a range when every year has a lane period, and every `state`, `rival` and `occupation` year has a head of state or leader (or a recorded vacancy), a head of government where the office existed (R7), a capital, a system and a flag (or a recorded reason for none), in both languages, with no open audit row. Step 2 adds the report, and each batch PR is gated on it.

**Run on the nine countries, the pipeline reports** every record as *same*, *differs* (by field), *only in the hand-entered data* or *only in the pipeline*. Each difference ends as a correction or as an override with a source. You get that report before any country file is replaced.

**What Wikidata cannot supply.** Which state holds a lane in which years is an editorial choice, and 86 current terms are missing from Wikidata altogether. "No data from memory" therefore means: every value that does not come from a Wikidata statement is an override with a cited page, and the audit fetches that page and confirms the years. Lane configs for new countries are drafted from Wikidata's "replaces / replaced by" chain and checked the same way.

**Persian names.** Order: fa.wikipedia title → Wikidata Persian label → transliteration. You are sent only (a) names with no fa.wikipedia article, (b) titles that are a description or carry a disambiguation suffix, and (c) titles that contradict an official name you already confirmed (D4).

## 7. Countries

### The next 21

Chosen for: weight in the history the current nine already touch, Iran's neighbours, every inhabited continent, and enough former metropoles that `ruled-by` always has a covered lane to point at. Ordered so the easiest data comes first and tests the pipeline.

| Batch | Countries | Hard part |
| --- | --- | --- |
| 1 | United States, Italy, Spain, Austria, Greece | Italy before 1861 (several states: which holds the lane); Austria across 1804, 1867, 1918, 1938; Greece before 1830 (`ruled-by` the Ottomans) |
| 2 | Afghanistan, Iraq, Egypt, Saudi Arabia, Pakistan | Iraq and the Hejaz under the Ottomans; Egypt's status 1805–1922; Pakistan before 1947 points at India's lane |
| 3 | Armenia, Azerbaijan, Uzbekistan, Tajikistan, Lithuania, Poland | All six were under the Russian Empire and five were Soviet republics, so one PR settles how those years are modelled and labelled (§7.3; the PRD's Lithuania example is the pattern). Poland and Lithuania 1795–1918; Bukhara, Khiva and Kokand before the Russian conquest |
| 4 | Korea, Indonesia, Brazil, Mexico, Ethiopia | Korea after 1948 (D8, the `parallel` kind); Brazil and Mexico before independence |

That is 5 + 5 + 6 + 5. Batch 3 is the six because they share one modelling question.

Changed from the first draft at your request: Lithuania, Uzbekistan and Tajikistan are in; Portugal, Nigeria and the Netherlands are out. The Netherlands was my choice to drop: it was there mainly so Indonesia's colonial years had a lane to point at, and the Dutch East Indies has its own government and Wikidata item, so it is a state in Indonesia's own file either way. Likewise colonial Brazil becomes a state in Brazil's file now that Portugal has no lane. Sub-Saharan Africa is left with Ethiopia only.

Reserves: Portugal, Netherlands, Nigeria, Sweden, Thailand, Vietnam, Argentina, Morocco, South Africa, Georgia, Israel, Canada, Australia.

The presets and "often compared with" lists in `data/overrides/presets.json` name only the nine current countries. Each batch PR proposes additions to them (the "Middle East" preset has two countries until batch 2; "Silk Road" gains Uzbekistan and Tajikistan in batch 3).

### The ten for 500 BCE–today

Iran, Iraq, Turkey, Egypt, Greece, Italy, India, China, Armenia, France.

Chosen because each has documented states for most of the 2,500 years, and because they share them: the Achaemenid, Seleucid, Roman, Parthian, Sasanian and Byzantine states and the caliphates each appear in several of these lanes, which is what the side-by-side view is for. France is the weakest fit before the Roman conquest (a `no-state` period for Gaul). Japan, the UK, Russia and Germany would each be mostly `no-state` or `traditional` before about 500 CE; Japan is the first alternate.

Five of the ten (Iraq, Egypt, Greece, Italy and Armenia) are not covered yet, which is part of why they are in the next 21.

## 8. Where this departs from the PRD

| PRD | Proposal | Why |
| --- | --- | --- |
| §6.1 Lane period: four kinds | Two more: `ruled-by`, with `ruler`, and `parallel` | Section 2 |
| §6.1 Relation: four types, `parties[]` of ids | Adds `alliance`; parties are objects with `country`, `side`, own years | Section 3 |
| §6.1 Event: `states[]` | `countries[]`; adds `kind`, `tier`, `end`, `relation`; `place` may be `null` | Section 4 |
| §6.1 Flag | Adds `licenseUrl`, `sha1`, `retrieved` | Section 2 |
| §6.1 Border snapshot: `year`, features with `state` ids | Adds dataset, licence, attribution; features also carry `country`, `name`, `disputed` | Section 5 |
| §6.1 Office term: two offices | Unchanged from v0.1.0, which already has `leader` (R4) and `other` (R8) | Already approved |
| §6.1 Years only | Optional exact dates beside them | Section 1 |
| §6.1 Country `coreRegion`; §6.3 step 1 fetches "each country's core region"; §13 leaves its definition open | The pipeline fetches from an explicit list of Wikidata state items per country. `coreRegion` stays optional and unset until the map needs it | No file sets `coreRegion` today, and a list of items is what a SPARQL query can use (D11) |
| §7.8 "Wikidata or Wikipedia by default" counts as sourced | Terms, relations and events need a fetchable page beside the Wikidata item | D2 |
| §6.3 output goes to `public/data/` | Also committed to `data/merged/` | The diff a reviewer reads (§6.3 step 6) |

All accepted; they are recorded in [prd-changes.md](prd-changes.md) as edits 4–10.

## Decisions

| | Question | Outcome (2026-11-16) |
| --- | --- | --- |
| **D1** | What makes an audit row "open"? | **Decided.** A row closes only by a correction or a recorded exception in `audit-exceptions.json`; CI fails on any open row. |
| **D2** | Does a Wikidata item alone count as a source? | **Decided: no.** Every term, relation and event also cites a page the audit fetches and confirms. Recorded as a PRD change. |
| **D3** | The `ruled-by` lane kind with a cross-file reference | **Accepted** with the other departures from the PRD. |
| **D4** | Which Persian names are sent as conflicts | **Approved:** no fa.wikipedia article; a title that is a description or carries a disambiguation suffix; a title that contradicts a confirmed official name. |
| **D5** | Relations need two covered countries; one-sided wars are events until then | Not answered. Assumed as proposed; it first matters in step 4 and will be raised again there. |
| **D6** | Events chosen by rule | **Approved**, with the threshold shown on the nine countries before it is applied. |
| **D7** | Exact dates as optional fields beside the year | **Accepted** with the other departures from the PRD. |
| **D8** | Korea after 1948 | **Decided.** The Republic of Korea holds the lane. The DPRK is a "parallel state", not a "rival": the new `parallel` kind in section 2. |
| **D9** | Countries and batching | **Decided** as revised in section 7. The ten for 500 BCE are approved as listed. |
| **D10** | What makes a lane "complete" | **Accepted:** the definition in section 6. |
| **D11** | `coreRegion` | **Accepted:** unset until the map; the pipeline works from a list of Wikidata items per country. |
