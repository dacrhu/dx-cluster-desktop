# The spot table

The **Spots** tab is the heart of the app: a fast, virtualised table of every
DX spot received, newest at the top.

## Columns

- **Age** — how long ago the spot arrived, refreshed continuously.
- **Frequency** and **Band**.
- **DX** — the spotted station, with its DXCC entity, CQ zone and beam heading
  from your locator (hover for detail).
- **Spotter** — who reported it, with their DXCC.
- **Mode** — CW / SSB / DIGI / FM, colour-coded. The label shows the specific
  sub-mode (FT8, RTTY, SSTV…) when the comment reveals it.
- **Comment** — the spotter's note (QSX, RST, "up 2", etc.).

Rows that match an enabled alert are tinted. When rig control is on, the row
nearest your VFO is highlighted.

## Quick filters

The bar above the table is **shared with the Bandmap and Map**:

- **Search box** — the [query language](search-query.md), with a **?** popover
  documenting it.
- **Skimmer** and **WSJT-X** toggles — show/hide those spot sources.
- **Band chips** and **Mode chips** — click to include; empty means "all". The
  band list is built from the bands actually present in the feed.

Filtering is instant and local — it never changes what the node sends. For
node-side filtering see [Spot filters](filters.md).

## Freeze-on-scroll

Scroll down and the table **freezes** a snapshot so incoming spots don't move
what you are reading. A pill at the top ("↓ N new") jumps back to the live top.
Changing the search auto-unfreezes.

## Left-click: the spot popover

Click a spot to open a compact fact card with frequency/band, mode, DXCC,
spotter, heading, age and comment, plus action buttons:

- **Tune radio** — set your rig to the spot (needs [CAT](rig-and-logging.md)).
- **Split — TX on …** — only shown when a QSX/split is detected in the comment.
- **Prepare QSO** — hand the spot to your logging program (needs
  [log push](rig-and-logging.md)).
- The shared **action menu** (see below).

## Right-click: the action menu

- **Talk to the DX / spotter** — jumps to the Talk tab with that call.
- **Prepare a post** — pre-fills the "post a spot" form below with this
  frequency and call.
- Copy helpers.

## Posting a spot

The **post-a-spot** form at the bottom takes a frequency, a callsign and an
optional comment, and sends a correctly formatted `DX` command to your
[send-target](settings.md) node. When CAT is connected the frequency field
tracks your VFO until you type in it; a **VFO** chip snaps it back.

## New-activity dot

The Spots tab shows an activity dot when a spot matching your current search
arrives while you are on another tab.
