# The activity matrix

The **Activity** tab answers a question the spot table can't: _which band is
picking up, and toward where?_ It reads the spot stream, bins it by band and by
the DX station's continent, and shows the **trend** — a 15-minute moving average
against the preceding 15 minutes.

At a glance you can see, for example, that 40 m is opening toward Europe while
15 m toward North America is fading.

## The "biggest movers" strip

Two rows at the top — **Rising** and **Falling** — each list up to three
`band → continent` pairs, ranked by how much they moved:

- `40m → EU  ▲▲ +180%` — in the last 15 minutes there were roughly 2.8× as many
  40 m spots for European DX as in the 15 minutes before.
- `▲▲` / `▼▼` = a strong move (±100 % or more); `▲` / `▼` = a milder one
  (±25 %).
- **new** instead of a percentage means the band was silent in that direction a
  moment ago and just came alive.

If nothing is clearly moving, the strip shows a single neutral line instead.

Click any mover to jump to the **Spots** tab filtered to that band and
direction.

## The matrix

Rows are bands, columns are the DX station's continent. The column header shows
the continent, its overall trend arrow, and its total spot count for the last
two hours.

Each cell carries:

- a **sparkline** of the last two hours in 15-minute buckets,
- a **glow** whose brightness tracks the cell's total traffic (a busy cell
  stands out even if its trend is flat),
- a **badge** — `▲▲ ▲ – ▼ ▼▼` and the percentage change. Green is rising, red is
  falling, a muted `–` is steady.

An empty cell (a faint `·`) means no spots on that band toward that continent in
the window.

The grid fills the panel: with only a few bands the rows grow and the sparklines
get large; with many bands the rows shrink to a fixed minimum and the grid
scrolls. Narrowing the bands (here or at the node) is a fine way to get bigger
charts.

Click a cell to open **Spots** filtered to that band and direction.

## "Spotters" — scoping the trend

This is the important control. "40 m is rising toward North America" is
**misleading** if every skimmer that hears North America also _sits_ in North
America — from your own station you might not hear a thing.

So the matrix first narrows the spots to those made by a **spotter on a chosen
continent**, and only then bins them by where the DX is. The **Spotters**
selector picks that continent:

- **Auto** — your own continent, worked out from your QRA locator (set it in the
  [Connection panel](connections.md)). This is the default and the most useful:
  it shows what is workable _from here_.
- **A specific continent** — see what, say, North American stations are hearing.
- **Anywhere** — no spotter filter; every spot counts.

Without a QRA locator, Auto falls back to _Anywhere_ and the panel says so.

## Filters and windows

- The quick-filter bar (search, skimmer / WSJT-X toggles, band and mode chips)
  is **shared with Spots, Bandmap and Map**. Narrowing to `mode:cw`, for
  instance, gives you a CW-only trend.
- The windows are fixed: a **15-minute** moving average and a **2-hour**
  sparkline history. They are deliberately **independent of the top-bar "max
  age"** setting — the panel always needs the full two hours of history.
- Everything is measured data from the spot feed over a short window — an
  estimate of momentum, not a propagation prediction.
