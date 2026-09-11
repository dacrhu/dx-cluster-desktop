# CLAUDE.md

Guidance for working in this repository.

## What this is

Multiplatform desktop DX cluster client (ham radio). **Telnet only.** Core
principle: every cluster feature is driven from GUI (tables, clickable rows,
forms) — never require the user to type raw cluster commands. A secondary
_Raw terminal_ tab exists for power users.

## Stack

- `src-tauri/` — Rust backend, Tauri 2, tokio. Owns the telnet connections,
  line parsing, command building, reference data (`cty.dat`, geo math), SQLite
  store, alerts.
- `src/` — React + TypeScript + Vite frontend. Panels under `src/panels/`,
  shared widgets under `src/components/`, IPC wrappers in `src/lib/ipc.ts`,
  state in `src/store/` (Zustand).

## i18n

- UI strings live in flat `key → string` JSON files: `src/i18n/locales/{en,hu,de}.json`.
  English (`en.json`) is the source of truth / fallback.
- `src/i18n/index.ts` exposes `t(key, params?)` (with `{name}` interpolation) and
  the `useT()` hook (re-renders on `store.lang`). Components call
  `const tr = useT()` then `tr("some.key")`. Never hard-code user-facing text in a
  panel — add a key to all three locale files instead.
- Language preference (`system` | `en` | `hu` | `de`) is in the Zustand store
  (`lang`) and persisted in `settings.json`; `App.tsx` calls `setActiveLang()`.
  For `system`, the OS locale comes from the `system_locale` Tauri command
  (`sys-locale` crate) — `navigator.language` is unreliable in WebKitGTK — and is
  cached in the store as `sysLocale` + fed to `i18n` via `setSystemLocale()`.
- Adding a language = copy `en.json` to `xx.json`, translate the values, register
  it in `LANGUAGES` + `DICTS` + `LangCode` in `index.ts`. See `TRANSLATING.md`.
- Keep the three files key-for-key identical (no missing / extra keys).
- **User manual** (`user-manual/`) is localised per-directory: `user-manual/en/`
  is the source of truth, `user-manual/hu/` + `user-manual/de/` are translations.
  The in-app Help tab (`AboutPanel`) calls `get_doc(slug, lang)` — the Rust
  command tries `user-manual/<lang>/<slug>.md` (GitHub `main`, then the bundled
  Tauri resource) and **falls back to `en/` page-by-page**, so a partly
  translated language still works; `DocPage.lang` reports what was actually
  served and the panel shows `about.langFallback` when it differs. Bundling globs
  in `tauri.conf.json` are per-language. Adding a manual language = new
  `user-manual/<xx>/` dir + a bundling glob; untranslated pages just fall back.

## Conventions

- Keep `src/lib/ipc.ts` types in sync with the `#[tauri::command]` surface in
  `src-tauri/src/lib.rs`.
- All outgoing cluster command strings are built in `src-tauri/src/commands/`
  (one place, unit-tested), never assembled ad hoc in the frontend.
- Incoming lines are parsed in `src-tauri/src/parser/` into a typed
  `ClusterEvent` enum; unknown lines fall through to `Raw`.
- Node dialect differences (DXSpider vs AR-Cluster) are handled in the command
  builder and parser, selected per connection profile.
- Content (spot rows, talk/chat messages, mail body, `.data-table` cells) is
  sized with the `--font-data` CSS var (15px) in `src/styles/global.css` — bump
  it there, not per-selector. Chrome (menus, column headers, `.msg-meta`/
  `.msg-from`, forms, raw console) keeps its own smaller sizes. The spot table's
  virtual-row height (`.spot-row` height + `estimateSize` in
  `components/SpotTable.tsx`) must stay in sync (currently 28px).
- **Render performance (all 15 panels stay mounted, `App.tsx` only toggles
  `hidden` — never conditionally rendered — so per-panel state like fetched
  lists, scroll position or open threads survives a tab switch).** That means
  every mounted panel's own store subscription fires on every store change,
  tab-visible or not, so a few rules keep a busy spot feed from burning CPU in
  the background:
  - Never call `useCluster()` bare (subscribes to the _whole_ store — any
    field, anywhere, re-renders you). Select only what you use: a single field
    as `useCluster((s) => s.foo)`, several as
    `useCluster(useShallow((s) => ({ foo: s.foo, bar: s.bar })))` (`useShallow`
    from `zustand/react/shallow`).
  - Every panel (`src/panels/*.tsx`) and the heavy always-mounted
    visualisations (`components/WorldMap.tsx`, `components/Bandmap.tsx`) are
    wrapped in `React.memo`. A new one should be too. Memo only pays off if
    the props you hand it are stable — a prop built from a store array/object
    (`useVisibleSpots()`, `useSpotActions()`, …) must itself be memoized
    (`useMemo`/selector), and a callback prop from `App.tsx` must be a
    `useCallback`, not an inline arrow (`goToFilters`/`goToSpots` there are the
    pattern to copy).
  - Incoming spots are **batched**: `ipc.onSpot` in `App.tsx` buffers into
    `pendingSpots` and flushes once per `SPOT_FLUSH_MS` (200 ms) via
    `store.addSpots()`, instead of one `store.addSpot()` `set()` per spot — a
    busy RBN feed can otherwise fire many `set()`s a second, each one
    re-rendering every mounted panel.
  - `MapPanel` / `BandmapPanel` additionally take an `active` prop from
    `App.tsx` (`tab === "map"` / `"bandmap"`) and pass it into
    `useVisibleSpots(active)` / `useMyReports(active)`, which freeze their
    `store.spots` input via `useFrozenWhenInactive()` (`src/lib/util.ts`) while
    the tab is hidden — so the shared filter (a scan of up to `MAX_SPOTS`
    = 5000 rows) and the reports scan (two regexes per match) don't re-run on
    every ~200 ms spot flush for a tab nobody is looking at, and the memo on
    the SVG/DOM-heavy `WorldMap`/`Bandmap` child then bails on stable props.
    Everything catches up instantly on switching back. Don't pass `active` from
    `SpotsPanel` — it calls `useVisibleSpots()` bare (stays live) because its
    newest-match timestamp feeds the cross-tab "new activity" dot
    (`store.spotsMatchTs`). `MapPanel` still freezes `entities` (not
    spot-derived) separately.
  - Minor known gap: `Bandmap` reads `store.rigVfo` for the CAT cursor without
    the `active` freeze, so it re-renders ~1/s while CAT is connected even when
    hidden.

## Git workflow

Solo project — commit straight to `main`, no feature branches, no PRs. Only
start branching once more than one person is developing against this repo at
the same time.

## Release notes

`CHANGELOG.md` (Keep-a-Changelog style) is the source of the GitHub release
body's "What's new" section — plain-English bullets, not a raw commit dump.
An `[Unreleased]` section at the top collects entries as work lands; before
pushing a version tag, rename it to `[<version>] - <date>` and start a fresh
empty `[Unreleased]` above it. `.github/workflows/release.yml` runs
`.github/scripts/extract-changelog.mjs <tag>` to pull the section matching
the pushed tag straight into the release body (falls back to "See the commit
history for details." if a version has no section — don't forget to rename
`[Unreleased]`). The commit-history and user-manual links stay at the end of
the release body regardless.

## Checks before committing

```sh
pnpm lint && pnpm test && pnpm build
cargo fmt --all -- --check \
  && cargo clippy --workspace --all-targets --all-features -- -D warnings \
  && cargo test --workspace
```

Frontend tests: `vitest` (`*.test.ts` next to the source). The spot-search
query language lives in `src/lib/query.ts` (`compileQuery`) with a full test —
fields `dx: by: dxcc: … freq: age:`, `-`/`OR`, quoted phrases, and `re:PATTERN`
(a case-insensitive JS regex over dx call / spotter / comment, e.g. `re:/MM$`).
`AlertRule` (`src/lib/alerts.ts`) carries an optional `query` string run through
`compileQuery` (cached per string) and ANDed with its prefix/DXCC/band/mode
fields — the Alerts panel's "advanced query" input. `components/QueryHelp.tsx`
is the shared "?" popover documenting the language; it sits next to every query
input (Spots, Bandmap, Map quickbars + the Alerts query field). `mode:` matches
the category (`cw`/`ssb`/`digi`/`fm`) **or** the specific sub-mode shown in the
table — `mode:sstv`, `mode:ft8`, `mode:rtty` etc. work via `modeLabel` + a
whole-word comment token (sub-mode list in `src/lib/mode.ts`, mirrored in
`band.rs::mode_from_comment`).

`cargo test` piped through `tail` shows nothing until it exits (tail buffers) —
write output to a file instead. Session tests use `#[tokio::test(start_paused)]`
with a `guarded()` wrapper so a stalled loop fails fast.

## Roadmap

Phased — see the plan file
`~/.claude/plans/a-feladat-md-ben-a-kezdeti-pure-dahl.md` (phases 0–13 done —
8–11 = RBN / PSK Reporter / WSJT-X / cluster presets; phase 12 = map
propagation-visualisation layers; phase 13 = measured MUF from kc2g ionosondes;
see below).

**Done:** phase 0 scaffold + CI; phase 1 MVP (connect, live spot table, GUI /
local query filters, spot post, raw console); phase 2 (announcements, WX, WWV,
WCY); phase 3 (talk threads, users list + sh/station detail, buddy list) + chat
/ conference (join/leave, per-group threads, sh/chat import); phase 3b (mail &
bulletins — DIRECTORY list, READ + SQLite cache, DELETE, interactive
SP/SB/REPLY compose orchestrated from `sendMail` in `lib/ipc.ts`); phase 4
(Tools panel — generic `sh/*` query with raw display + structured `SH/DX`
historical, from the node or offline from the local `spots` table via
`store::search_spots`); phase 5 (Alerts panel — watch-list → desktop
notification + Web-Audio beep, matched in `App.tsx::checkAlerts`; `cty.dat`
auto-update in `src-tauri/src/cty_update.rs` (`CTY_URL` =
`raw.githubusercontent.com/dacrhu/dx-cluster-desktop/main/src-tauri/resources/cty.dat`,
conditional GET like `presets_update.rs`; canonical source country-files.com
pulled weekly into that committed copy by `data-update.yml`, credited via
`conn.ctyCredit`), `AppState.cty`
is now `RwLock` and hot-swapped; spot dedup across nodes in `store::insert_spot`
— 90s window on dx_call/freq/spotter, returns `Option<i64>`).

**Alert hits:** every spot that fires an alert is logged to `store.alertHits`
(newest first, cap 100, persisted to `alertHits` key in the tauri store — not
`settings`), shown as a table at the top of the Alerts panel (click a row →
opens Spots with `dx:<call>`), and the matching live rows are tinted
(`.spot-row.alert-hit`, `matchingAlert()` in `lib/alerts.ts`). The Alerts tab
gets the activity dot on a new hit. `AlertsPanel` takes an `onGoToSpots` prop;
cross-panel search hand-off goes through `store.pendingSpotSearch`.
`checkAlerts` in `App.tsx` has a 5-min per-`rule:dx_call` notification cooldown
_and_ skips logging a hit when the same call at ~this frequency already fired in
that window (dedups multi-spotter / multi-rule bursts into one row). Each watch
rule is a collapsible card (`.alert-rule`): the always-visible head is
enable-checkbox + name + `describeAlert()` one-liner + delete; the editor body
(name, match-spotter, prefixes, advanced query, band/mode/continent chips)
expands on click. Accordion: `AlertsPanel` (and `FiltersPanel`) keep a single
`expanded: string | null` — at most one card open, all collapsed by default;
adding a rule opens just the new one.

`AlertsPanel` layout is three `<section>`s under the title-only `.panel-head`:
(1) `.alert-hits` — a prominent card (left accent bar, elevated bg), its
`.alert-hits-scroll` fixed at `max-height: 390px`, table font bumped to 18px
(`.alert-hits-table td`); (2) `.alerts-settings` — the notification block
(`alerts.settingsTitle`), `.post-spot.alerts-notify` runs full width
(`max-width: none`), holds the on/sound checkboxes + sound-style select + Test;
(3) `.alerts-rules` — heading (`alerts.rulesTitle`) **+ the "+ New rule" button
lives here**, not in the panel head — then the AND-note and the `.rule-list`.
Sections 2 and 3 are separated by a top border.

Alert-sound bursts are de-duped in `beep()` (`src/lib/notify.ts`): a
`beepBusyUntil` guard on the `AudioContext` clock (`SOUND_LEN` per style)
swallows further `beep()` calls while a chime is still playing, so N
simultaneous alert hits sound once.

**Global spot age cap:** `store.spotMaxAgeMin` (`settings.spotMaxAgeMin`, 0 = off),
a number field in the top bar. `useVisibleSpots()` drops older spots (Spots +
Bandmap) and `store.pruneAlertHits()` drops older alert hits. A 30s timer in
`App.tsx` (`ageTickAndPrune`) bumps `store.ageTick` — a dep of `useVisibleSpots`
— so age-based views refresh while the feed is quiet, and persists any pruned
alert-hit list.

**Localisation & alert sounds:** the whole UI is translated through
`src/i18n/` (English / Hungarian / German, community-translatable via GitHub —
see `TRANSLATING.md`). Three selectable synthesised alert sounds
(`chime` / `morse` / `sweep`) in `src/lib/notify.ts`, chosen in the Alerts panel;
language chosen in the Connection panel's Settings section.
`notify()` sends the desktop toast via the **Rust** `os_notify` command, with the
JS plugin as a fallback. Two Linux gotchas drove this: the
`@tauri-apps/plugin-notification` JS `sendNotification` is a silent no-op, **and**
the plugin's Rust `builder().show()` fires `notify-rust` from inside
`tauri::async_runtime::spawn` with the result dropped (`let _ = …`) — its
`zbus::block_on` never completes on a tokio worker, so no D-Bus call goes out and
the failure is invisible. `os_notify` therefore calls `notify-rust` (explicit
dep) directly on a dedicated `std::thread` and logs the real outcome
(`os_notify: shown …` / `os_notify failed: …`). It sends a `desktop-entry` hint +
icon of `hu.dacr.dxclusterdesktop` so GNOME attributes the toast to the app
(`application-id` in `org.gnome.desktop.notifications.application`); `pnpm tauri
build` installs that `.desktop`, and for a **dev** `cargo` run it must exist by
hand at `~/.local/share/applications/hu.dacr.dxclusterdesktop.desktop` with
`Exec=…/target/debug/dx-cluster-desktop` (workspace target dir, not
`src-tauri/target`) — GLib rejects the file if `Exec`'s binary is missing.

The nastier GNOME 49 bug: its freedesktop notification **source is destroyed the
instant the sending D-Bus connection disconnects** (`messageTray.js`
`_onNameVanished` → `source.destroy()`), which kills the banner before it draws —
but _only_ for a notification attributed to an app (i.e. with `desktop-entry`;
`notify-send` has none, so it's spared). `notify-rust` opens a fresh connection
per `show()` and drops it on return, so `os_notify` parks recent
`NotificationHandle`s in the `NOTIFY_HANDLES` static (bounded ring of 8, Linux
only) to hold their connections open. Verified live via
`org.gnome.Shell.Eval` + `Main.messageTray` introspection under
`global.context.unsafe_mode`.

`DXCD_NOTIFY_TEST=1` fires a self-test notification at startup.
`primeNotifications()` requests permission at bootstrap (JS-fallback path only).

**Bandmap:** `BandmapPanel` (tab in the "spotting" group) → `components/Bandmap.tsx`
— one scrollable vertical lane per band. Layout is one row per **station**,
frequency-ordered: spots of the same call within a ~0.5 kHz bucket (`Lane`'s
`groups` — key `CALL|round(khz*2)`) collapse into one marker showing the
freshest spot + a `×N` badge (`.bandmap-spot-n`; tooltip lists the spotters),
so a station hammered by many skimmers isn't 8 rows. The frequency axis is
non-linear (`yOf` = group row index): the CW/DIGI/SSB band-plan shading
stretches to follow density, each row shows its exact frequency in the left
gutter. Age fade, alert tint (any spot in the group), right-click → shared
`SpotAction` menu, left-click → `SpotPopover` — all on the representative
spot. An empty lane falls back to a plain proportional scale with MHz ticks.

**Band activity matrix:** `BandActivityPanel` ("activity" tab in the "spotting"
group) → `components/BandActivityMatrix.tsx`. A band × DX-continent grid; each
cell = a 2 h sparkline (8 × 15 min buckets, oldest→newest) + a volume-scaled
`--accent` glow + a 5-step trend badge (`▲▲ ▲ – ▼ ▼▼` + Δ%), where trend =
last-15-min count vs. the preceding 15 min (`bandActivityMatrix` /
`classifyTrend` in `src/lib/bandActivity.ts`, unit-tested). A "biggest movers"
strip (top 3 rising / 3 falling by |Δ%|, min-traffic gated) sits above; each
mover + each cell click → `onGoToSpots` with `spotBands=[band]` +
`spotQuery="cont:<dx> bycont:<from>"` (both tokens already in `compileQuery`).
**Scope:** the spots are first filtered to a spotter continent (`from`), _then_
bucketed by DX continent — otherwise "40m rising toward NA" is a lie when every
NA-hearing skimmer also sits in NA. `store.bandActivityFrom`
(`settings.bandActivityFrom`, persisted): `""` = auto (QTH continent via
`lib/continents.ts::lonLatToContinent` — rough bounding boxes, unit-tested — off
`homeLocator`), `"*"` = anywhere, else a continent code; a `<select>` in the
quickbar. Feeds off `useTrendSpots(active)` (`src/lib/visibleSpots.ts`) — the
shared pipeline (QuickFilters chips, search, skimmer/WSJT-X, node filters) **minus
the `spotMaxAgeMin` cap**, since the 2 h history must survive whatever the top-bar
age cap is; frozen when the tab is hidden like the other heavy panels. Pure
frontend, no Rust — same class as `openings.ts` / `bandRose.ts`. Manual page
`user-manual/en/activity.md`.

**Modes** are CW / SSB / DIGI / FM (`band::Mode`, `src/lib/types.ts`). DIGI is
everything non-phone, non-CW — FT8/FT4/JT, RTTY, PSK, SSTV, JS8 … `guess_mode`
folds them all in; `store::mode_from_str` maps the legacy `"FT"` rows to DIGI.

**Mode colour coding:** `src/lib/mode.ts` — `modeClass()` → `mode-cw|ssb|digi|fm`
CSS token (`--mode-*`, theme-aware; DIGI is violet); `modeLabel(mode, comment)`
digs the real sub-mode out of the comment (FT8 / RTTY / SSTV …) and falls back
to the category. Tables (Spots / Alert-hits / Tools-history) show the specific
`modeLabel` in the category colour; the Bandmap marker shows a category-coloured
dot (no text) with the sub-mode in its tooltip. The Bandmap's band-plan shading
uses the same hues, faintly. Legend strip on the Bandmap. Vertical zoom
(`store.bandmapZoom`,
persisted) via Ctrl+wheel or a slider — 1 = fit the viewport, higher scales lane
height + marker font. The whole quick-filter row is store-level and **shared by
the Spots, Bandmap and Map panels** — search query (`spotQuery`), skimmer /
WSJT-X toggles, and the band + mode chips (`spotBands` / `spotModes`, inclusion,
empty = all). The chips live in one component, `components/QuickFilters.tsx`
(dynamic band list = bands seen in `store.spots`, HF fallback; the four
`ALL_MODES` categories); `useVisibleSpots()` takes no args and reads everything
from the store. The Bandmap's lanes are just the bands present in the resulting
spots (it no longer has its own hide-lane chips). The context-menu actions are
the `useSpotActions()` hook (Spots panel appends its "prepare a post" action). "Talk to the DX / spotter" set `store.pendingTalk`; `App.tsx` switches
to the Talk tab and `TalkPanel` adopts the call. Band edges / sub-bands in
`src/lib/bands.ts`. That file also carries two frontend-only marker sets drawn
into each lane via `specialFreqsInBand(band)`: SOS = the IARU Region 1 "global
emergency" simplex frequencies (3760/7060/14300/18160/21360/24960/28560 kHz —
a courtesy calling/coordination point for disaster traffic, not an official
distress frequency), IBP = the NCDXF/IARU International Beacon Project's 5
frequencies (14100/18110/21150/24930/28200 kHz). Both are static reference
constants, no backend/store involvement. Each renders as its own half-height
row (`.bandmap-spot-special`, `special-sos`/`special-ibp` — red/blue,
theme-aware `--danger`/`--accent`) showing the frequency + "SOS"/"IBP",
exactly like a spot row but half as tall. Rather than a floating per-kHz
overlay, spot groups and special markers are merged into one
frequency-ordered row list (`Lane`'s `rowsSorted`/`rowTop`/`specialTop`) so
every item — real or marker — always gets its own slot; two fixed marker
frequencies past the last spot can no longer quantize onto the same
"after-the-last-row" offset and land on top of each other. `yOf(khz)` (used
for the band-plan shading boundaries, the radio cursor and follow-scrolling)
walks that same merged list, so it accounts for marker row heights too; an
empty lane (no spots at all) instead places everything — ticks and markers —
on the plain proportional scale as before. Left-click opens a minimal
`SpecialPopover` (frequency + hint text + a single **Tune radio** button,
hidden when CAT is off) — no context menu, no "prepare QSO", it isn't a real
spot. Legend swatches (`.swatch-sos`/`.swatch-ibp`) in `BandmapPanel`'s legend
strip; i18n `bandmap.sosHint|ibpHint` (per-marker tooltip / popover text) and
`bandmap.sosLegend|ibpLegend` (legend tooltip).

**Map:** `MapPanel` (tab in the "spotting" group) → `components/WorldMap.tsx`,
an inline-SVG world map via `d3-geo` + a bundled Natural Earth outline
(`src/assets/countries-110m.json`, loaded once with `?url` + fetch). Projection
`store.mapProjection`: flat equirectangular (`"rect"`, the default), or
azimuthal-equidistant rotated to the QTH (`"azimuthal"`, from `homeLocator` via
`src/lib/grid.ts::locatorToLonLat`, the TS port of `geo.rs`); wheel-zoom +
drag-pan on a `<g transform>`. The map has its **own local palette** —
`--wm-ocean` / `--wm-land` / `--wm-line` set on `.worldmap` (light) and
overridden for dark theme — kept lighter than the app chrome so the dark night
cap reads by contrast; `.wm-spot` / `.wm-report` / `.wm-country-label` halos and
the `.worldmap` background all reference `--wm-ocean`. Layers:
grayline (`src/lib/grayline.ts` sub-solar point → `geoCircle` night cap +
terminator-edge stroke on `.wm-night`, `store.mapGrayline`), range rings, DX-spot dots (`useVisibleSpots()` capped at
600, `modeClass` colour, age fade, `matchingAlert` ring), great-circle arcs
(`store.mapArcs`), and "reports of me" — `src/lib/mapReports.ts::useMyReports()`
`WorldMap`'s shared `arcPath(a, b)` hand-samples the great circle at a fixed 16
points and projects each (bailing/restarting the subpath where `project()`
clips, e.g. past the azimuthal antipode) instead of routing through d3-geo's
`path()` adaptive curvature resampler — that recurses per arc until every
segment is sub-pixel-accurate, which was the actual cost driver behind
reported map lag with the openings/arcs layers on (a long geodesic like
EU↔Pacific spans 100°+ and resamples into many points) — a faint decorative
line doesn't need that precision. The home→DX arcs (`store.mapArcs`) and
report arcs are also now `useMemo`'d (`homeArcs`/`reportArcs`, keyed off
`spotMarks`/`reportMarks`, not `view`) — they used to be built inline in JSX
and re-ran on every render, including every pointermove while dragging the
map. `openingArcs` was already memoized the same way.
filters `store.spots` for `baseCall(dx_call)` matching any connection's callsign,
parses SNR/WPM from the comment, plots the skimmer (`spot.by` position) + a green
arc. **Skimmer position:** `enrich()` (`src-tauri/src/enrich.rs`) resolves a
skimmer spot's `by` to the skimmer's real Maidenhead grid from `reference::SkimmerDb`
(`src-tauri/resources/rbn_skimmers.tsv`, `CALL` / `grid` rows distilled from the
`reversebeacon.net` public skimmer status page) rather than the DXCC-entity centroid
— a US skimmer plots in Maryland, not mid-Kansas. `src-tauri/src/skimmers_update.rs`
loads and weekly-refreshes it (mirrors `presets_update.rs`: a downloaded app-data
copy beats the bundled snapshot beats empty; a setup task `maybe_update` scrapes the
page, hot-swapping `AppState.skimmers`; commands
`skimmers_status` / `maybe_update_skimmers` / `update_skimmers`;
`.github/workflows/data-update.yml` refreshes the bundled file too). The status
page lists only _currently active_ skimmers (~300), so both the runtime refresh
(`merge_tsv`) and the CI job **accumulate** — each scrape is merged into the
existing table (fresh grid wins on conflict), never a plain rewrite, so a
skimmer that's off air at scrape time isn't dropped and coverage only grows. PSK Reporter's
exact receiver locator (`place_by_at_locator`, applied after `enrich`) still wins
over the table; the frontend `spotterLonLat` jitters whatever position it gets by
callsign so co-located skimmers don't stack.
`collapseReports()` (same file, unit-tested) then merges reports that share
`(base dx, base spotter, 0.1 kHz)` — the same skimmer hearing me on one freq
carried by more than one feed (RBN telnet feed, PSK Reporter, and a cluster that
also relays skimmer spots of us each dedup only within themselves) collapse to a
single marker; freshest report wins, `count`/`feeds` ride the `MyReport` and
show as `spotter ×N` in the marker tooltip + popup. The `MyReport` also keeps
`members` (every raw report that collapsed, newest first) — a collapsed report's
popup lists each member's `age · comment` (`.wm-popup-reports`) instead of the
single `.wm-popup-comment`, so per-skimmer detail (SNR/WPM/time) isn't lost. Left-click a dot/report → `.wm-popup`, a tidy fact card (freq/band, mode,
DXCC, spotter, SNR/WPM for reports, heading, age + comment) built inline in
`WorldMap`; dismissed by an outside click (document `mousedown`), Escape, or its
`×`. Its "Actions ▾" button opens the shared `SpotAction` menu; right-click a dot
still opens that menu directly. Faint DXCC prefix labels
(`store.mapLabels`) from the new `cty_entities` Tauri command
(`CtyDb::entities()`, `crates/…/reference/cty.rs`) — greedily dropped in
`WorldMap` if they'd land within a shrinking (as you zoom in) screen radius of
one already placed, so the world view stays legible; labels render above the
spot/report markers with a background-colour text halo (`paint-order: stroke`)
so they stay readable regardless of what's under them. Spots and reports that
fall back to a bare DXCC centroid (no grid on the spot) are nudged by a small
deterministic per-callsign offset (`jitterDeg` in `src/lib/grid.ts`) so
co-located stations — and the country's own prefix label — don't all land on
the exact same pixel. Map settings persist in `settings.json` (`mapProjection`
/ `mapGrayline` / `mapArcs` / `mapLabels` + the phase-12 layer flags below).
The Map quickbar carries the shared `<QuickFilters>` band + mode chips like the
other panels (`store.spotBands` / `spotModes`); the filter flows to the markers
and the openings / band-rose layers.

**Map — propagation layers (phase 12).** Six extra toggles in the Map quickbar,
computed frontend-side from data already in the store (WWV/WCY numbers, the spot
stream, the QTH) — no Rust, no external data, **except** the MUF layer's
optional measured overlay added in phase 13 (see `store.mapMuf` below):

- `store.mapGreyline` — `src/lib/grayline.ts::inGreyline` (Sun within
  ±`store.mapGreylineWidth`° — default 9, slider 3–12 in the Layers popover — of
  the horizon at a point); draws a faint grey twilight annulus (`.wm-greyband`,
  `fill-rule: evenodd` between two `geoCircle`s of radius `90 ± width` on the
  sub-solar point) and rings spot dots (`.wm-spot.grey`) whose DX is in the
  band. Also a `grey` bare flag in `compileQuery` (`src/lib/query.ts`) →
  Spots/Bandmap/Map filter — that one stays a fixed ±9° (a search shouldn't
  shift with a map display setting).
- `store.mapAurora` — `src/lib/aurora.ts::auroraOvals(k)`: K-index-scaled
  colatitude caps around the geomagnetic poles (`GEOMAG_NORTH/SOUTH`).
- `store.mapMuf` — `src/lib/muf.ts`: a MUF(3000) filled-contour layer.
  - **Model** (`mufAt`) = solar-zenith `day` term × a sunspot `solar` factor
    (`2.4 + 5.8·√day`, `×(1 + ssn/250)`). `ssn` = `wcy[0].r`, else
    `sfiToSsn(wwv[0].sfi)`, else **90** so the map isn't all red before any
    WWV/WCY.
  - **Measured** (phase 13): the `muf_stations` command (`src-tauri/src/muf_update.rs`)
    fetches prop.kc2g.com's `api/stations.json` (~119 GIRO/INGV ionosonde
    `mufd` points, in-memory only, 15-min TTL, no disk/bundle — stale ionosphere
    data is useless). `WorldMap` pulls it while the layer is on (15-min
    interval); `interpolateMuf(stations, ll, model)` does confidence-weighted
    IDW (Gaussian, 12° scale) and blends to the model where coverage is thin,
    returning a `coverage` 0..1 that blends measured→model. Legend header shows
    `kc2g · N` vs `model · SSN n`; each step swatch is a faint fill + a
    band-colour border, mirroring the map's faint-fill + iso-line look. Credit:
    README + `map.mufLegendHint`.
  - Render: **filled contour bands** (`d3-contour` marching squares). `WorldMap`
    samples the MUF field on a coarse screen-space grid (`MUF_CELL` = 10 px,
    `projection.invert` at each node → lon/lat → `mufAt` ± `interpolateMuf`),
    `muf.ts::mufContours` runs marching squares at the `MUF_SCALE` step edges
    (`MUF_THRESHOLDS` = `0/7/10/14/18/21/28`) and returns one GeoJSON
    MultiPolygon per band, ring coords pre-scaled to px so an un-projected
    `geoPath()` draws them. Bands paint low→high (each higher band opaque over
    the last = clean choropleth, no alpha stacking), clipped to a
    `<clipPath>` of the sphere. Drawn as three sub-`<g>`s so the layer doesn't
    hide the map: `.wm-muf-fill` (very faint, `opacity: 0.11`; the whole-grid
    `value === 0` "closed" band is skipped so it never washes the map — below
    7 MHz just reads as bare ocean) + `.wm-muf-line` (crisp iso-lines — the
    same band polygons, stroked-only) + `.wm-muf-labels` (the band's MHz number
    written inside each region — bare `l.value`, no unit — semi-transparent
    mono with an ocean-colour halo). Label anchors come from
    `muf.ts::mufBandLabels` — 4-connected components on the same sampled grid,
    one anchor per sizeable region at its _most interior_ cell (grid distance
    transform inward from the region edge, centroid distance as tie-break) so
    the number never lands on a band boundary; the `<7 MHz` band is skipped. **No SVG filter** (WebKitGTK is far too slow at
    those); the bands memo (`mufBands` → `{bands, labels}`) and `mufBandsLayer`
    are view-independent (a pan/zoom only moves the parent transform); only
    `mufLabelsLayer`'s font size tracks `view.k`. `MUF_SCALE` in `muf.ts` is
    the shared palette (`mufColor` buckets, legend). Estimate, not a
    prediction. Painted **above** the grayline/greyband so the band field
    isn't muddied by the night cap.
- `store.mapOpenings` — `src/lib/openings.ts::bandOpenings`: every spot from the
  last 30 min as a faint mode-coloured great-circle arc (spotter→DX); overlap =
  heat. Empirical (measured), coverage-biased to where hams are active.
  Sub-filter `store.mapOpeningsNearMeKm` — a slider nested right under the
  `openings` checkbox in the Layers popover (500–20000 km step 500, default
  `OPENINGS_RADIUS_MAX_KM` = 20000) keeps only arcs whose **spotter** endpoint
  (not DX, not midpoint) is within that great-circle distance of the QTH
  (`src/lib/grid.ts::distanceKm`, `geoDistance` × Earth radius 6371.0088 km).
  No separate on/off toggle: at the slider's max the filter is a no-op by
  construction (exceeds any possible great-circle distance, max ≈ 20015 km,
  shown as "no limit" — `WorldMap` checks `openingsNearMeKm <
OPENINGS_RADIUS_MAX_KM` before building the filter at all); also a no-op
  with no QTH locator set.
- `store.mapBandRose` — `src/lib/bandRose.ts`: recent spots binned into 12
  bearing sectors (from `dx.bearing_deg`). Each petal is a **stack of
  mode-coloured segments** (base → tip, `RoseSector.modes` in `ROSE_MODE_ORDER`,
  sized by each mode's share) so a digi-heavy direction still shows its CW / SSB
  slice instead of the whole petal going one colour; `dominantMode` is kept for
  the tooltip. In the
  azimuthal projection with a QRA set it's a big faint bloom anchored on the QTH
  marker, under the spots (`.wm-rose-bloom*`, `rosePetals()` helper) — screen
  angle = true bearing there; the flat projection falls back to the small
  bottom-left corner rose (`.wm-rose*`).
- `store.mapCondHud` (default on) — a `<button className="wm-hud">` top-left
  showing SFI / A / K / SSN from `wwv[0]`/`wcy[0]`, left border tinted by K
  (green/amber/red); clicking it jumps to the Propagation tab
  (`onGoToPropagation`, App → MapPanel → WorldMap).
  The `WorldMap` time `tick` interval now also runs for greyline/MUF (not just
  grayline). i18n `map.greyline`, `map.aurora`, `map.muf`, `map.openings`,
  `map.openingsNearMeKm`, `map.openingsNearMeAll`, `map.bandRose`,
  `map.condHud`, `map.condHudHint`, `map.greylineWidth`, `qh.grey`.

**RBN feed:** `NodeProfile.kind` (`dxcluster_core::connection::NodeKind` —
`cluster` | `rbn`, serde default `cluster`, so old saved profiles still load).
The Connection panel's "+ RBN feed" button pre-fills a profile for
`telnet.reversebeacon.net:7000` (CW/RTTY; port 7001 = FT8/FT4); an editor `Type`
select + an `RBN` row tag mark it. RBN is a command-less skimmer firehose, so:
`connect_node` gives it a short 800 ms `step_timeout` (it never sends a `>`
prompt); `forward_event`'s Spot arm, when `session_kind == Rbn`, keeps **only**
spots whose `base_call(dx_call)` matches the session login callsign, dedups them
in a 90 s in-memory window (`AppState.rbn_recent`, key = base dx / base spotter /
0.1 kHz bucket via `rbn_key`), assigns a synthetic negative id
(`AppState.rbn_seq`), and never calls `store.insert_spot` — RBN rows never touch
SQLite, so a restart / offline `SH/DX` won't resurrect them. They flow to the UI
through the normal `cluster://spot` event and land in the Map's "reports of me"
layer. `useOnlineId()` prefers a `cluster` connection so the send-panels don't
target the RBN feed.

**PSK Reporter feed:** opt-in "who is hearing me" over MQTT
(`crates/…/pskr.rs` — `rumqttc`, plain TCP `mqtt.pskreporter.info:1883`, no
TLS/auth, the data is public). `pskr::run(callsigns, tx)` subscribes to
`pskr/filter/v2/+/+/<CALL>/#` (one topic per watched call; `/`→`.` in the call,
matching is exact so portable/contest calls need their own entry) and forwards
`PskrEvent`s. src-tauri: `AppState.pskr_task` holds the running task;
`pskr_start(callsigns)` / `pskr_stop` commands; `forward_pskr_report` turns each
report into a synthetic skimmer spot exactly like the RBN path (negative id from
`synth_seq`, `node_id = "pskr"`, `is_skimmer: true`, 90 s dedup via
`pskr_recent` + `synth_spot_key`, never persisted, comment
`"<mode> <snr> dB (PSK Reporter)"`), then `enrich::place_by_at_locator` overrides
the receiver position with the exact grid from the report (`rl`) rather than a
DXCC centroid. Flows to the UI on `cluster://spot` → Map "reports of me" layer;
lifecycle on `pskr://state` (`off`/`connecting`/`online`/`error: …`). Digital
modes only (PSK Reporter has no CW/SSB) — RBN covers CW/RTTY. Settings:
`settings.pskrEnabled` (default false) + `settings.pskrCallsigns` (blank = the
profiles' callsigns), in the Connection panel's Settings section; `App.tsx`
bootstrap starts the feed if enabled. `src/lib/pskr.ts::resolvePskrCalls`.

**WSJT-X feed:** opt-in local UDP source (`crates/…/wsjtx.rs`) — a hand-rolled
big-endian Qt-`QDataStream` reader (`QReader`) parses the WSJT-X Status (1) and
Decode (2) messages (magic `0xadbccbda`); unknown trailing fields are just not
read, so newer schemas still parse. `wsjtx::run(bind, tx)` takes
`host` or `host:port` (`parse_bind` defaults the port to 2237); the socket is
built via `socket2` with **`SO_REUSEADDR` only** (never `SO_REUSEPORT` — that
load-balances datagrams between the sharers so we'd see only a fraction), bound
to the wildcard, then `join_multicast_v4` on **every** local IPv4 interface
(`if-addrs` — WSJT-X's loopback multicast only reaches members on its sending
interface). So it coexists with QLog / JTAlert / GridTracker, each getting a
full copy. It tracks dial freq + mode +
DE call from the last Status, and for each Decode runs `parse_decode_message`
(the transmitting station: 2nd token of a directed msg, the caller of a `CQ`;
free text / unresolved `<...>` hashes → dropped) → `WsjtxEvent::Spot`. src-tauri:
`AppState.wsjtx_task` + `wsjtx_start(bind)` / `wsjtx_stop`; `forward_wsjtx_spot`
builds a synthetic spot exactly like `forward_pskr_report` but `spotter =
"WSJT-X"`, `node_id = "wsjtx"`, `is_skimmer: false` — its **own source
category**. `enriched.by` is resolved from the operator's own callsign (the
Status `de_call`, carried on `WsjtxSpot`), not the literal "WSJT-X", so
spotter-side filters (`spotter_continents` / `spotter_cq_zones`) and the map
treat these as spotted by you at your QTH, hidden via a dedicated `spotShowWsjtx` toggle
(`components/WsjtxToggle.tsx`, in all three quickbars, only shown when
`wsjtxEnabled`), independent of the skimmer toggle. RF freq = dial + audio Δf;
the decoded station's grid rides `StoredSpot.grid` for precise map placement.
90 s dedup on `(dx_call, "WSJT-X", 0.1 kHz)`, never persisted. Lifecycle on
`wsjtx://state` (`off`/`listening`/`receiving`/`error: …`). Settings:
`settings.wsjtxEnabled` (default false) + `settings.wsjtxBind`
(`127.0.0.1:2237`) + `settings.spotShowWsjtx`, in the Connection panel's
Settings section; `App.tsx` bootstrap starts it if enabled.

**CAT (rig control) + log push:** the two links that turn a spot into a QSO —
both opt-in, off by default, in the Connection panel's Settings view, and
_not_ cluster transports (hardware / local-IPC).

- **CAT** — `crates/…/rigctl.rs`: a `rigctld` TCP-protocol client (`F`/`M`
  set, `f`/`m` read, `RPRT n` replies). `RigTransport::Network` connects to a
  running `rigctld`; `RigTransport::Serial` spawns + supervises its own
  `rigctld -m <model> -r <dev> -s <baud> -t 4599` (`ChildGuard` kills it on
  drop) and talks to it on localhost. `run(cfg, cmd_rx, tx)` follows the
  feed-task pattern (`AppState.rig_task` + `rig_cmd` sender; `rig_start` /
  `rig_stop` / `rig_set` / `rig_set_split` / `rig_clear_split` / `rig_test` /
  `rig_models` commands); reconnects with backoff. `rig_models()` = `rigctl -l`
  parsed (`parse_rig_list`), or the bundled
  `src-tauri/resources/hamlib_rigs.txt` snapshot when Hamlib is absent.
  `rigctl::mode_for(mode, freq, DigiMode)` → `Option<&str>` (`CW`/`LSB`/`USB`/
  `PKTUSB`/`FM`, or `None` = leave the mode alone); the digital category
  follows the `DigiMode` shack setting (`none`/`usb`/`data`). **Split:**
  `RigCommand::{SetSplit,ClearSplit}` drive rigctld `S 1 VFOB` / `I <tx_hz>` /
  `S 0 VFOA`; the session tracks a per-connection `split_active` so a plain
  `SetFreqMode` transparently drops split. Lifecycle on `rig://state`
  (`off`/`connecting`/`connected`/`disconnected`/`error: …`), VFO polls
  (~1/s when `catPoll`) on `rig://vfo` (`{freqHz, mode}`). Top-bar chip
  (`.topbar-cat` in `App.tsx`) shows the VFO / status → click = Connection
  tab. Integration test `tests/rig_cat.rs` drives a real dummy `rigctld`
  (`#[ignore]`, needs Hamlib).
- **Log push** — `crates/…/logpush.rs`: "prepare a QSO" (never saves), a
  fire-and-forget UDP datagram to the local logger, format-selectable like
  the sibling project **cwrobot** (`github.com/dacrhu/cwrobot`,
  `models/{qso,adif,wsjtx_udp}.py`). `LogFormat::Wsjtx` = a WSJT-X **Status
  (type 1)** message (`status_datagram`, `NetworkMessage.hpp` schema 3 field
  order) — QLog / JTAlert / GridTracker / Log4OM pre-fill their entry window
  from `DialFrequency`/`Mode`/`DXCall`/`DXGrid`/`DECall`/`DEGrid` (**note**:
  they also stamp Time On from it, same as for real WSJT-X — not a bug).
  For WSJT-X `logpush::send` sends a **blank Status first, then the real one
  ~60 ms later** (async `log_prepare` + `spawn_blocking`), because loggers
  only react to a _change_ in DXCall, so a repeated identical push (after the
  op cleared the entry form) would otherwise be ignored. `LogFormat::Adif` =
  a bare partial `<CALL…><FREQ…><EOR>` record for Log4OM-style listeners
  (sent once). One `log_prepare` command. `raise_window(target)`
  is best-effort window fronting: `target` is a window-title fragment **or**
  a freedesktop app-id (`org.foo.Bar`). Linux tries D-Bus
  `org.freedesktop.Application.Activate` + `gapplication launch` first (the
  only thing that works under Wayland — needs the app-id), then `wmctrl` /
  `xdotool` (X11), then `gtk-launch <id>` (single-instance apps raise
  themselves). macOS: `osascript … activate` then `open -a`. Windows:
  PowerShell `AppActivate`. `try_cmd` helper runs each with nulled stdio.
- **Frontend glue** — `src/lib/engage.ts`: `tuneToSpot` (simplex) /
  `tuneSplitToSpot` (RX on the spot, TX on the QSX from the comment, plain tune
  if none) / `prepareQso` (all no-op when their feature is off; `prepareQso`
  also runs `raiseLoggerIfWanted`) / `testLogPush` + `rigConfigFromStore`.
  Mode selection is `src/lib/mode.ts::modeArg(mode, freqKhz, catDigiMode)` →
  `string | undefined` (TS mirror of Rust `rigctl::mode_for`); QSX parsing is
  `src/lib/split.ts::qsxFromComment(comment, rxKhz)` → `number | null` (TS
  mirror of `crates/…/split.rs::qsx_from_comment`, unit-tested both sides:
  `QSX 14195` absolute, `UP 2`/`DWN 5`/`up1.5` offsets, `UP 1-3` → low end,
  bare `UP` and `QSX 599` → none, > 50 kHz jump rejected).
  Left-click on a spot (Spots table, Bandmap marker, Map dot) opens the shared
  `components/SpotPopover.tsx` fact card (`.spot-pop`, same shape as the Map's
  `.wm-popup`) with **Tune radio** / **Split — TX on …** (only when a QSX is
  detected) / **Prepare QSO** buttons + the `useSpotActions()` list — those
  buttons are the _only_ triggers (no tune-on-click). Right-click = the plain
  context menu. Settings:
  `catEnabled`/`catTransport`/`catHost`/`catPort`/`catModelId`/`catDevice`/
  `catBaud`/`catPoll`/`catFollow`/`catDigiMode` +
  `logPushEnabled`/`logHost`/`logPort`/`logFormat`/`raiseLoggerEnabled`/
  `raiseLoggerTitle`; `App.tsx` bootstrap starts CAT if enabled. The DIGI-mode
  segmented control (`none`/`usb`/`data`, `.seg-field`/`.segmented`) sits in the
  Connection panel's CAT section. `SpotPopover` clamps its own position to the
  viewport in a `useLayoutEffect` (measures its real size — a bottom-of-lane
  click flips it up). i18n keys
  `spots.menu.tuneRadio|tuneSplit|prepQso`, `col.split`, `conn.catDigiMode*`,
  `conn.catDigi_*`, `spots.jumpLatest`, `rig.*`, `conn.cat*`, `conn.log*`,
  `bandmap.recenter|qsyBand`. Build dep: the workspace `tokio` gained the
  `process` feature (spawned `rigctld` / `raise_window`).
- **Radio-position feedback (Bandmap)** — whenever CAT is connected the
  Bandmap reads `store.rigVfo` directly: a cursor line at the VFO, the
  containing lane gets `.radio-active` while the others fade
  (`.bandmap-lane.dimmed`), and the spot within ~0.5 kHz of the VFO is ringed
  `.radio-near` (distinct from the click/alert tint). The active lane
  **auto-scrolls to keep the VFO cursor centred** (on VFO moves _and_ spot
  inserts); a manual scroll pauses that (`follow` state) and freezes the
  lane's spot set so nothing shifts under you — a new band, or the `⌖`
  (`.bandmap-recenter`) button in the lane head, resumes tracking. Clicking a
  non-active lane's header (`.bandmap-lane-head.qsy`, only when CAT is up)
  QSYs the rig to that band — the middle spot's freq, or `lowKhz + 20` if the
  lane is empty; freq only, no mode change (`onBandSelect` → `ipc.rigSet`).
- **Spots table** shows a frozen snapshot while scrolled away from the top
  (`frozen` state, like `RawConsolePanel`'s `stick`), so incoming spots never
  move what you're reading; the `.console-jump` pill (top) sets `snapTop` then
  unfreezes, and a one-shot `useLayoutEffect` snaps `scrollTop` to 0 on that
  transition — after which the natural top-anchored render keeps the newest in
  view (no continuous forcing). An 8 px scroll dead-zone stops jitter flipping
  the state; a big snapshot/live divergence (search changed) auto-unfreezes.
  `catFollow` scrolls the table to + tints the row nearest
  `store.followFreqKhz`.
- **Post-spot frequency follows the VFO.** While CAT is connected the
  `SpotsPanel` post-a-spot `kHz` field mirrors `store.rigVfo` (a `freqEdited`
  ref stops that the moment the operator types in it, or picks a spot via
  "prepare a post"); a `VFO` chip next to the field snaps it back to the live
  reading and clears the ref so tracking resumes. No rig → plain manual field,
  no chip.

The **Connection panel** is split by a `.seg-toggle` in its `.panel-head`:
"Connections" (profile list + editor + preset browser) vs "Settings".
`startAdd`/`startEdit` flip the view back to Connections. Each Settings block
is `<details className="settings-group" name="conn-settings">` / `<summary>` —
the shared `name` makes them a **native exclusive accordion** (open one, the
rest close; all collapsed by default), which needs WebKitGTK ≥ 2.44. Kept as
default block display, not flex, since flex on `<details>` misbehaves in
WebKitGTK. Same all-collapsed / one-open accordion pattern as the Filters &
Alerts rule cards (those via an `expanded: string | null` state, not
`<details>`).

**Announcements filter:** `AnnouncementsPanel`'s search box takes
space-separated include / `-exclude` terms (`matchTerms()` over
sender+target+text), so e.g. `-telnet` hides rows mentioning telnet.

Every panel in `App.tsx` is wrapped in `components/ErrorBoundary.tsx` so a render
error in one panel shows a red fallback (with the stack) instead of blanking the
whole app.

**Raw console:** auto-follows new output only while scrolled to the bottom;
scrolling up pauses it, a "↓ N" pill (`.console-jump`) resumes. `stick` state +
`onConsoleScroll` in `RawConsolePanel`.

**Cluster presets:** `src-tauri/resources/dxclusters.dat` (bundled snapshot,
`"name","host","port","software"` CSV + a `"VERSION",…` line) is a list of ~730
public cluster nodes. `crates/…/reference/presets.rs::parse_presets` →
`Vec<ClusterPreset>`. `src-tauri/src/presets_update.rs` mirrors `cty_update.rs`
(downloaded > bundled > none; weekly `maybe_update` with a conditional GET —
`If-None-Match` from a `dxclusters.dat.dat.etag` sidecar; `PRESETS_URL` =
`raw.githubusercontent.com/dacrhu/dx-cluster-desktop/main/src-tauri/resources/dxclusters.dat`,
the committed copy that `data-update.yml` refreshes weekly from dxcluster.info).
`AppState.presets` is `RwLock`, hot-swapped like `cty`. Commands
`cluster_presets` (each node's country resolved via `cty.lookup(base_call(name))`
→ `EnrichedPreset`), `presets_status`, `maybe_update_presets`, `update_presets`.
The Connection panel's new-profile editor shows a preset browser (country
`<select>` grouped by continent → node list → click fills host/port/name; nodes
whose callsign doesn't resolve to a DXCC are dropped); Settings has a
`conn.presetsGroup` status/auto-update section. `.github/workflows/
data-update.yml` re-pulls **both** `dxclusters.dat` (from
`dxcluster.info/telnet/DXCLUSTERS.DAT`) and `cty.dat` (from country-files.com)
weekly and commits `[skip ci]`; optional repo vars `PRESETS_SOURCE_URL` /
`CTY_SOURCE_URL` override those source URLs. Source:
[dxcluster.info](https://dxcluster.info/), used with permission
(`conn.presetCredit` i18n key + README Credits).

**Auto-fetch on connect:** `UsersPanel` and `MailPanel` fetch once (guarded by
an `autoDone` ref) after `onlineId` first becomes truthy. `MailPanel` waits
~1.5 s and retries up to 3× (the node may still be sending its login banner when
the first `directory` goes out and `runQuery` finishes early on the ready
prompt).

**Mail watch:** while `settings.mailWatchEnabled` (default true) and a node is
online, `MailPanel` re-runs `directory` every `MAIL_POLL_MS` (10 min) and feeds
the msgnos to `store.noteMailMsgnos()` — it tracks the highest number seen
(`store.mailSeenMax`, per-node, reset via `resetMailBaseline()` on an `onlineId`
change so a node switch never notifies for pre-existing mail) and on a genuinely
new arrival bumps `store.mailNewTs`. `App.tsx` maps that into `activity.mail` →
the Mail tab's "new activity" dot; the poll also fires an `os_notify` toast
(`mail.notifyTitle`/`Body`). Manual/auto `refresh()` also calls
`noteMailMsgnos` to keep the baseline current. Toggle: Connection panel →
Settings → "Mail" group.

**Startup update check:** `src-tauri/src/update_check.rs` (`check_update` command)
does one GET to the GitHub Releases API
(`api.github.com/repos/dacrhu/dx-cluster-desktop/releases/latest`) per launch,
compares `tag_name` to `app.package_info().version` with a numeric-parts
`version_gt` (pre-release suffixes ignored), and returns
`UpdateInfo { current, latest, newer, url, notes }`. Read-only reference lookup,
not a cluster transport (same category as the `cty.dat` HTTP updates); no
auto-download. `App.tsx` bootstrap runs it when `settings.updateCheckEnabled`
(default true), stores the result in `store.updateInfo`, and — if `newer` and
`latest !== settings.updateSkippedVersion` — shows `components/UpdateBanner.tsx`,
a one-per-launch modal popup (`.update-backdrop`/`.update-popup`) with the
release notes + "Open download page" (`open_external` → releases page) / "Skip
this version" (persists `updateSkippedVersion`) / "Later". A network/404/rate-
limit failure is swallowed — no popup. Toggle + "Check now" + status live in the
Connection panel → Settings → "App updates" group. i18n `update.*` / `conn.update*`.

**Read flags survive a refresh:** `MailPanel::fetchHeaders` ORs each parsed
`MailHeader.read` with membership of `cached_mail_ids` (`store::mail_msgnos` —
every msgno with a cached body = one the operator opened here). Nodes keep
re-reporting messages (bulletins especially) as unread, so the node's `-` flag
alone flips them back on every `directory`.

The two-pane panels (`.mail-layout` / `.talk-layout` / `.users-layout`)
stack to one column under 760px; `.mail-layout` also reflows via
`auto-fit minmax`; `.panel-head` is `flex-wrap: wrap`. The Connection panel runs
full width (`.conn-panel` uncaps `.editor` / `.profile-list`).

**Filter scope:** each `SpotFilter` carries a frontend-only `pushToNode: boolean`
(`src/lib/types.ts`; the Rust `SpotFilter` doesn't have this field — serde
ignores unknown JSON fields, so it round-trips fine). `false` (the default) =
local-only, no preview/apply UI shown; `true` shows the generated
`accept/reject spot` command + an apply button, as before. `FiltersPanel` also
has a "Clear node filters" button (`clear/spot all` via `runQuery`, unknown-
command detection like ToolsPanel) since DXSpider has no per-rule remote
delete. Conditions are symmetric DX / spotter side: continent chips + DXCC /
CQ-zone / callsign-prefix CSV for each — `dx_*` → `call_*` DXSpider fields,
`spotter_*` → `by_*` (`by_zone` / `by_dxcc`); continents and modes/skimmer are
local-only (never pushed, matched in `src/lib/filter.ts::conditionsMatch` mirror
of `commands.rs::conditions_match`). The `call_zone` / `by_zone` distinction
matters: a "DX CQ zone = Europe" rule allows a European DX spotted by a US
skimmer — restrict the spotter with `spotter_continents` / `spotter_cq_zones`.
Each rule is a collapsible card (shared `.rule-*` classes / pattern with the
Alerts panel): head = enable checkbox + `label` + `describeFilter()` one-liner +
delete; body = the full editor. `SpotFilter` gained frontend-only `id` / `label`
/ `enabled` (backfilled in `persist.ts::loadFilters`); `spotPasses` skips
`enabled === false` rules.

**Send-target picker:** when more than one command-capable node is online
(`useSendTargets()` — every non-`rbn`-kind connection with `state === "online"`),
a topbar `<select>` (`.topbar-target`, next to the CAT chip / max-age field)
lets the user pick which one every send-panel — post spot, mail, talk, chat,
Tools/`sh/*` queries, node-side filters, WWV/announce posts — targets; hidden
when there's 0 or 1 (nothing to choose between). The pick is session-only
(`store.sendTargetId`, not persisted) and read through `useOnlineId()`, which
now prefers it when it's still online and falls back to the old
first-cluster-then-any-online rule otherwise — so existing call sites needed no
change except `FiltersPanel` (dropped its own local target `<select>`, now a
plain "applies to `<onlineId>`" label) and `SpotsPanel` (its inline
`connections`-scan for "post a spot" could previously land on the command-less
RBN feed; now goes through `useOnlineId()` like everything else).

The same include/`-exclude` text filter (`matchTerms()`, now shared from
`src/lib/util.ts` rather than living only in `AnnouncementsPanel`) also covers
`PropagationPanel`'s WWV/WCY history tables — one search box above both tables,
matched against `sender`+`forecast` for WWV rows and `sender`+`sa`+`gmf`+`aurora`
for WCY rows; an empty result shows `prop.noMatch` instead of `prop.noData` so
"no data at all" and "filtered to nothing" read differently. The WCY `SA` / `GMF`
/ `Au` shorthand (`qui` / `act` / `maj` / `no` / `yes` …) is shown decoded via
`src/lib/wcy.ts::describeWcyCode` (i18n `prop.wcyCode.*`), with the raw code in
the cell / stat-value `title`; the search still matches the raw `w.sa` etc.

**AR-Cluster dialect (spot filters).** `NodeProfile.software` (`connection::NodeSoftware`
— `DxSpider` | `ArCluster`, serde default `DxSpider`, mirrors `kind`'s pattern) picks
which syntax `commands.rs` generates for a `Cluster`-kind node. `SpotFilter::to_command
(software)` dispatches to `to_dxspider()` (unchanged) or the new `to_arcluster()`, built
to the documented AR-Cluster V6 `SET/DX/FILTER` syntax (fields `Band`/`Call`/`Spotter`/
`Cty`/`SpotterCty`/`CqZone`/`SpotterCqZone`, `=`, `and`/`or`, parentheses, trailing `*`
wildcard) — same field scope as `to_dxspider` (continent/mode/skimmer stay local-only).
AR-Cluster keeps exactly one active filter per session (no numbered `accept/spot N`
slots), so a `Reject` rule becomes `not (...)` rather than a separate reject command;
this needs no special handling in `FiltersPanel` since it already pushes one rule at a
time as a single overwrite. `apply_spot_filter` takes an explicit `software` param
(the frontend reads it off the target connection's profile, defaulting `dx_spider`) —
command generation never depends on a live session, so the always-available preview
(`applySpotFilter("", f, false, software)`) works the same as the real push.
`FiltersPanel`'s "Clear node filters" sends `set/dx/filter` (empty) instead of
`clear/spot all` for an AR-Cluster target, and "fetch node filters" runs
`show/dx options` and keeps the `DX configuration options:` block (header +
indented `Count:/Filter:/Mode:/Output:/Comment Options:` lines), dropping the
interleaved live `DX de …` spots. The Connection panel's profile editor gained a
Software select (shown only for `kind: "cluster"`), the preset browser auto-fills
it from the preset's `software` string (`/ar-?cluster/i`), and an `AR` tag marks
such profiles in the list. **Verified against a live AR-Cluster V6 node
(6.1.5123, `dxcluster.hadxc.hu`):** `show/dx options` is valid and returns the
block above; `show/filter` / `sh/filter` / `show/dx/filter` are aliases for it;
the spot line format is the common AK1A `DX de …` (skimmer `-#`, `CW 38 dB 34
WPM` comment) — so the "assumed common across dialects" spot/WWV/WCY parsing
holds. `SET/DX/FILTER` command generation was **re-audited against the V6 Telnet
User Manual** (all `to_arcluster` field names match the DX Filter field table;
`Band=<meters>`; OR-groups must be parenthesised because `and` binds before `or`;
`not (...)` for a Reject rule is a documented form; empty `set/dx/filter` clears).
**A generated `set/dx/filter` was then pushed to the live node and accepted** —
no errors, spot stream filtered as expected. The one thing not separately
confirmed is whether a trailing `*` on `Call=` / `Spotter=` does a prefix match
(the manual only documents `*` for `Comment`); if a future report shows a
prefix rule matching nothing, switch `prefix_terms` to `*P5*` (infix) or exact.

**`SH/DX` historical query is now dialect-aware.** `commands::sh_dx(q, software)`
dispatches: DXSpider keeps the positional `SH/DX <n> on <band> <call> by
<spotter> <h> hours`; AR-Cluster V6 gets `show/dx/<n> band=20 and call=HA and
spotter=W3LPL` (`sh_dx_arcluster`, `field=value` joined by `and`, the `hours`
window dropped — AR needs an absolute `dts>` timestamp). Exposed as the
`sh_dx_command` Tauri command; `ToolsPanel` computes the string reactively via
`ipc.shDxCommand(query, targetSoftware)` (reads the target connection's
`software`, like `FiltersPanel`) instead of the old ad-hoc `buildShDx`, so the
button label and the send agree. The historical rows are the common AK1A
layout on both dialects — a live AR row (`7032.0  G4WDZ  06-Sep-2026 2105Z  CW
23 dB 25 WPM CQ  <OE6ADD-#>`) is pinned as a test — so `parser::show::parse_sh_dx`
is unchanged. `runNodeDx` now also shows `tools.notSupported` on an
`unknown command` / `sorry` / `error` reply (own `dxNote`).

Only remaining dialect gap: login-banner detection isn't AR-specific (it worked
fine on `dxcluster.hadxc.hu`, just isn't provably general). Anything else is
explicit-request-only.

**Verified against live data (DXSpider V1.57 build 686, `hg8lxl.ham.hu`):** the
mail `DIRECTORY` / `READ` parsers in `parser/mail.rs` — real capture showed the
`READ` header is a **single line** (`Msg: N From: C Date: … Subj: …`) with the
body straight after, not the documented one-`Key: value`-per-line block;
`parse_read_message` now handles both (`READ_HDR_RE` + the legacy `READ_KV_RE`),
real rows are pinned as tests. The interactive compose prompt-matching in
`sendMail` (documented DXSpider prompts `Enter Subject (30 characters):` /
`Enter Message /EX to send or /ABORT to exit`; regexes also match the `Enter
your message` / `Enter text` variants) was **verified live** — a bulletin was
posted and propagated. Hardened during the P0 pass: the blind fallback that
fires `sendSubject()` is now 8 s (a node still flushing its login banner used
to trip the old 2.5 s timer into sending the subject as a raw command), and a
body line that is itself `/EX` or `/ABORT` is space-padded so it can't end the
message early.

**Text encoding.** `telnet.rs::decode_line` reads each node line as UTF-8, or
falls back to ISO-8859-1 (byte → `U+00xx`) when that fails, instead of
`from_utf8_lossy`'s `U+FFFD` — so a Latin-1 node's accented comments/mail
survive. The **outgoing** side still sends UTF-8; many cluster nodes are
ASCII-only (some strip the C1 range `0x80..=0x9F`, which mangles exactly the
UTF-8 for `Á`/`Ő`/`Ű` etc.), so the mail composer warns on non-ASCII input and
offers `toAsciiText()` (`src/lib/util.ts`, NFKD + diacritic strip) to fold it
to plain ASCII. Confirmed live: `Árvíztűrő` round-tripped through a node as
`�rvíztűr�` — node-side loss, not ours.

Parser dispatch order in `parser/mod.rs::parse_line_ctx`: spot → wwv → wcy →
announce → chat → talk → Raw. `run_session` builds a `ParseCtx` with the profile
callsign (talk detection) and the set of joined chat groups (tracked from
outgoing `JOIN`/`LEAVE`, seeded from `on_login`). `SHOW` response parsers live in
`parser/show.rs`, driven from the frontend via the `runQuery` helper + a thin
`parse_*` / `import_*` Tauri command (`sh/ann`, `sh/chat` share one regex).
Real-cluster line samples are captured as tests in the relevant `parser/*.rs`.

The whole cluster surface is in scope — including stored mail and bulletins,
not just the live spot/announce stream.

## Do not

- Route the **cluster** over anything but Telnet — no web/JSON cluster APIs for
  spots, commands, mail, chat. (Supplementary read-only feeds are a separate
  matter: the RBN telnet feed, the opt-in PSK Reporter MQTT feed ("who hears
  me"), and the opt-in WSJT-X local UDP feed ("what my radio hears") are
  synthetic-spot sources; the kc2g ionosonde fetch and the `cty.dat` /
  `dxclusters.dat` HTTP updates are reference data; CAT (`rigctld` TCP) and
  the log-push UDP datagram are a local hardware link and a one-way logger
  hint. None carry cluster traffic.)
- Commit real secrets; cluster passwords go in the OS keyring at runtime.
