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

## Conventions

- Keep `src/lib/ipc.ts` types in sync with the `#[tauri::command]` surface in
  `src-tauri/src/lib.rs`.
- All outgoing cluster command strings are built in `src-tauri/src/commands/`
  (one place, unit-tested), never assembled ad hoc in the frontend.
- Incoming lines are parsed in `src-tauri/src/parser/` into a typed
  `ClusterEvent` enum; unknown lines fall through to `Raw`.
- Node dialect differences (DXSpider vs AR-Cluster) are handled in the command
  builder and parser, selected per connection profile.

## Checks before committing

```sh
pnpm lint && pnpm test && pnpm build
cargo fmt --all -- --check \
  && cargo clippy --workspace --all-targets --all-features -- -D warnings \
  && cargo test --workspace
```

Frontend tests: `vitest` (`*.test.ts` next to the source). The spot-search
query language lives in `src/lib/query.ts` (`compileQuery`) with a full test.

`cargo test` piped through `tail` shows nothing until it exits (tail buffers) —
write output to a file instead. Session tests use `#[tokio::test(start_paused)]`
with a `guarded()` wrapper so a stalled loop fails fast.

## Roadmap

Phased — see the plan file in `~/.claude/plans/`. **Done:** phase 0 scaffold +
CI, phase 1 MVP (connect + live spot table + GUI/local filters + spot post +
raw console). **Next:** announce/WWV/WCY/WX, then talk/users, then the mail &
bulletin subsystem (directory/read/send/reply/delete, private + bulletin
categories), query tools, alerts + cty.dat auto-update + multi-connection,
bandmap.

The whole cluster surface is in scope — including stored mail and bulletins,
not just the live spot/announce stream.

## Do not

- Add non-Telnet transports (no web/JSON cluster APIs) — brief says Telnet only.
- Commit real secrets; cluster passwords go in the OS keyring at runtime.
