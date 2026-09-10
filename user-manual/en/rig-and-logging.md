# Rig control and logging

Two optional links turn a spot into a QSO. Both are off by default, live in
**Connection → Settings**, and are **not** cluster transports — they are a local
hardware link and a one-way hint to your logging program.

## Rig control (CAT)

DX Cluster Desktop talks to your radio through **`rigctld`** from
[Hamlib](https://hamlib.github.io/). **`rigctld` is not bundled** — install
Hamlib yourself:

- **Linux** — `sudo dnf install hamlib` / `sudo apt install libhamlib-utils`.
- **macOS** — `brew install hamlib`.
- **Windows** — download Hamlib and put its `bin` on your `PATH`.

Then in **Settings → Rig control (CAT)**:

| Transport   | Setup                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Network** | You run `rigctld` yourself (or it runs on another machine). Enter its host and port (default `127.0.0.1:4532`).                                                                      |
| **Serial**  | The app starts and supervises its own `rigctld`. Pick the rig **model** (list from `rigctl -l`, or a bundled snapshot if Hamlib is absent), the **serial device** and **baud rate**. |

Other options:

- **Poll VFO** — read the rig ~once a second; the live frequency/mode shows in
  the top-bar **CAT chip** and drives the Bandmap cursor.
- **Follow** — scroll the Spots table to the row nearest the VFO.
- **Digital mode** — `none` / `USB` / `data`: which sideband/mode the app sets
  for DIGI spots (`PKTUSB` vs plain `USB`).

### Tuning to a spot

From a spot's [popover](spots.md):

- **Tune radio** — set frequency and (usually) mode to the spot.
- **Split — TX on …** — shown when the comment has a workable QSX/split
  (`QSX 14195`, `UP 2`, `up1.5`…). Sets RX on the spot, TX on the QSX. A plain
  _Tune radio_ afterwards clears split automatically.

### Post-a-spot follows the VFO

While CAT is connected the "post a spot" frequency field mirrors the VFO until
you edit it; a **VFO** chip snaps it back.

## Log-program hand-off ("Prepare QSO")

**Prepare QSO** sends a one-shot UDP datagram to your logger so its entry window
pre-fills. It **never saves a QSO** — you still log it in your program.

| Format     | For                                                                                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WSJT-X** | QLog, JTAlert, GridTracker, Log4OM — a WSJT-X Status message with call/grid/freq/mode. (These loggers also stamp "Time On" from it, as they do for real WSJT-X.) |
| **ADIF**   | Log4OM-style listeners — a partial `<CALL><FREQ><EOR>` record.                                                                                                   |

Set the logger's **host/port** (default `127.0.0.1:2237`). Optionally enable
**raise the logger window** and give its window title or freedesktop app-id —
the app picks the right method for your OS (D-Bus/`gapplication` on Wayland,
`wmctrl`/`xdotool` on X11, `AppActivate` on Windows, `osascript` on macOS).

## Test buttons

Both sections have a **Test** button — a CAT round-trip read, or a sample
log-push datagram — so you can verify wiring without a real spot.
