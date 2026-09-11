# Changelog

Human-readable release notes for DX Cluster Desktop. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — each version has
short, plain-English bullets a user (not just a developer) can understand.

The **`[Unreleased]`** section collects entries as they land on `main`; when
cutting a release, rename it to the new version + date and start a fresh
empty `[Unreleased]` above it. `.github/workflows/release.yml` pulls the
section matching the pushed tag straight into the GitHub release notes, so
every entry should already read the way it will appear there.

## [Unreleased]

## [1.3.1] - 2026-09-11

### Fixed

- Fixed a long-session freeze / graphical-corruption issue on Linux with the
  proprietary NVIDIA driver, where the window would eventually stop
  repainting (leaving "ghost" trails when dragged) or the app would crash
  outright after many hours of uptime — a known WebKitGTK GPU-memory issue
  on Wayland + NVIDIA, worked around by disabling WebKitGTK's DMA-BUF
  renderer.
- Spot/announcement/WWV/WCY/talk/chat history now auto-prunes after 30 days
  instead of growing forever (a single day-long session could reach
  hundreds of thousands of rows); database access also no longer runs on
  the main thread, so a slow query can no longer stall the whole UI.

## [1.3.0] - 2026-09-11

### Added

- Connection profiles for DXSpider nodes can now request skimmer (RBN)
  spots on or off — no more typing `set/skimmer` / `unset/skimmer` by hand.
  Set it once per profile and it's sent automatically right after every
  login; a "send now" button also applies it to an already-open connection
  without reconnecting.

## [1.2.0] - 2026-09-11

### Fixed

- Panning and zooming the map is noticeably smoother — the arcs it draws
  (band openings, "reports of me", home-station lines) now use a much
  cheaper rendering method.

### Added

- The band-openings map layer can now be limited to activity heard by
  stations near your own location, via a new distance slider.

## [1.1.0] - 2026-09-10

### Added

- New **Band Activity** panel: a band × continent grid showing recent spot
  trends at a glance, plus a "biggest movers" summary of bands heating up
  or cooling down.
- The user manual is now available in Hungarian and German inside the app
  (any page not yet translated falls back to English).
- The app checks for new releases on startup and shows a one-time popup
  with the release notes when an update is available (can be turned off in
  Settings).

## [1.0.0] - 2026-09-09

### Added

- First public release — a full-featured Telnet DX cluster client:
  - Live, filterable spot table with a powerful search language, GUI-built
    node-side filters, and desktop/sound alerts.
  - Map and band-map visualisations, including propagation layers (grey
    line, aurora, estimated MUF, band openings, band-activity rose) and
    "who's hearing me" via RBN / PSK Reporter / WSJT-X.
  - Mail & bulletins, talk, chat/conference, users list, and a Tools panel
    for cluster `sh/*` queries.
  - Optional rig control (CAT) and one-click "prepare a QSO" push to your
    logging software.
  - Built-in cluster node presets, DXCC country data, and full Hungarian /
    German localisation.
