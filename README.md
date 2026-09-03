# DX Cluster Desktop

User-friendly, multiplatform desktop client for ham radio **DX clusters** over
**Telnet**. Everything is done through lists, clickable rows, tables and forms —
no need to type cluster commands by hand. A secondary _Raw terminal_ tab is
available for power users.

- **Backend:** Rust + [Tauri 2](https://tauri.app) (tokio async)
- **Frontend:** React + TypeScript + Vite
- **Storage:** SQLite (spot history / search) + Tauri store (profiles, settings)
- **Reference data:** bundled `cty.dat` (callsign → DXCC / CQ zone / ITU zone /
  continent / coordinates), optional periodic auto-update
- **Languages:** English, Hungarian, German — community-translatable without
  coding, see [`TRANSLATING.md`](TRANSLATING.md)

See [`FELADAT.md`](FELADAT.md) for the original brief and the plan file under
`~/.claude/plans/` for the full phased roadmap.

## Status

**Phase 1 — MVP.** Connect to a DXSpider/AR-Cluster node over Telnet (login
state machine handles prompted and promptless nodes), live virtualized spot
table with band/mode/text quick filters, DXCC/CQ-zone/continent enrichment and
beam heading from `cty.dat`, spot history in SQLite, a GUI filter builder that
generates DXSpider `accept/reject spot` commands and filters locally, a spot
post form, and a secondary raw-terminal tab. Phase 0 scaffold + CI is in place.

Next: announcements / WWV / WCY / WX, then talk + users, then the mail &
bulletin subsystem — see the plan file.

### Layout

- `crates/dxcluster-core/` — transport-agnostic logic (telnet framing, login
  state machine, spot parser, band/mode heuristics, `cty.dat` + geo, SQLite
  store, filter builder). Fast unit tests, no webview dependency.
- `src-tauri/` — thin Tauri shell: commands + `cluster://*` events.
- `src/` — React UI (`panels/`, `components/`, `lib/`, `store/`).

## Prerequisites

### All platforms

- [Node.js](https://nodejs.org/) 20+ and [pnpm](https://pnpm.io/) 10+
- [Rust](https://rustup.rs/) stable (1.77+)

### Linux (Fedora)

```sh
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel \
  libsoup3-devel javascriptcoregtk4.1-devel
```

### Linux (Debian/Ubuntu)

```sh
sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev \
  librsvg2-dev patchelf libsoup-3.0-dev libjavascriptcoregtk-4.1-dev
```

### Windows / macOS

- Windows: [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) + WebView2 (preinstalled on Win 11)
- macOS: Xcode Command Line Tools (`xcode-select --install`)

## Develop

```sh
pnpm install
pnpm tauri dev
```

## Build

```sh
pnpm tauri build          # full installers for the current OS
pnpm tauri build --no-bundle   # just compile, no packaging
```

## Checks

```sh
pnpm lint                 # eslint + prettier
pnpm build                # tsc --noEmit + vite build
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace

# opt-in live check against a real cluster:
DXTEST_CALL=<yourcall> cargo test -p dxcluster-core --test live_cluster -- --ignored --nocapture
```

## Release

Push a tag `vX.Y.Z`; the `Release` workflow builds on four native runners
(Linux, Windows, macOS Intel, macOS Apple Silicon) and creates a draft GitHub
release with all installers.

## Credits

Both reference data files are bundled as a fallback, mirrored into this repo by
the weekly `Refresh bundled data` workflow, and auto-updated in the app at
startup (conditional GET, so an unchanged file costs one 304).

- **DXCC country file** (`src-tauri/resources/cty.dat`) —
  [country-files.com](https://www.country-files.com/). Thank you!
- **Cluster node list** (`src-tauri/resources/dxclusters.dat`) — the
  `DXCLUSTERS.DAT` database from [dxcluster.info](https://dxcluster.info/), used
  with permission. Thank you!
- **Ionosphere data** for the map's measured MUF layer — real-time ionosonde
  measurements from [prop.kc2g.com](https://prop.kc2g.com/) (Andrew Rodland),
  sourced from GIRO and INGV. Fetched on demand, in memory only. Thank you!
- Natural Earth 110m country outline for the map.
