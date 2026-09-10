# DX Cluster Desktop — User Manual

Welcome! This manual explains every part of DX Cluster Desktop, a friendly
desktop client for ham-radio **DX clusters** over Telnet. You never have to type
raw cluster commands — everything is driven from tables, clickable rows and
forms.

You can read these pages **inside the app** (the _Help_ tab) or here on GitHub.
Inside the app each page is fetched from GitHub when you are online and falls
back to a copy bundled with the release when you are not.

## Contents

1. [Getting started](getting-started.md) — install, first launch, the main window
2. [Connecting to clusters](connections.md) — profiles, the preset browser, DXSpider vs AR-Cluster
3. [The spot table](spots.md) — reading spots, quick filters, posting a spot, tuning your radio
4. [The search query language](search-query.md) — `dx:` `by:` `band:` `re:` and friends
5. [The bandmap](bandmap.md) — per-band lanes, the band plan, SOS/IBP markers
6. [The world map](map.md) — projections, propagation layers, MUF, "who is hearing me"
7. [The activity matrix](activity.md) — which band is rising or falling, by continent
8. [Spot filters](filters.md) — local filtering and node-side filters
9. [Alerts](alerts.md) — watch lists, desktop notifications, the hit log
10. [Announcements, WWV/WCY and WX](bulletins.md) — the bulletin and propagation feeds
11. [Talk, chat, mail and users](messaging.md) — every conversational feature
12. [Tools and node queries](tools.md) — `sh/dx` history and generic `sh/*` lookups
13. [Extra spot sources](extra-feeds.md) — RBN, PSK Reporter and WSJT-X
14. [Rig control and logging](rig-and-logging.md) — CAT via rigctld, log-program hand-off
15. [Settings and languages](settings.md) — every setting, plus how to change the language
16. [The raw terminal](raw-terminal.md) — the power-user console
17. [Troubleshooting](troubleshooting.md) — common problems and fixes

## A note on scope

The client speaks **Telnet only** for cluster traffic — spots, commands, mail,
chat. A few optional read-only feeds (RBN, PSK Reporter, WSJT-X) and reference
data downloads are separate and clearly marked as such throughout this manual.

`rigctld` (from [Hamlib](https://hamlib.github.io/)) is **not** part of the app.
Install it separately if you want CAT control — see
[Rig control and logging](rig-and-logging.md).
