# Tools and node queries

The **Tools** panel runs cluster `SHOW` queries and presents the results — raw
where there is no structure, formatted where there is.

## SH/DX — spot history

A structured historical spot search. Fill in any of: count, band, callsign,
spotter, hours back. The panel shows the exact command it will send (which
differs by node dialect — positional on DXSpider, `field=value` on AR-Cluster)
so the button and the command always agree.

Results are shown as a table with the same mode colouring as the live Spots
table. If the node has no history you can run the **same search offline**
against the local spot database.

## Generic sh/* queries

A dropdown of common lookups, each with the argument it needs:

| Command                                | Use                                           |
| -------------------------------------- | --------------------------------------------- |
| `sh/prefix`                            | DXCC / zone info for a prefix                 |
| `sh/heading`                           | beam heading to a call/prefix                 |
| `sh/qra`                               | distance/bearing between two locators         |
| `sh/sun`, `sh/moon`                    | sunrise/sunset, moon data                     |
| `sh/muf`                               | the node's MUF estimate for a locator         |
| `sh/dxcc`                              | recent spots for a DXCC                       |
| `sh/dxqsl`, `sh/db0sdx`, `sh/ik3qar`   | QSL-route databases                           |
| `sh/route`                             | how to reach a station on the cluster network |
| `sh/dxstats`, `sh/configuration/nodes` | node statistics                               |

Anything the node doesn't recognise is reported as "not supported on this
node".

## When there is no node

Offline `SH/DX` still works from the local database. The other `sh/*` queries
need a live node — they are pass-through commands.
