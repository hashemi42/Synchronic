## What this changes

<!-- One or two sentences. Link the issue it fixes: "Fixes #…". -->

## Checklist

- [ ] `pnpm data:validate`, `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.

**If it changes data** (`data/`):

- [ ] `pnpm data:pipeline` was run and `data/merged/` is committed with the curated file.
- [ ] Every new or changed fact has a source in its `sources` field.
- [ ] English and Persian names are both filled in.
- [ ] New flags: licence and attribution are set, and `pnpm mirror:flags` was run and its files committed.
- [ ] I have read the data-diff comment CI posts on this pull request, and it shows only what I meant to change.

**If it changes the app** (`src/`, `messages/`):

- [ ] It works in English and Persian (right to left), on a phone and on a desktop.
- [ ] It works with the keyboard alone, and new text is in both `messages/en.json` and `messages/fa.json`.
- [ ] `pnpm build && pnpm test:e2e` pass (browser and accessibility tests).
- [ ] Screenshots for visible changes.

By contributing you agree that code is released under MIT and data under CC BY-SA 4.0 ([DATA_LICENSE](https://github.com/hashemi42/Synchronic/blob/main/DATA_LICENSE)).
