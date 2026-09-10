# Getting started

## Installing

Grab the installer for your platform from the
[Releases page](https://github.com/dacrhu/dx-cluster-desktop/releases). Every
build is self-contained — you do **not** need to install Rust, Node or any
runtime.

| Platform              | File                          | Notes                                                                                                |
| --------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| Windows 10/11         | `.msi` or `.exe` (NSIS)       | WebView2 ships with Windows 11; on Windows 10 it is installed automatically if missing.              |
| macOS (Apple Silicon) | `aarch64` `.dmg`              | Drag to Applications. First launch: right-click → _Open_ to bypass Gatekeeper for an unsigned build. |
| macOS (Intel)         | `x64` `.dmg`                  | As above.                                                                                            |
| Linux                 | `.AppImage`, `.deb` or `.rpm` | The AppImage is portable — `chmod +x` and run. `.deb`/`.rpm` pull in the WebKitGTK dependency.       |

The only optional external program is **`rigctld`** for rig control. See
[Rig control and logging](rig-and-logging.md).

## First launch

The app opens on the **Connection** tab with no profiles configured. To get on
the air:

1. Click **+ Add** and either fill in a cluster's host/port/your callsign by
   hand, or open the **preset browser** and pick a public node by country. See
   [Connecting to clusters](connections.md).
2. Enter your **callsign** and, if the node needs it, a password (passwords are
   stored in your operating system's keyring, never in a file).
3. Save, then click **Connect**.

Once connected, the **Spots** tab fills with live spots. Everything else —
bandmap, map, alerts, mail — works off the same connection.

## The main window

The top bar has:

- **The app title** and a small **`v…` version chip** — click it to jump to the
  _Help_ tab.
- **Tab groups**, framed by purpose: _Connection_, _Spotting_ (Spots, Bandmap,
  Map, Filters, Alerts), _Bulletins_ (Announcements, Propagation), _Communication_
  (Talk, Chat, Mail, Users), _Advanced_ (Tools, Raw terminal) and _Help_.
- A coloured **dot on the Connection tab**: green = all profiles online, amber =
  some connecting, red = none up.
- **Activity dots** on other tabs when something new arrives while you are
  looking elsewhere.
- A **CAT chip** (when rig control is on) showing the live VFO.
- A **send-target selector** (only when more than one command-capable node is
  online) that chooses which node your posts, mail and queries go to.
- A **max-age** field that hides spots older than N minutes everywhere.

Every panel stays loaded in the background, so switching tabs never loses your
place, your fetched mail list or an open conversation.

## Your station details

Open **Connection → Settings → Your station** and set your **Maidenhead
locator** (e.g. `JN97MN`). This powers beam headings, the azimuthal map
projection, range rings and the "reports of me" map layer. Do this once.
