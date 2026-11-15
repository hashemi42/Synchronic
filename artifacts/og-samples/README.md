# Link-preview samples

Current renderer (Persian text shaped with harfbuzzjs, ordered with the Unicode bidirectional algorithm, drawn as SVG paths):

- `fa-1919-qajar.png`: Iran, the UK and Russia in 1919, anchored to Ahmad Shah Qajar; the subtitle has a year range in brackets inside Persian text.
- `fa-1970.png`: five lanes in 1970, four shown and "+۱ کشور دیگر".
- `en-1919-qajar.png`, `en-1941.png`: the English images, unchanged in approach.

Earlier renderer, for comparison:

- `fa-1941.png`: Persian laid out word by word, with uneven spaces.
- `fa-1919-harfbuzz-spike.png`: the first harfbuzz spike. Its brackets point the wrong way in the subtitle; fixed in the app, where harfbuzz mirrors them.
