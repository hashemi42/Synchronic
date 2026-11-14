# UX review screenshots

Captured with Playwright (Chromium) against production builds. Not used by the app or by tests.

- `before/` — the last committed state (before the four interaction features and the Persian date and mobile dock polish).
- `after/` — the working tree with those changes.

| File | What it shows |
|---|---|
| `desktop-en.png` | Desktop, English: top bar and lanes |
| `desktop-fa.png` | Desktop, Persian (right to left) |
| `mobile-fa-top.png`, `mobile-fa-scrolled.png`, `mobile-fa-end.png` | Phone (375×667), Persian: top of page, mid-scroll with the dock floating over the lanes, end of page |
| `in6-badge-closed.png`, `in6-badge-open.png` | China 1920 lane. Before: rival government always listed, no badge. After: "+1" badge, closed and open |
| `search-dialog.png` | Before: the Add-country dialog from the page button. After: opened from the top bar, searching "Ghajar" |
| `persian-calendar-lane.png`, `persian-calendar-dock.png` | Persian lane right column and time dock. Before: Gregorian years. After: Solar Hijri first, Gregorian second |

## TD-2: era strip and detail track (`td-2/`)

`*-dock.png` is the time dock alone; the other file of each pair is the full page.

- `desktop-en-all-time` — Russia and Germany: the strip shows Russia's states on the all-time track.
- `desktop-en-zoomed` / `desktop-fa-zoomed` — zoomed to 1900–1950: strip, slider with lens, and the detail track (Persian ticks are Solar Hijri).
- `mobile-fa-zoomed` — phone, 375×812.
