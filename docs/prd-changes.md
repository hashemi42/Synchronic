# Proposed PRD edits

Changes to the [PRD](PRD.md) so it matches what the MVP does and what the data allows. Each gives the current text, the proposed text and the reason. Edits 1–3 came out of the MVP; edits 4–10 were accepted on 2026-11-16 with the [data phase proposal](data-phase-proposal.md), which has the full reasoning.

## 1. SH-2: URL example (§5.1)

**Current**

> **SH-2 (MVP)** All state lives in the URL: `?view=lanes&year=1919&lanes=iran,uk,russia&anchor=ahmad-shah-qajar&lang=en`. Opening a URL restores the exact view.

**Proposed**

> **SH-2 (MVP)** All state lives in the URL: `/en?year=1919&lanes=iran,uk,russia&anchor=ahmad-shah-qajar&from=1900&to=1950`. The language is the path (L-1), not a parameter; `from`/`to` hold the zoomed window (IN-10) and are left out when nothing is zoomed. `view=map` is added with the map view in phase 1; its absence means the lanes. Opening a URL restores the exact view.

**Why.** L-1 already puts the locale in the path (`/en/…`, `/fa/…`), so `lang=` would say the same thing twice and could contradict it. The zoom window was added after the PRD was written and is part of what a shared link must restore. A `view` parameter with only one possible value adds noise to every link.

## 2. PO-2: move to phase 1 (§4 and §5.5)

**Current**

> **PO-2 (MVP)** Card section "Links to your lanes": relations to other selected countries.

**Proposed**

> **PO-2 (phase 1)** Card section "Links to your lanes": relations to other selected countries (treaties, wars, unions), drawn from the same records as IN-11 Connections.

And in the §4 scope table, under "Connections (treaties, wars)", note that this includes the card's "Links to your lanes".

**Why.** The card can only list relations that exist as data, and the MVP has none: there is no relation or event data yet, and §4 already puts "Connections (treaties, wars)" in phase 1. PO-2 and IN-11 need the same records, sourced and reviewed the same way, so they belong together.

## 3. TD-2: defer event dots (§5.2)

**Current**

> **TD-2 (MVP)** Two-tier scrubber: an *all-time* strip (500 BCE – today) with a context strip of the anchor country's dynasties and a lens bracket; a *detail* track for the zoomed window with yearly ticks, decade labels and event dots.

**Proposed**

> **TD-2 (MVP)** Two-tier scrubber: an *all-time* strip (the data's full range: 1789 – today in the MVP, 500 BCE – today in phase 1) with a context strip of the anchor country's dynasties and a lens bracket; a *detail* track for the zoomed window with yearly ticks and decade labels. **Event dots** on the detail track follow once event data exists (phase 1, with IN-11).

**Why.** The schema has `HistoricalEvent`, but no country file has events, and showing dots needs sourced, reviewed records like every other fact. The all-time strip already spans whatever range the data covers, so the MVP range is stated rather than implied.

## 4. Lane period: two more kinds (§6.1)

**Current**

> Lane period — `country`, `state`, `start`, `end`, `kind` (`state` | `rival` | `occupation` | `no-state`), `note`

**Proposed**

> Lane period — `country`, `state`, `start`, `end`, `kind` (`state` | `rival` | `parallel` | `occupation` | `no-state` | `ruled-by`), `ruler` (for `ruled-by`: the `country` and `state` of the lane that governed this one), `note`

**Why.** `ruled-by` is for land that had no polity of its own and was governed by a state that holds another lane (Iraq as Ottoman provinces); it points at that state instead of copying it and its office terms into a second file. `parallel` is a second state on the same land, existing in its own right (the DPRK, East Germany), which `rival` wrongly described; `rival` stays for a government contesting the same state (Guangzhou, 1917–1928).

## 5. Relation: parties with sides, and alliances (§6.1)

**Current**

> Relation — `id`, `type` (`treaty` | `war` | `union` | `partition`), `date` or `start/end`, `parties[]`, `name.en/fa`

**Proposed**

> Relation — `id`, `type` (`treaty` | `war` | `alliance` | `union` | `partition`), `date` or `start/end`, `parties[]` (each: `country`, optional `state`, `as`, `side`, `start/end`), `name.en/fa`, `wikidata`

**Why.** "Links to your lanes" (PO-2) works on lanes, so a party is a country. `side` lets the card say "at war with" and not only "in the same war as". A party's own years cover late entry and changed sides. `as` names an actor that holds no lane (Prussia in the partitions of Poland). Alliances (Triple Entente, NATO) are not treaties of one date.

## 6. Event: countries, kind and tier (§6.1)

**Current**

> Event — `id`, `date`, `place` (lat/lon), `states[]`, `name.en/fa`

**Proposed**

> Event — `id`, `date`, optional `end`, `kind`, `tier` (1–3), `place` (lat/lon and a name, or `null` when the event has no single place), `countries[]`, optional `relation`, `name.en/fa`, `wikidata`

**Why.** A state can sit in several lanes, so `states[]` would put an Ottoman battle in the Balkans on the lane of Ottoman-ruled Iraq; `countries[]` says which lanes an event belongs to. `tier` decides which dots show at which zoom (TD-2) and is computed from the number of Wikipedia language editions, not judged. A `place` that must be present, even as `null`, means no event skips the check by accident.

## 7. Exact dates beside the year (§6.1)

**Current**

> Years are integers, BCE as negatives, no year 0; uncertain dates carry `circa: true`.

**Proposed**

> Years are integers, BCE as negatives, no year 0; uncertain dates carry `circa: true`. A term, relation or event may also carry an exact date (`exactStart`, `exactEnd`, `exactDate`: `YYYY-MM-DD` or `YYYY-MM`, CE only) that agrees with its year. An office term whose dates come from tradition, not a contemporary record, carries `traditional: true`.

**Why.** Treaties and events have dates, and terms within one year need an order (Iran had three presidents in 1981). The year stays the field all range logic uses.

## 8. Flag and border-snapshot metadata (§6.1)

**Current**

> Flag — `state`, `file` (Commons SVG), `start`, `end`, `certainty` (…), `license`, `attribution`, `withheld`
>
> Border snapshot — `year`, GeoJSON features with `state` ids

**Proposed**

> Flag — as now, plus `licenseUrl` (required unless public domain or CC0), `sha1` of the mirrored file and `retrieved`
>
> Border snapshot — `id`, `year`, `file`, `dataset` (name, version, URL), `license`, `licenseUrl`, `attribution`; features carry `state`, `country`, `name` and `disputed`. State ids are unique across all country files.

> No flag — `state`, `start`, `end`, `status` (`no-documented-flag`), optional `note` and `sources`: years of a state for which no flag is documented. It answers the flag question for those years in the completeness report without a source for the absence (§7.7).

**Why.** §11 requires a licence per flag and per border source; these are the fields that state it. A Commons file can be overwritten under the same name, so the record identifies the file the site serves. Many states had no flag in their early years, and an absence has no page to cite; saying "no documented flag" keeps it visible instead of blank. The border shape stays provisional until the source spike (§13).

## 9. Core region (§6.1, §6.3 step 1, §13)

**Current**

> **Fetch** — scripts run SPARQL queries against Wikidata for states, office terms, flags and relations of each country's core region

**Proposed**

> **Fetch** — scripts run SPARQL queries against Wikidata for the states listed for each country in `data/overrides/` (their Wikidata items), and for those states' office terms, flags and relations

And in §13, the open question "Core region definition" is answered for the pipeline: a list of Wikidata items per country. `coreRegion` stays optional and unset until the map needs a polygon.

**Why.** No country file sets `coreRegion`, and a list of items is what a query can use. Which states make up a lane is an editorial choice the overrides already record.

## 10. Sourcing and the audit (§7.8, §6.3, §11)

**Current**

> **Every record is sourced.** Wikidata or Wikipedia by default; other sources allowed with a URL.

**Proposed**

> **Every record is sourced.** Wikidata or Wikipedia by default; other sources allowed with a URL. An office term, relation or event cites, beside its Wikidata item, a page that states its years; the audit fetches that page and confirms them.

In §6.3, step 4 becomes "Validate and audit", and the pipeline's merged output is also committed to `data/merged/` so that a refresh is a reviewable diff (step 6). In §11, CI gains: "Data audit: no open rows. A row closes only by a correction or by a recorded exception that names its source." In §2, "Countries with complete lanes" is defined: every year in the range has a lane period, and every year of a state has a head of state or leader (or a recorded vacancy), a head of government where the office existed, a capital, a system and a flag (or a recorded reason for none), in both languages, with no open audit row.

**Why.** Most citations in v0.1.0 are the record's own Wikidata item, and the one outright error found so far came from an unreferenced Wikidata statement. The metrics table measures completeness by a "data validation report" that had no definition.

## Also worth noting (no edit proposed)

- **NF-6** is met: comparison links carry their own title, description and preview image.
- **§11 issue templates**: "Data error", "Add a country" and "Translation" exist, plus "Bug".
- **Analytics (NF-5)**: none in the MVP.
