# Connecting to clusters

The **Connection** panel has two views, switched with the toggle in its header:
**Connections** (profiles and the preset browser) and **Settings** (everything
else). This page covers Connections.

## Connection profiles

A profile is one saved cluster login. Click **+ Add** to create one, or click a
profile in the list to edit it.

| Field         | Meaning                                                                |
| ------------- | ---------------------------------------------------------------------- |
| Name          | A label for the list — free text.                                      |
| Host / Port   | The node's Telnet address, e.g. `hg8lxl.ham.hu` / `7300`.              |
| Callsign      | Your login callsign.                                                   |
| Password      | Only if the node requires one. Stored in the OS keyring at runtime.    |
| Type          | **Cluster** (a normal DX cluster) or **RBN feed** — see below.         |
| Software      | **DXSpider** or **AR-Cluster** — picks the command dialect. See below. |
| Skimmer spots | Node default / request on / request off — DXSpider only. See below.    |
| Auto-connect  | Connect this profile automatically on startup.                         |

Multiple profiles can be connected at once. Spots from all of them are merged
and de-duplicated (a 90-second window on callsign + frequency + spotter).

## The preset browser

When adding a profile, expand the **preset browser** to pick from ~730 public
nodes. Choose a **country** (grouped by continent), then a node — clicking it
fills in the host, port and name, and guesses the software type. The country of
each node is resolved from its callsign.

The preset list auto-updates weekly. Its status and a manual "check now" button
are in **Settings → Cluster presets**. Source:
[dxcluster.info](https://dxcluster.info/), used with permission.

## RBN feed profiles

Click **+ RBN feed** to pre-fill a profile for the Reverse Beacon Network
(`telnet.reversebeacon.net:7000` for CW/RTTY, `7001` for FT8/FT4). An RBN feed
is a command-less skimmer firehose, so the client:

- keeps **only** spots of **your** callsign,
- never writes them to the local database (they vanish on restart),
- routes them to the map's "reports of me" layer.

RBN profiles are tagged `RBN` in the list and cannot be a send target.

## DXSpider vs AR-Cluster

The two common node types differ in command syntax. Set **Software** correctly
so the client generates the right commands for:

- **Spot filters** — DXSpider `accept/reject spot` vs AR-Cluster
  `set/dx/filter`. See [Spot filters](filters.md).
- **`SH/DX` history** — positional DXSpider form vs AR-Cluster `field=value`
  form. See [Tools and node queries](tools.md).

Spot, WWV, WCY and announcement parsing is common to both. If you are unsure,
DXSpider is the safe default and by far the most common.

## Skimmer spots

Many DXSpider nodes withhold RBN-relayed skimmer spots until you opt in, or
send them by default and expect you to opt out. The **Skimmer spots** field
in a profile (DXSpider only) sends `SET/SKIMMER` or `UNSET/SKIMMER`
automatically right after every login — set it once, no need to type the
command yourself each session. A **Send now** button appears next to it while
that profile is online, so a change applies immediately without reconnecting.

The node doesn't report its current skimmer setting back, so this is a
fire-and-forget preference, not a live status display.

## Connection state

Each profile shows its state: _disconnected_, _connecting_, _logging in_,
_online_ or an error. The login state machine handles both nodes that send a
`login:` prompt and nodes that just start streaming. Errors (including "you are
already connected elsewhere") appear inline and in the
[raw terminal](raw-terminal.md).
