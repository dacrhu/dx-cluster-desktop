# Extra spot sources

Besides cluster spots over Telnet, three **optional, read-only** feeds can add
synthetic spots. All are off by default and configured in **Connection →
Settings**. None carry cluster traffic — they are "who/what is hearing signals"
sources, and their spots are **never written to the local database** (they
disappear on restart).

## RBN (Reverse Beacon Network)

Add an **RBN feed** connection profile (see
[Connecting to clusters](connections.md)). The RBN is a CW/RTTY/FT skimmer
firehose; the client keeps only spots of your own callsign and routes them to
the map's ["reports of me"](map.md) layer. Ports: `7000` CW/RTTY, `7001`
FT8/FT4.

## PSK Reporter — "who is hearing me"

An opt-in MQTT subscription (`mqtt.pskreporter.info`, plain TCP, public data).
Turn on **PSK Reporter** and optionally list callsigns to watch (blank = your
profiles' callsigns). Reception reports of you are turned into synthetic
skimmer spots with the reporter's **exact** grid, and appear on the map's
"reports of me" layer.

Digital modes only — RBN covers CW/RTTY. Portable/contest calls need their own
entry (matching is exact).

## WSJT-X — "what my radio hears"

An opt-in **local UDP** listener. Point WSJT-X's UDP server at the app (default
`127.0.0.1:2237`) — or use its multicast address; the client joins on every
interface and coexists with JTAlert / GridTracker / QLog, each still getting a
full copy.

Every WSJT-X decode becomes a spot with spotter `WSJT-X`, its own source
category, placed at the decoded station's grid. RF frequency = dial + audio
offset. Toggle their visibility with the dedicated **WSJT-X** switch in the
quick-filter bar (shown only when the feed is enabled).

## Filtering

The **skimmer** and **WSJT-X** toggles in the quick-filter bar
([Spots](spots.md)) control whether these synthetic spots are shown in the
tables, bandmap and map.
