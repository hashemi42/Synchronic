# Contributing to Synchronic

Thank you for helping. Most contributions are **data**: adding or fixing a state, a ruler or a date for a country you know well.

## Add or fix data

1. Edit (or create) `data/overrides/countries/<country>.json`. Use `iran.json` as the model.
2. Run `pnpm data:validate` and `pnpm test`.
3. Open a pull request. CI runs the same checks.

A country file has five parts:

| Part | What it holds |
| --- | --- |
| `country` | The modern country: id, English and Persian name, aliases, Wikidata id |
| `states` | Every historical state on that land: names, years, capital, system |
| `persons` | People who held office |
| `lane` | Which state covered which years — the lane the reader sees |
| `terms` | Who was head of state or head of government, and when |
| `flags` | Which Wikimedia Commons file flew over which state, and when |

### Rules the validator enforces

- **Years** are integers. BCE years are negative. There is no year 0.
- **Ranges are half-open**: a period ending in 1925 and one starting in 1925 are contiguous. Use `"end": null` for "still current".
- **A term within one year** has `start` equal to `end` (Edward VIII, 1936). Lane periods cannot.
- **De facto rulers** who held power outside the formal offices use `"office": "leader"`; where a state has leader terms, the lane shows them instead of the head of state.
- **Uncertain dates** carry `"circa": true`.
- **Sources**: every record needs at least one `{ "title", "url" }`. Wikidata or Wikipedia by default; any other source with a URL is welcome.
- **Both languages**: every label needs `en` and `fa`. There is no silent fallback.
- **No gaps or overlaps** in a lane. If two governments existed at once, mark the second `"kind": "rival"`. If there was no state, add a `"kind": "no-state"` period with a short `note` — never leave a blank.
- **Flags** name a Wikimedia Commons file and carry its `license` and `attribution`. Set `certainty` honestly: `documented`, `simplified` (right design, modern drawing) or `reconstructed`. A state has one flag at a time; leave years without a known flag empty. `pnpm fetch:flags` lists candidates in `data/raw/flags.json`.
- **Heads of government** are generated: `pnpm fetch:hog` then `pnpm merge:hog` rewrite every `head-of-government` term. Do not edit them in the country files. Fix the source instead: on Wikidata, or in `data/overrides/heads-of-government.json` (missing terms), `data/overrides/persian-names.json` (missing Persian names) or the `EXCLUDE` and `RULES` tables in `scripts/merge-heads-of-government.ts`.
- **Ids** are lowercase kebab-case (`ahmad-shah-qajar`).

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
