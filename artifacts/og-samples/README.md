# Persian link-preview samples

- `fa-1919-qajar.png`, `fa-1941.png`: the current renderer. Persian is laid out word by word, so word order is right but spaces are uneven.
- `fa-1919-harfbuzz-spike.png`: a spike (not in the app) that shapes each line with harfbuzzjs, orders it with the Unicode bidi algorithm (bidi-js), and draws the glyphs as SVG paths inside the same image. Spacing, joining and the order of numbers inside Persian text all match a browser.
