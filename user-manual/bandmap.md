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

## Special reference markers

Two static, frontend-only marker sets are drawn into each lane as half-height
rows:

- **SOS** (red) — the IARU Region 1 "global emergency" simplex frequencies
  (3760 / 7060 / 14300 / 18160 / 21360 / 24960 / 28560 kHz). These are a
  courtesy calling/coordination point for disaster traffic, **not** an official
  distress frequency.
- **IBP** (blue) — the five NCDXF/IARU International Beacon Project frequencies
  (14100 / 18110 / 21150 / 24930 / 28200 kHz).

Click one for a minimal popover with a **Tune radio** button (hidden when CAT is
off). There is a legend strip at the top of the panel.

## Interaction

- **Left-click** a station → the spot popover (tune / split / prepare QSO / actions).
- **Right-click** a station → the action menu.
- See [The spot table](spots.md) for what those do.

## With rig control

When [CAT](rig-and-logging.md) is connected the Bandmap adds:

- a **cursor line** at your VFO; the containing lane is highlighted and the
  others fade,
- the spot within ~0.5 kHz of the VFO is ringed,
- the active lane **auto-scrolls to keep the VFO centred**. A manual scroll
  pauses that (and freezes the lane); the **⌖** button in the lane header, or
  changing band, resumes it,
- **clicking another lane's header QSYs the rig to that band** (the middle
  spot's frequency, or `low edge + 20 kHz` if the lane is empty). Frequency
  only — no mode change.
