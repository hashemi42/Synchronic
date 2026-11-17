# Contributing to Synchronic

Thank you for helping. Most contributions are **data**: adding or fixing a state, a ruler or a date for a country you know well. Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md).

Not ready to edit files? Report a [data error](https://github.com/hashemi42/Synchronic/issues/new?template=data-error.yml) with your source instead.

## Add or fix data

1. Edit `data/overrides/countries/<country>.json`, the curated file. Use `iran.json` as the model.
2. Run `pnpm data:pipeline`. It rebuilds `data/merged/<country>.json`, the file the site reads, from Wikidata's cached answers in `data/raw/` and your curated file. Never edit `data/merged/` by hand.
3. Run `pnpm data:validate` and `pnpm test`.
4. Run `pnpm data:audit` (it needs the network and takes a few minutes). It must end with no open rows; commit what it writes in `artifacts/data-review/`.
5. Open a pull request. CI runs the same checks. It fails if `data/merged/` is not what the pipeline produces, or if the audit was not run on the data you commit.

Who held which office, and when, comes from Wikidata. So do people's names and years. The curated file holds what Wikidata cannot decide, and corrections, each with a source or a reason:

| Part | What it holds |
| --- | --- |
| `country` | The modern country: id, English and Persian name, aliases, Wikidata id |
| `states` | Every historical state on that land: names, years, capital, system, Wikidata id |
| `lane` | Which state covered which years — the lane the reader sees |
| `offices` | The Wikidata items of the head-of-state offices, and the title their holders get ("Shah"). An office can be limited to a state, to years (`from`, `until`) or to a family |
| `persons` | Each person's id and Wikidata id. Add `name` only to keep a name against the default, and say why in `note` |
| `terms` | Terms Wikidata lacks or gets wrong, in full, with a source. They replace whatever the pipeline finds for that person and office |
| `titles` | A title for one person where the office's title does not fit ("Queen", "Empress") |
| `exclude` | People Wikidata lists as holders who are left out on purpose, with the rule ([data rules](data-rules.md)) |
| `flags` | Which Wikimedia Commons file flew over which state, and when |

**To fix a date or add a missing ruler:** fix it on Wikidata if it is wrong there, then run `pnpm data:pipeline --refresh <country>`. If Wikidata is right but models the office differently, or you cannot wait for it, add the term to `terms` with a source.

**Persian names** default to the title of the person's Persian Wikipedia article. A title with brackets or a comma (a disambiguator, or a full formal name) is passed over for the item's Persian label on Wikidata, then `data/overrides/persian-names.json`.

### Rules the validator enforces

- **Years** are integers. BCE years are negative. There is no year 0.
- **Ranges are half-open**: a period ending in 1925 and one starting in 1925 are contiguous. Use `"end": null` for "still current".
- **A term within one year** has `start` equal to `end` (Edward VIII, 1936). Lane periods cannot.
- **De facto rulers** who held power outside the formal offices use `"office": "leader"`; where a state has leader terms, the lane shows them instead of the head of state.
- **Uncertain dates** carry `"circa": true`.
- **Sources**: every record needs at least one `{ "title", "url" }`. Wikidata or Wikipedia by default; any other source with a URL is welcome.
- **Both languages**: every label needs `en` and `fa`. There is no silent fallback.
- **No gaps or overlaps** in a lane. If two governments existed at once, mark the second `"kind": "rival"`. If there was no state, add a `"kind": "no-state"` period with a short `note` — never leave a blank.
- **Flags** name a Wikimedia Commons file. The pipeline reads its licence from Commons and refuses anything but public domain, CC0, CC BY or CC BY-SA; you set `attribution` and `certainty`: `documented`, `simplified` (right design, modern drawing) or `reconstructed`. A state has one flag at a time; leave years without a known flag empty. `pnpm fetch:flags` lists candidates in `data/raw/flags.json`. After adding a flag, run `pnpm mirror:flags` and commit the new files in `public/flags/`: the site serves its own copies, and a unit test fails if one is missing.
- **Heads of government** come from the offices in `scripts/offices.ts`, placed and titled by the rules in `scripts/pipeline/rules.ts`. Terms Wikidata lacks go in `data/overrides/heads-of-government.json`.
- **Acting holders** for less than a year are left out (rule R3). The pipeline does this itself where Wikidata marks the statement as acting; otherwise add the person to `exclude`.
- **Ids** are lowercase kebab-case (`ahmad-shah-qajar`).

### Cross-checking with Wikidata

`pnpm data:audit` compares every term with Wikidata (P35/P6, and P39 for heads of government), every Persian name with the item's Persian label, and fetches every source URL. A row it raises stays **open** until you correct the data or record why it stands: a term its cited source confirms closes by itself; otherwise add the term to `verified`, or the name to `persianNames`, in `data/policy/audit-exceptions.json`, with the source. Open rows are in `artifacts/data-review/audit.csv`, closed ones in `audit-closed.csv`. `pnpm data:pipeline` also writes `artifacts/data-review/completeness.md`: which lanes are complete, and every year of a state that still lacks a head of state, a head of government or a flag. Wikidata is a cross-check, not the truth: where they disagree, the cited source decides.

### If the fact is wrong upstream

When a date or name is wrong in Wikidata, please fix it there too. The site never reads Wikidata live; every refresh is a reviewed pull request.

## Content policy

1. **Identity follows the country.** Local-language names and national milestones follow how the country presents itself.
2. **Claims follow consensus and sources.** Legal status, legitimacy and contested events follow the scholarly and international consensus, with a citation.
3. **Where consensus is clear, it is the primary label**, with the official name beneath (for example "Soviet occupation" above "Lithuanian SSR").
4. **Where there is genuine dispute, show both sides, labelled and sourced.** Denial of well-documented events is not presented as an equal side.
5. **Withheld symbols.** Flags whose display is legally restricted in some jurisdictions render as a neutral placeholder; the list is `data/policy/withheld.json`.
6. **Uncertainty is visible**: "c." for approximate dates, labels on reconstructed flags, explicit "No state" periods.

Maintainers decide disputes by this policy.

## Code

```bash
pnpm install
pnpm dev
pnpm typecheck && pnpm lint && pnpm test
pnpm build && pnpm test:e2e   # browser and accessibility tests
pnpm exec tsx scripts/data-diff.ts main   # preview the data-change summary CI posts on pull requests
```

- Layout uses CSS logical properties only (`ms-*`, `ps-*`, `start-*`), never left/right. The timeline itself is the one exception: it is wrapped in `dir="ltr"`.
- UI strings live in `messages/en.json` and `messages/fa.json`; add both.
- Text contrast is at least 4.5:1, targets at least 24 × 24 px, and everything works from the keyboard. `pnpm test:e2e` runs axe against WCAG 2.2 AA in both languages.
- Never use a fixed `id`: Next.js keeps the previous page in the DOM, hidden, so it would appear twice. Use `useId()`.

By contributing you agree that your code is released under MIT and your data under CC BY-SA 4.0.
