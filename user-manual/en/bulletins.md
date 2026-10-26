# Announcements, WWV/WCY and WX

## Announcements

The **Announcements** tab lists cluster announcements (`To ALL` messages, node
notices, DXpedition bulletins). The search box takes space-separated
**include** / **`-exclude`** terms matched against sender, target and text — so
`-telnet` hides rows that mention telnet, `dxpedition -test` narrows to real
bulletins.

### Spam filter

Cluster nodes love to advertise themselves, over and over. Three layers keep
that out of the list (the data is only hidden, never deleted):

- **Hide cluster-node adverts** (on by default) — recognises messages that
  advertise a node (`telnet …`, `host:port`, an IP address, or "cluster" /
  "DXSpider" together with a web address).
- **Fold repeats (×N)** (on by default) — the same text from the same station
  appears once, with a `×N` badge; hover it for every time it was posted. The
  date/time stamp nodes add (`26-Oct-2026 2100Z`) is ignored when comparing.
- **Mute by hand** — hover a row and click **⊘** to hide that message and all its
  look-alikes (any sender), or **⊘⊘** to hide everything from that station (all
  SSIDs). Mutes are saved. **Muted: N ▾** lists them so you can remove one;
  **Show hidden (N)** lists the filtered rows, dimmed.

Hidden and folded repeats do not light the tab's activity dot.

Historical announcements can be imported from the node with `SH/ANN`.

## Propagation (WWV / WCY)

The **Propagation** tab shows the solar-terrestrial numbers:

- **WWV** — SFI, A-index, K-index and a short forecast, as broadcast.
- **WCY** — the DK0WCY bulletin: SFI, A, K, expected K, solar wind, Bz, aurora
  activity, geomagnetic field.

Both are shown as **current stat tiles** plus a **history table**. One search
box above both tables filters them (include / `-exclude`, matched against the
raw fields).

The WCY shorthand codes (`qui`, `act`, `maj`, `no`, `yes`…) are **decoded** in
the tile and cell text; the raw code is in the tooltip.

Below the tiles, **Band forecast to a target** gives a VOACAP-style grid: pick a
target country and see, for each band (10–80 m) and each UTC hour, how likely
the path from your QTH is to be open (red = closed, green = reliable), plus
TX / MP / RX strips showing daylight at your QTH, the path midpoint and the
target. Toggle short / long path; the current hour is underlined. It is an
**estimate** (sunspot-number MUF model + D-layer absorption), not a VOACAP
run — no antennas, power, noise or sporadic-E. Needs your QTH locator.

These numbers also feed the map's [Conditions HUD and MUF layer](map.md).

## WX (weather)

Weather bulletins posted to the cluster appear in the Announcements stream
(tagged as WX rows). You can **post a WX bulletin** yourself from the
Announcements panel — it is sent to your [send-target](settings.md) node.

## Activity dots

The Announcements and Propagation tabs light their activity dot when a new
bulletin arrives while you are elsewhere. Data received at startup is not
counted as "new".
