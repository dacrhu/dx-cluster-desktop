# Troubleshooting

## Connection

**"The node closed the connection … is another client connected elsewhere?"**
Most nodes allow only one session per callsign. Disconnect your other client, or
use a different SSID.

**Stuck on "logging in".** Some nodes are slow to send their prompt. Give it
30 seconds. Check the [raw terminal](raw-terminal.md) to see what the node is
actually sending. If it is asking something unexpected, answer once in the raw
terminal — the app learns the prompt for next time on well-known node types
only.

**No spots after connecting.** Check your [quick filters](spots.md) — a band or
mode chip, or a search term, may be hiding everything. Clear the search box and
un-select all chips.

## Notifications (Linux)

Desktop notifications on Linux go through a dedicated code path because the
standard plugin is a silent no-op on many setups. If you get **no toast at
all**:

- For a **release build**, the `.desktop` file is installed for you.
- For a **development run** (`cargo`/`pnpm tauri dev`), create
  `~/.local/share/applications/hu.dacr.dxclusterdesktop.desktop` by hand with an
  `Exec=` line pointing at the actual built binary — GLib rejects the file if
  that binary doesn't exist.
- On **GNOME 49** a known shell bug can destroy an app-attributed notification
  before it draws; the app works around it by holding recent notification
  handles open. If toasts still flash and vanish, update GNOME.

Set the environment variable `DXCD_NOTIFY_TEST=1` to fire a self-test
notification at startup.

## Rig control

**"rigctld not found" / model list is tiny.** Install Hamlib — see
[Rig control and logging](rig-and-logging.md). Without it, only a bundled model
snapshot is available and serial mode can't start its own `rigctld`.

**CAT connects but frequency never updates.** Enable **Poll VFO**.

**Wrong mode set on DIGI spots.** Change the **Digital mode** setting
(`none` / `USB` / `data`).

## Logger hand-off

**"Prepare QSO" does nothing.** Check the logger's UDP port matches the app's
**Log push** port, and that the logger is listening for WSJT-X (or ADIF)
datagrams. Use the **Test** button to isolate the app from the spot flow.

**The logger window doesn't come to the front.** Under Wayland you must give the
app-id (e.g. `io.github.foldynl.QLog`, from `flatpak list`), not the window
title. Install `wmctrl` / `xdotool` for X11 sessions.

## Text / encoding

**Accented characters in mail come out as `?` or garbage.** The node is
ASCII-only and strips them — not the app. Use the composer's **fold to ASCII**
option. Incoming Latin-1 text is decoded correctly by the app.

## Data files

**DXCC lookups are blank.** The `cty.dat` download and the bundled copy both
failed to load. Open **Settings → DXCC country file** and click "check now".

## Still stuck?

Open an issue at
[github.com/dacrhu/dx-cluster-desktop/issues](https://github.com/dacrhu/dx-cluster-desktop/issues)
with your OS, the app version (top-bar chip / Help tab) and, if relevant, the
raw-terminal output.
