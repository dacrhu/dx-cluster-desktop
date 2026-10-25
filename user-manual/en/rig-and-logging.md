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

## Last QSO → post a spot

Worked a station that isn't on the cluster? The **Last QSO** button next to
the post-a-spot form fills the callsign and frequency from your logger's most
recent contact, so you don't copy them by hand. Two sources (Settings → log
group):

- **ADIF file** — give the path of your logger's ADIF log; the button reads its
  newest record each time you click.
- **UDP from the logger** — leave the path empty and the app remembers the last
  QSO your logger sends: WSJT-X / JTDX "QSO Logged" messages, or an ADIF
  datagram from Log4OM or GridTracker, or QLog's _Settings → Network → QSO Changes_ notification. This listens on the WSJT-X feed
  address, so enable that feed and point the logger at it.

The comment is always `CQ <mode>[/<submode>]` (submode only when the log defines it) — the log's own comment is deliberately never copied.

The button only pre-fills the form; you still press **Send**.

### Example: QLog

QLog's _Settings → Network → Wsjtx_ tab only configures how QLog **receives**
WSJT-X — it sends nothing to us. To hand your logged QSOs over:

1. Here: enable the WSJT-X feed (Connection → Settings) with a **multicast**
   address such as `239.255.0.1:2237` (see [Extra spot sources](extra-feeds.md)).
2. In QLog: _Settings → Network → QSO Changes_ → send to that same address and
   port.
3. Log a QSO in QLog, then press **Last QSO**.

With a multicast address every program gets its own copy, so QLog, WSJT-X and
this app don't fight over the port. QLog sends the saved QSO as JSON-wrapped
ADIF; deletions are ignored.

## Test buttons

Both sections have a **Test** button — a CAT round-trip read, or a sample
log-push datagram — so you can verify wiring without a real spot.
