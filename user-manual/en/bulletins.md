# Announcements, WWV/WCY and WX

## Announcements

The **Announcements** tab lists cluster announcements (`To ALL` messages, node
notices, DXpedition bulletins). The search box takes space-separated
**include** / **`-exclude`** terms matched against sender, target and text — so
`-telnet` hides rows that mention telnet, `dxpedition -test` narrows to real
bulletins.

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

These numbers also feed the map's [Conditions HUD and MUF layer](map.md).

## WX (weather)

Weather bulletins posted to the cluster appear in the Announcements stream
(tagged as WX rows). You can **post a WX bulletin** yourself from the
Announcements panel — it is sent to your [send-target](settings.md) node.

## Activity dots

The Announcements and Propagation tabs light their activity dot when a new
bulletin arrives while you are elsewhere. Data received at startup is not
counted as "new".
