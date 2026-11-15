# Proposed PRD edits

Three changes to "PRD — Synchronic: world history, side by side" so it matches what the MVP does and what the data allows. Each gives the current text, the proposed text and the reason.

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

## Also worth noting (no edit proposed)

- **NF-6** is met: comparison links carry their own title, description and preview image.
- **§11 issue templates**: "Data error", "Add a country" and "Translation" exist, plus "Bug".
- **Analytics (NF-5)**: none in the MVP.
