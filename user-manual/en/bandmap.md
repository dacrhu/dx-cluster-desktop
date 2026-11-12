# The bandmap

The **Bandmap** shows one scrollable vertical lane per band, with stations laid
out by frequency — the classic "bandmap" view, driven entirely from the spot
feed.

## Reading a lane

- **One row per station.** Spots of the same call within ~0.5 kHz collapse into
  a single marker showing the freshest spot and a **×N** badge (hover for the
  list of spotters). A station hammered by many skimmers is one row, not eight.
- The **frequency axis is non-linear**: rows are packed by density and each row
  prints its exact frequency in the left gutter. The **band-plan shading**
  (CW / DIGI / SSB) stretches to follow the rows. An empty lane falls back to a
  plain linear scale with MHz ticks.
- **Age fade** dims older spots; **alert tint** marks a station matching an
  enabled alert.
- A **mode dot** (no text) is coloured by category; the tooltip has the
  sub-mode.

## Filtering and zoom

The quick-filter bar (search, skimmer/WSJT-X toggles, band and mode chips) is
**shared with Spots and Map** — see [The spot table](spots.md) and
[the query language](search-query.md). The lanes shown are simply the bands
present in the filtered spots.

**Vertical zoom**: `Ctrl` + mouse wheel, or the slider. `1` fits the viewport;
higher scales lane height and marker font. The setting is remembered.

**Linear scale** (checkbox in the toolbar): by default each station gets its own
row, so empty stretches of the band are skipped. With *Linear scale* on, the lane
is a proportional frequency axis with a kHz ruler — gaps stay visible — and
stations that would overlap are placed side by side (up to four columns; extra
ones are counted in the lane header, zoom in to see them). The setting is remembered.

## Special reference markers

Two static, frontend-only marker sets are drawn into each lane as half-height
rows:

- **SOS** (red) — the IARU Region 1 "global emergency" simplex frequencies
  (3760 / 7110 / 14300 / 18160 / 21360 / 24960 / 28360 kHz). These are a
  courtesy calling/coordination point for disaster traffic, **not** an official
  distress frequency.
- **IBP** (blue) — the five NCDXF/IARU International Beacon Project frequencies
  (14100 / 18110 / 21150 / 24930 / 28200 kHz).

### Optional markers and your own frequencies

The **Markers ▾** button in the quickbar adds more rows, all off by default:
the usual calling/dial frequencies of **FT8, FT4, FT2, JS8, RTTY, SSTV** and
**FreeDV** (tick the ones you want). SOS and IBP are fixed and can't be turned
off. Below the checkboxes you can add **custom frequencies** — a name, a kHz
value and a colour, e.g. the frequency you and your friends meet on. They're
saved with your settings and drawn in the lane that contains them. Markers that
share a frequency (e.g. FT4 and JS8 on 18104 kHz) merge into one row. These are
common conventions, not allocations.

Click one for a minimal popover with a **Tune radio** button (hidden when CAT is
off). There is a legend strip at the top of the panel.

## Interaction

- **Left-click** a station → the spot popover (tune / split / prepare QSO / actions).
- **Right-click** a station → the action menu.
- See [The spot table](spots.md) for what those do.

- Every lane shows its **band start and end** (frequency in MHz) as a marked edge. Band limits differ
  between IARU regions (e.g. 40 m ends at 7200 kHz in Regions 1 and 3, 7300 in Region 2), so the
  quick bar has an **IARU region** select — _Auto_ takes it from your QTH locator. The part of a
  lane beyond your region's limit is hatched; spots there are still shown.

## With rig control

When [CAT](rig-and-logging.md) is connected the Bandmap adds:

- a **cursor line** at your VFO; the containing lane is highlighted and the
  others fade,
- the spot within ~0.5 kHz of the VFO is ringed,
- if the radio **leaves the amateur bands**, a flashing red "out of band" banner
  appears and the nearest band's edge marker (and lane header) flash red,
- the active lane **auto-scrolls to keep the VFO centred**. A manual scroll
  pauses that (and freezes the lane); the **⌖** button in the lane header, or
  changing band, resumes it,
- **clicking another lane's header QSYs the rig to that band** (the middle
  spot's frequency, or `low edge + 20 kHz` if the lane is empty). Frequency
  only — no mode change.
