# The world map

The **Map** tab plots spots on an inline world map. Wheel to zoom, drag to pan.

## Projection

In **Settings** (the Layers popover) or the Map quickbar you can choose:

- **Flat** (equirectangular) — the default.
- **Azimuthal** — centred on your QTH (from your locator), so bearings and
  distances read true from home. Great-circle paths become straight lines.

## Base layers

- **DX spot dots** — coloured by mode, faded by age, ringed if they match an
  alert. Click a dot for a fact card with an **Actions ▾** button (the same
  menu as the spot table); right-click opens that menu directly.
- **Grayline / night cap** — the current sub-solar point, night shading and the
  terminator.
- **Range rings** and **great-circle arcs** from your QTH (toggles).
- **DXCC prefix labels** — faint country prefixes, thinned out as needed so the
  map stays legible.
- **"Reports of me"** — see below.

## Propagation layers (Map quickbar)

All computed on your machine from data already in the app (WWV/WCY numbers, the
spot stream, your QTH) — no extra downloads, **except** the measured MUF
overlay:

| Layer              | What it shows                                                                                                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Grey line**      | A twilight annulus (width adjustable 3–12°) and rings on spot dots whose DX is in it.                                                                                                                                                                                                                   |
| **Aurora**         | K-index-scaled ovals around the geomagnetic poles.                                                                                                                                                                                                                                                      |
| **MUF**            | A filled-contour MUF(3000) map. A modelled field (from SFI/SSN) blended with **measured** ionosonde data from [prop.kc2g.com](https://prop.kc2g.com/) when the layer is on (fetched every 15 min, in memory only). The legend shows `kc2g · N` vs `model · SSN n`. It is an estimate, not a prediction. |
| **Openings**       | Every spot from the last 30 minutes as a faint great-circle arc — overlap shows where propagation is actually happening. A radius slider right under the checkbox restricts it to arcs whose **spotter** is within that distance of your QTH (500–20000 km; at the max it's "no limit").                |
| **Band rose**      | Recent spots binned into 12 bearing sectors; each petal is a stack of mode-coloured segments. A big bloom on the QTH in the azimuthal projection, a small corner rose on the flat one.                                                                                                                  |
| **Conditions HUD** | A small SFI / A / K / SSN panel (top-left), border tinted by K. Click it to jump to the Propagation tab.                                                                                                                                                                                                |

The band and mode chips in the Map quickbar filter the markers **and** the
openings / band-rose layers.

## Reports of me

This layer answers **"who is hearing me right now?"**. It scans the spot stream
(including the [RBN, PSK Reporter and WSJT-X](extra-feeds.md) feeds) for spots
of your callsign, plots the **receiver** position and draws a green arc home.

- Skimmer positions come from a real grid table, not a country centroid — a US
  skimmer plots in Maryland, not mid-Kansas. PSK Reporter's exact receiver grid
  wins when available.
- Reports of the same station on the same frequency from different feeds are
  **merged** into one marker (`spotter ×N`); the popup lists every underlying
  report with its age, SNR/WPM and comment.

## Map settings persist

Projection and every layer toggle are saved between sessions.
