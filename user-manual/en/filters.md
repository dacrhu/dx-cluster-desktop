# Spot filters

The **Filters** panel builds reusable filter rules. Each rule is a collapsible
card: the head shows an enable checkbox, its label and a one-line summary; the
body is the editor.

Rules use the same **accordion** as the Alerts panel — one card open at a time,
all collapsed by default.

## Local vs node-side

Every rule has a **scope**:

- **Local only** (the default) — the rule filters the spots you see in the app.
  Nothing is sent to the cluster. This is the right choice almost always: it is
  instant, reversible and doesn't affect other clients.
- **Push to node** — additionally shows the generated cluster command and an
  **Apply** button, so the node itself stops sending non-matching spots.

## Conditions

Conditions are symmetric between the **DX** side and the **spotter** side:

| Condition             | DX side        | Spotter side   |
| --------------------- | -------------- | -------------- |
| Continent chips       | ✓ (local only) | ✓ (local only) |
| DXCC                  | ✓              | ✓              |
| CQ zone               | ✓              | ✓              |
| Callsign prefix (CSV) | ✓              | ✓              |
| Mode / skimmer        | local only     | —              |

> **The CQ-zone distinction matters.** "DX CQ zone = Europe" still allows a
> European DX spotted by a US skimmer. To also constrain who reported it, set
> **spotter continents** or **spotter CQ zones**.

An **advanced query** field (the [query language](search-query.md)) can be added
and is ANDed with the structured conditions.

## Node dialects

The generated command follows the target node's **Software** setting
(see [Connecting to clusters](connections.md)):

- **DXSpider** — `accept/spot` / `reject/spot` with numbered slots.
- **AR-Cluster** — a single `set/dx/filter` expression (one active filter per
  session; a _Reject_ rule becomes `not (...)`).

The command preview is always available even with no node connected.

## Clearing node filters

**Clear node filters** removes the pushed rules from the node — `clear/spot all`
on DXSpider, an empty `set/dx/filter` on AR-Cluster. **Fetch node filters**
retrieves what the node currently has (`show/dx options` on AR-Cluster).

Node behaviour varies; when in doubt keep filters **local**.
