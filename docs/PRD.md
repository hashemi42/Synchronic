# PRD — Synchronic: world history, side by side

Nov 13, 2026 · @Hossein Hashemi

## 1. Summary and problem

**Synchronic** is an open-source, bilingual (English and Persian) web app that shows who ruled where, and what was happening, across the world at the same moment. A time slider moves from 500 BCE to today.

**Problem:** history is read one country at a time. Answering "while Ahmad Shah Qajar ruled Persia, who ruled Britain, the Ottoman Empire and Russia?" today takes several Wikipedia tabs and mental arithmetic.

**Solution:** two views over one dataset.

- **Infographic view** — countries as parallel lanes showing each era's state, rulers and flag, with a time cursor across all lanes.
- **Map view** — a world map with the borders of the selected year and a political panel for each region.

**Vision:** a free, trustworthy reference for synchronous history that anyone can contribute to, where every comparison is a shareable link.

**Design reference:** the v4 artboards on the design canvas ([Synchronic History — Map & Infographic Views](https://claude.ai/artifact/6jejP7HjJR5ZedD9NkzWu5)).

## 2. Goals, non-goals and success metrics

Phase 1 succeeds when a visitor can pick any set of countries and a year or a reign and see, at a glance and in both languages, who held power in each.

**Goals (phase 1)**

1. Answer "who ruled where, at the same time?" for any year from 500 BCE to today.
2. Let users compare by a single year or across a whole reign (the anchor).
3. Show the political context of each state: head of state, head of government, system, capital and historical flag.
4. Work fully in English and Persian, including right-to-left layout.
5. Meet WCAG 2.2 AA.
6. Be open source, with data that contributors can extend through pull requests.

**Non-goals (phase 1)**

- Prehistory before 500 BCE.
- Social, economic or cultural history beyond major political events.
- User accounts, saved collections or comments.
- Native mobile apps (the web app is responsive).
- Languages other than English and Persian.
- Editing data inside the app.

**Success metrics**

| Metric | Target | How measured |
| --- | --- | --- |
| Countries with complete lanes, 1800 – today | 30 | Data validation report |
| Countries with complete lanes, 500 BCE – today | 10 | Data validation report |
| Records with a cited source | 100% | CI check on every PR |
| Time from landing to first comparison | under 30 s | Usability test, 5 users |
| Lighthouse accessibility score | 100 | CI on every deploy |
| Largest Contentful Paint, mid-range phone on 4G | under 2.5 s | Lighthouse / Web Vitals |
| External contributors with a merged data PR | 10 within 6 months of launch | GitHub |

## 3. Users and key scenarios

The primary user is a curious reader who knows one country's history well and wants to see what was happening elsewhere at the same time.

| User | Need | Example |
| --- | --- | --- |
| Curious reader (primary) | Place a known ruler or event in world context | "Who ruled Britain and Russia while Ahmad Shah was shah?" |
| Student | Compare eras quickly for an essay or exam | "What was Europe like when the Safavids took power?" |
| Teacher | Show a class a shareable comparison | A link to Iran, Turkey and Russia in 1919 |
| Writer or journalist | Check a contemporaneous fact | "Who was French president in 1919?" |
| Contributor | Add or fix data for their own country | A Lithuanian volunteer fills the Grand Duchy era |

**User stories (phase 1)**

1. As a reader, I pick countries I know by their modern name, so I don't need to know historical state names.
2. As a reader, I drag the time slider or type a year and every lane and the map update.
3. As a reader, I anchor a ruler and see everyone who held power anywhere during their reign.
4. As a reader, I hover a state in a lane and see its flag, head of state, head of government, system and capital.
5. As a reader, I see treaties and wars that connect my selected countries.
6. As a reader, I switch between English and Persian, and the layout and calendars follow.
7. As a reader, I copy the URL and someone else sees exactly the same comparison.
8. As a keyboard or screen-reader user, I can do all of the above without a mouse.
9. As a contributor, I add a state or ruler in a data file, and CI tells me if anything is invalid or unsourced.

## 4. Scope: MVP and phase 1

The MVP is the infographic view for 1800 – today; the map view and the full 500 BCE range complete phase 1.

The infographic ships first because it needs no border data, delivers the core value (synchronicity) on its own, and is the fastest route to user feedback.

| Capability | MVP | Phase 1 |
| --- | --- | --- |
| Time range | 1800 – today | 500 BCE – today |
| Countries with data | 9 (Iran, UK, Russia, Turkey, France, Germany, China, India, Japan) | 30+ |
| Infographic view (lanes, cursor, anchor, right column) | Yes | Yes |
| Add country dialog and presets | Yes | Yes |
| Politics card (head of state, government, system, capital) | Yes | Yes |
| Historical flags | Yes | Yes |
| Connections (treaties, wars) | No | Yes |
| Map view with historical borders | No | Yes |
| English and Persian, RTL | Yes | Yes |
| Shareable URL state | Yes | Yes |
| Mobile layout | Usable | Polished |
| Open-source contribution flow (schema, CI) | Yes | Yes |

## 5. Functional requirements

Every requirement below has an ID for tickets and PRs; "MVP" marks what ships first.

### 5.1 Global shell

- **SH-1 (MVP)** Top bar: logo, view switch (Map / Infographic), search trigger (⌘K / Ctrl+K), language switch (EN / فا), GitHub link.
- **SH-2 (MVP)** All state lives in the URL: `?view=lanes&year=1919&lanes=iran,uk,russia&anchor=ahmad-shah-qajar&lang=en`. Opening a URL restores the exact view.
- **SH-3** Search (⌘K) jumps to a year, a ruler (sets the anchor), a state or a country (adds a lane).

### 5.2 Time dock (shared by both views)

- **TD-1 (MVP)** Year display, editable by typing; shows the CE year plus Solar Hijri and Lunar Hijri equivalents (e.g. 1919 CE · 1297–98 SH · 1337–38 AH). BCE years shown as "500 BCE".
- **TD-2 (MVP)** Two-tier scrubber: an *all-time* strip (500 BCE – today) with a context strip of the anchor country's dynasties and a lens bracket; a *detail* track for the zoomed window with yearly ticks, decade labels and event dots.
- **TD-3 (MVP)** Previous / next buttons and a step size: year, decade, century, reign.
- **TD-4** Play button animates forward at the chosen step; pauses on interaction; respects `prefers-reduced-motion`.
- **TD-5 (MVP)** Keyboard: arrow keys move one step, Shift+arrow ten steps, Home/End jump to range ends; the handle is a proper ARIA slider.
- **TD-6 (MVP)** Anchor chip: "Anchored to Ahmad Shah Qajar · 1909–1925" with a remove button; the anchor's reign is shaded on both tracks.

### 5.3 Infographic view (lanes)

- **IN-1 (MVP)** One lane per selected country, labelled with the modern name and "land of today's …".
- **IN-2 (MVP)** Each lane has a *state row* (coloured pills, each with its historical flag and name) and a *ruler row* (grey segments with names, truncated when narrow, full name on hover).
- **IN-3 (MVP)** A vertical cursor marks the selected year across all lanes; the ruler in power at that year is filled black.
- **IN-4 (MVP)** With an anchor set, a tinted band spans the reign; rulers overlapping it are emphasised; a "Single year / Whole reign" switch changes what the right column lists.
- **IN-5 (MVP)** Right column per lane: flag, head of state with title, state name, and the sequence of rulers during the anchor reign.
- **IN-6 (MVP)** "+1" badge where a rival government existed at the same time (e.g. Guangzhou government in China, 1917–1928); clicking opens the alternatives.
- **IN-7 (MVP)** Periods with no state show a hatched grey bar labelled "No state" with a short description (e.g. "Baltic tribes").
- **IN-8 (MVP)** World row above the lanes: major global periods (WWI, WWII, Cold War).
- **IN-9 (MVP)** Lanes reorder by drag and by keyboard; remove via ✕; maximum 10 lanes on desktop, 4 on mobile; the anchor lane stays first.
- **IN-10 (MVP)** Zoom the time window (buttons, Ctrl+scroll, pinch).
- **IN-11** Connections: a vertical line with dots links every lane involved in a treaty or war at its date, with a label chip; a toggle hides them.

### 5.4 Add a country

- **AC-1 (MVP)** Dialog with a search field matching English and Persian names, including partial matches.
- **AC-2 (MVP)** Each result previews what that land was in the selected year (e.g. "Turkey → Ottoman Empire · Sultan Mehmed VI").
- **AC-3 (MVP)** Suggestions "Often compared with \<anchor country>" and preset sets (Great powers 1900s, Middle East, Silk Road, East Asia).
- **AC-4 (MVP)** Lane counter ("9 of 10 lanes"); full keyboard support (↑ ↓ ↵ Esc); focus returns to the trigger on close.
- **AC-5** Modern flags appear only in this dialog, never on lanes.

### 5.5 Politics card and flags

- **PO-1 (MVP)** Hover or focus on a state pill opens a card: historical flag, official name, head of state (name, title, years), head of government (name, title, years), system of government, capital, flag name and its date range.
- **PO-2 (MVP)** Card section "Links to your lanes": relations to other selected countries.
- **PO-3 (MVP)** Flags carry a certainty value; "simplified" or "reconstructed" flags are labelled as such.
- **PO-4 (MVP)** Withheld symbols (see section 7) render as a neutral grey placeholder.
- **PO-5** "How \<country> tells it" section with the national narrative and local-language names.

### 5.6 Map view

- **MA-1** Full-bleed map with floating top bar, side panel and time dock.
- **MA-2** Borders from the nearest historical snapshot; the active snapshot year is shown and selectable.
- **MA-3** States filled with the soft tint of their lane colour; the selected state uses the deep tint and an outline.
- **MA-4** Hover tooltip with state, ruler and years; click opens the panel; Shift+click adds the country as a lane.
- **MA-5** Panel tabs: Politics, Meanwhile, Events, Sources.
- **MA-6** Numbered event pins for the selected year.
- **MA-7** Toggle: today's borders of selected countries as a dashed outline.
- **MA-8** Zoom, pan, recentre; keyboard accessible.

## 6. Data model and pipeline

Wikidata is the source of truth for facts; a small curated overrides layer in the repo adds what Wikidata lacks; a build script merges both into static JSON.

### 6.1 Entities

| Entity | Key fields | Source |
| --- | --- | --- |
| Country (modern) | `id`, `name.en`, `name.fa`, `aliases`, `coreRegion`, `wikidata` | Overrides + Wikidata |
| State (polity) | `id`, `name.en/fa`, `localName`, `start`, `end`, `capital`, `system`, `wikidata` | Wikidata |
| Lane period | `country`, `state`, `start`, `end`, `kind` (`state` \| `rival` \| `occupation` \| `no-state`), `note` | Overrides |
| Office term | `person`, `state`, `office` (`head-of-state` \| `head-of-government`), `title.en/fa`, `start`, `end` | Wikidata (P35, P6 + qualifiers) |
| Person | `id`, `name.en/fa`, `localName`, `born`, `died`, `wikidata` | Wikidata |
| Flag | `state`, `file` (Commons SVG), `start`, `end`, `certainty` (`documented` \| `simplified` \| `reconstructed`), `license`, `attribution`, `withheld` | Wikidata (P41) + Commons |
| Relation | `id`, `type` (`treaty` \| `war` \| `union` \| `partition`), `date` or `start/end`, `parties[]`, `name.en/fa` | Wikidata + overrides |
| Event | `id`, `date`, `place` (lat/lon), `states[]`, `name.en/fa` | Wikidata + overrides |
| Narrative | `country`, `period`, `label`, `text.en/fa/local`, `sources[]` | Overrides |
| Border snapshot | `year`, GeoJSON features with `state` ids | Historical basemaps (license to confirm) |

Every record carries `sources[]` (URL + title). Years are integers, BCE as negatives, no year 0; uncertain dates carry `circa: true`.

### 6.2 Example lane record

```json
{
  "country": "lithuania",
  "state": "lithuanian-ssr",
  "start": 1944,
  "end": 1990,
  "kind": "occupation",
  "label": { "en": "Soviet occupation", "fa": "اشغال شوروی" },
  "officialName": { "en": "Lithuanian SSR" },
  "sources": [{ "title": "…", "url": "…" }]
}
```

### 6.3 Pipeline

1. **Fetch** — scripts run SPARQL queries against Wikidata for states, office terms, flags and relations of each country's core region; responses are cached in `data/raw/`.
2. **Normalize** — map Wikidata items to the schema; resolve English and Persian labels; convert dates to integer years.
3. **Merge** — apply `data/overrides/` (lane periods, rival/occupation/no-state flags, narratives, missing terms); overrides always win.
4. **Validate** — Zod schemas, plus checks: no gaps or overlaps in a lane unless marked, every record sourced, every label in both languages.
5. **Emit** — static JSON in `public/data/`, chunked by century and by country, plus a search index.
6. **Review** — a data refresh is a pull request; the diff is reviewed before merge. The site never reads Wikidata live.

## 7. Content policy

The rule is: a country's own narrative for identity, documented historical consensus for claims, and both sides labelled where there is real dispute.

1. **Identity follows the country.** Local-language names (Lietuva, Vytautas Didysis), national milestones (16 Feb 1918, 11 Mar 1990) and which periods get more detail follow how the country presents itself.
2. **Claims follow consensus and sources.** Legal status, legitimacy and contested events follow the scholarly and international consensus, with a citation.
3. **Where consensus is clear, it is the primary label.** Example: Lithuania 1940–1990 is labelled "Soviet occupation", with "Lithuanian SSR" as the official name beneath.
4. **Where there is genuine dispute, show both, labelled.** Example format: "Lithuania: occupation · USSR: voluntary accession", each with a source. Denial of well-documented events is not presented as an equal side.
5. **National narrative has its own place.** The "How \<country> tells it" section holds the national account in full; contributors from that country can add it without changing the core data.
6. **Withheld symbols.** Flags whose display is legally restricted in some jurisdictions (e.g. Nazi Germany) render as a neutral placeholder with the state's name. The list lives in `data/policy/withheld.json`.
7. **Uncertainty is visible.** Approximate dates show "c."; reconstructed flags are labelled; "No state" periods are explicit, never blank.
8. **Every record is sourced.** Wikidata or Wikipedia by default; other sources allowed with a URL.
9. **Wikipedia for narrative.** Card summaries and "Read more" links use Wikipedia in the reader's language (fa.wikipedia.org for Persian), with CC BY-SA attribution.

## 8. Bilingual and RTL

English and Persian are both first-class from day one; RTL is built into the layout from the first component, not added later.

- **L-1** Locale in the URL path (`/en/…`, `/fa/…`) via next-intl; `lang` and `dir` set on `<html>`.
- **L-2** Layout uses CSS logical properties only (`margin-inline-start`, `inset-inline-end`), never left/right.
- **L-3** Persian UI uses Persian digits (۱۹۱۹) and the Vazirmatn font; English uses Inter; years and dates use JetBrains Mono with tabular figures in both.
- **L-4** Calendars: Gregorian, Solar Hijri and Lunar Hijri via `Intl.DateTimeFormat` (`persian`, `islamic-umalqura`); Persian UI shows Solar Hijri first.
- **L-5** Data labels in both languages are required by validation; a missing Persian label fails CI rather than falling back silently.
- **L-6** Search matches English and Persian names, aliases and transliterations (e.g. "Qajar", "Ghajar", "قاجار").
- **L-7 (open decision)** Timeline direction in RTL: time runs left → right in both languages (proposal), with labels and panels mirrored. To be confirmed with Persian-speaking users (see section 13).

## 9. Accessibility and visual design

The interface is neutral black, white and grey; colour appears only in data; everything meets WCAG 2.2 AA.

**Visual system** (tokens from the v4 "Colour & accessibility tokens" artboard)

- Each country has one hue, built in OKLCH at equal lightness so no lane dominates.
- Three deep shades per hue for consecutive states in a lane (white text 5:1 to 12:1); one soft tint for map fills and one for map hover (dark text about 9:1).
- Neutrals: ink `#0A0A0A`, ink-2 `#3F3F3F`, ink-3 `#5E5E5E` (minimum for text), control edge `#8A8A8A`, hairline `#ECECEC`, fill `#F5F5F5`, canvas `#F5F5F4`.
- One accent: the anchor teal, always paired with a text label.
- Type: Inter (UI), Vazirmatn (Persian), JetBrains Mono (years). Minimum text size 11 px.
- Floating surfaces: 14–16 px radius, soft layered shadow; no gradients.

**Accessibility requirements**

- **A-1** Text contrast ≥ 4.5:1 everywhere, including small labels and text on data pills.
- **A-2** Control boundaries and meaningful graphics ≥ 3:1 (inputs, chips, year field, drag handles).
- **A-3** Colour is never the only signal: states have names and flags, the current ruler is filled black, rivals show "+1", selections use solid ink.
- **A-4** Visible focus: 2 px ink outline, 2 px offset, on every interactive element.
- **A-5** Targets ≥ 24 × 24 px; primary controls 40–44 px.
- **A-6** Full keyboard operation, logical tab order, skip link to the timeline.
- **A-7** Screen readers: the slider announces the year in both calendars; each lane is a labelled region; the ruler at the cursor is announced when the year changes (polite live region).
- **A-8** Map labels carry a white halo; the map has a text alternative (the panel and a list of states).
- **A-9** `prefers-reduced-motion` disables play animation and transitions.

## 10. Technical architecture and non-functional requirements

A statically generated Next.js app reads pre-built JSON; there is no backend or database in phase 1.

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js (App Router), TypeScript, React Server Components | Static generation per locale |
| Styling | Tailwind CSS with the v4 tokens as theme values | Logical properties for RTL |
| i18n | next-intl | `/en`, `/fa` routes |
| URL state | `nuqs` (or equivalent) | Year, lanes, anchor, view, zoom |
| Validation | Zod | Shared by the pipeline and the app |
| Lanes rendering | SVG + HTML, positions from a shared time scale | Virtualise when lanes > 10 |
| Map | MapLibre GL JS with GeoJSON snapshots, or d3-geo SVG | Decision in phase 1 spike |
| Data pipeline | Node scripts, Wikidata SPARQL | Runs locally and in CI |
| Hosting | Vercel (or any static host) | Preview deploy per PR |
| Testing | Vitest (logic), Playwright (flows), axe-core (a11y) | All in CI |

**Non-functional requirements**

- **NF-1 Performance:** LCP < 2.5 s on a mid-range phone on 4G; initial JS < 200 KB gzipped; scrubbing the year updates lanes at 60 fps.
- **NF-2 Data loading:** load only the centuries and countries in view; prefetch adjacent centuries.
- **NF-3 Offline-friendly:** data files are immutable and cacheable (content-hashed names).
- **NF-4 Browser support:** last two versions of Chrome, Safari, Firefox, Edge; iOS Safari 16+.
- **NF-5 Privacy:** no tracking cookies; privacy-friendly analytics only (e.g. Plausible) or none.
- **NF-6 Shareability:** Open Graph images generated per comparison URL (e.g. "Iran, UK and Russia in 1919").

## 11. Open source: licences, contribution, CI

Code and data are licensed separately, and every data change goes through an automatically validated pull request.

**Licences**

| Part | Licence | Why |
| --- | --- | --- |
| Code | MIT | Simple and permissive |
| Curated data (`data/overrides/`) | CC BY-SA 4.0 | Compatible with Wikipedia text |
| Data derived from Wikidata | CC0 (as upstream) | Wikidata is CC0 |
| Wikipedia excerpts | CC BY-SA, attributed in the UI | Required by Wikipedia |
| Flags (Commons) | Per file; stored with each flag | Commons licences vary |
| Border snapshots | Per source; to be confirmed before use | See section 13 |

**Repository**

- `README.md` — what it is, screenshots, how to run, licences.
- `CONTRIBUTING.md` — the data schema in plain words, sourcing rules, content policy (section 7), how to add a country, how to fix upstream in Wikidata.
- Issue templates: "Data error", "Add a country", "Translation".
- `CODE_OF_CONDUCT.md`.

**CI on every pull request**

1. Type check, lint, unit tests.
2. Data validation: schema, no unmarked gaps or overlaps, sources present, both languages present.
3. A human-readable data diff posted as a PR comment.
4. Playwright smoke tests and axe accessibility checks on a preview deploy.
5. Lighthouse budget check (NF-1).

## 12. Roadmap

Build in ten phases behind two gates: the MVP after phase 4, the phase 1 launch after phase 9.

&#91;embedded content: roadmap · 10 phases, 2 gates\]

The infographic goes first because it needs no border data; the map waits until the data pipeline and politics card are proven.

**Start here (phase 0)**

- [ ] Create the GitHub repo with `LICENSE` (MIT), `DATA_LICENSE` (CC BY-SA 4.0) and a README stub
- [ ] Scaffold Next.js (App Router, TypeScript, Tailwind) with `/en` and `/fa` routes and `dir` switching
- [ ] Add the v4 colour and type tokens to the Tailwind theme
- [ ] Set up CI: type check, lint, Vitest, preview deploy
- [ ] Write the Zod schemas from section 6.1 and one hand-made lane (Iran, 1789 – today) to test them
- [ ] Spike: one SPARQL query for Iran's heads of state with start and end qualifiers

## 13. Risks and open questions

The biggest risk is data, not code: coverage before 1800 and historical borders will take most of the effort.

**Risks**

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Wikidata is incomplete or inconsistent before 1800 | Gaps and wrong dates in early lanes | Overrides layer; ship MVP at 1800+; extend era by era |
| Historical border data is coarse or restrictively licensed | Map view delayed or legally blocked | Check licences in a spike before building MA-\*; fall back to region-level shapes |
| Contested narratives cause disputes | Loss of trust, hostile issues | Content policy (section 7) in CONTRIBUTING; sources required; maintainers decide by policy |
| Vandalised upstream data | Wrong facts on the site | Never read live; every refresh is a reviewed PR |
| Flag accuracy and licensing | Misleading or unlicensed images | Certainty field; licence stored per file; withheld list |
| Scope creep (more views, more languages) | MVP slips | Non-goals in section 2; new ideas go to a backlog |
| Single maintainer | Project stalls | Clear CONTRIBUTING and good-first-issue labels from day one |

**Open questions**

- [ ] Timeline direction in Persian RTL: left → right (proposed) or right → left? Test with 5 Persian-speaking users.
- [ ] Which historical border source, and is its licence compatible?
- [ ] MapLibre GL or d3-geo SVG for the map?
- [ ] Core region definition: one polygon per modern country, or a list of Wikidata regions?
- [ ] Which presets ship in the MVP, and who curates them?
- [ ] Project name and domain: keep "Synchronic"?
- [ ] Analytics: privacy-friendly tool or none?
