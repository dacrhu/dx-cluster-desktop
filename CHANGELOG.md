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

## [1.4.1] - 2026-09-14

### Fixed

- The alert sound was silent in the Linux AppImage build: WebKitGTK plays
  audio through GStreamer, and the bundled AppImage shipped with no
  GStreamer plugins at all, so nothing could ever reach the speakers (the
  desktop notification still worked, which is why this could go unnoticed).
  The AppImage now bundles the GStreamer media framework needed for audio
  playback.
- Reworked the Morse alert sound: a fuller keying tone with a proper
  attack/hold/release envelope (instead of one that started fading the
  instant it was struck) and a more clearly long/short dash-to-dot ratio.

## [1.4.0] - 2026-09-13

### Added

- Alert rules gained an **exact callsigns** field alongside the existing
  callsign-prefix field: a comma-separated list matched exactly (portable
  `/P`, `/MM`, … suffixes stripped) instead of by prefix, so a long
  hunting/awards list of specific stations no longer misfires on an unrelated
  callsign that merely starts with the same letters (e.g. a rule for `PA5M`
  used to also alert on `PA5MB`).

### Fixed

- The query-help ("?") and Map "Layers ▾" popovers could spill off the left
  edge of the window on a narrow width, clipping their own content with no
  way to scroll to it. They now nudge themselves back on screen after
  opening (and on resize).
- The app's own log file could silently delete itself mid-session: the
  default rotation (40 KB, no backup) meant a busy session's logging would
  wipe its own history right when it was most needed to diagnose a freeze.
  Now rotates at 5 MB and keeps the last 3 archived logs instead of
  deleting outright.

## [1.3.2] - 2026-09-12

### Fixed

- The 1.3.1 fix for the Linux long-session freeze wasn't enough on its
  own — it recurred (sooner, and without the earlier GPU-memory error,
  just a stalled repaint), meaning WebKitGTK can wedge through more than
  one GPU-accelerated code path on Wayland + the proprietary NVIDIA
  driver. Now also disables WebKitGTK's GPU-accelerated compositing
  entirely (`WEBKIT_DISABLE_COMPOSITING_MODE`) alongside the earlier
  DMA-BUF-renderer workaround — WebKitGTK's own documented last resort for
  this class of driver issue. Trades some rendering smoothness (map/bandmap
  redraws) for stability.

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
