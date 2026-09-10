# Settings and languages

Open **Connection → Settings**. Each block is a collapsible group; opening one
closes the others.

## Interface language

Choose **System**, **English**, **Magyar** or **Deutsch**. "System" follows
your OS UI language (detected via the OS, not the browser, because that is
unreliable on Linux).

> A **restart is strongly recommended** after changing the language — a few
> strings only refresh on the next start.

Want another language? See [TRANSLATING.md](https://github.com/dacrhu/dx-cluster-desktop/blob/main/TRANSLATING.md)
— no programming needed, you edit text files on GitHub.

## Your station

Your **Maidenhead locator**. Powers beam headings, the azimuthal map, range
rings and the "reports of me" layer. Set it once.

## Reference data

- **DXCC country file (`cty.dat`)** — callsign → DXCC / zones / continent /
  coordinates. Auto-updates weekly with a conditional download. Status + "check
  now" here. Source: [country-files.com](https://www.country-files.com/).
- **Cluster presets** — the ~730-node list behind the preset browser. Same
  auto-update pattern. Source: [dxcluster.info](https://dxcluster.info/).

## Feeds

- **PSK Reporter** — enable + watched callsigns. See
  [Extra spot sources](extra-feeds.md).
- **WSJT-X** — enable + bind address + show/hide toggle.
- **Mail** — mail-watch on/off (10-minute directory poll + notification).

## Rig control (CAT) and Log push

See [Rig control and logging](rig-and-logging.md).

## Where settings live

- Non-secret settings: `settings.json` in the app's data directory.
- Connection profiles: the Tauri store.
- Cluster passwords: your **OS keyring** — never written to disk in plain text.
- Spot history, mail bodies, talk/chat history: a local SQLite database.
- Alert hits and the map / bandmap / activity view state: persisted separately
  so they survive a restart.

## Top-bar quick settings

- **Max age (min)** — hides spots older than this everywhere (0/∞ = off).
- **Send target** — appears when >1 command-capable node is online; picks which
  node receives your posts, mail, talk and queries.
