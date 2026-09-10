# Erste Schritte

## Installation

Hol dir den Installer für deine Plattform von der
[Releases-Seite](https://github.com/dacrhu/dx-cluster-desktop/releases). Jeder
Build ist eigenständig — du musst **weder** Rust, Node noch irgendeine Laufzeit
installieren.

| Plattform             | Datei                           | Hinweise                                                                                                                         |
| --------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Windows 10/11         | `.msi` oder `.exe` (NSIS)       | WebView2 ist bei Windows 11 dabei; unter Windows 10 wird es automatisch installiert, falls es fehlt.                             |
| macOS (Apple Silicon) | `aarch64` `.dmg`                | In den Programme-Ordner ziehen. Erster Start: Rechtsklick → _Öffnen_, um den Gatekeeper bei einem unsignierten Build zu umgehen. |
| macOS (Intel)         | `x64` `.dmg`                    | Wie oben.                                                                                                                        |
| Linux                 | `.AppImage`, `.deb` oder `.rpm` | Das AppImage ist portabel — `chmod +x` und ausführen. `.deb`/`.rpm` ziehen die WebKitGTK-Abhängigkeit nach.                      |

Das einzige optionale externe Programm ist **`rigctld`** für die
Funkgerätesteuerung. Siehe [Funkgerätesteuerung und Logging](rig-and-logging.md).

## Erster Start

Die App öffnet sich im Tab **Verbindung** ohne konfigurierte Profile. Um auf
Sendung zu gehen:

1. Klicke auf **+ Hinzufügen** und trage entweder Host/Port/dein Rufzeichen
   eines Clusters von Hand ein, oder öffne den **Preset-Browser** und wähle
   einen öffentlichen Node nach Land aus. Siehe
   [Verbindung zu Clustern](connections.md).
2. Gib dein **Rufzeichen** ein und, falls der Node es benötigt, ein Passwort
   (Passwörter werden im Schlüsselbund deines Betriebssystems gespeichert, nie in
   einer Datei).
3. Speichern, dann auf **Verbinden** klicken.

Sobald du verbunden bist, füllt sich der Tab **Spots** mit Live-Spots. Alles
Übrige — Bandmap, Karte, Alarme, Mail — arbeitet über dieselbe Verbindung.

## Das Hauptfenster

Die obere Leiste enthält:

- **Den App-Titel** und ein kleines **`v…`-Versionschip** — klicke darauf, um zum
  Tab _Hilfe_ zu springen.
- **Tab-Gruppen**, nach Zweck gerahmt: _Verbindung_, _Spotting_ (Spots, Bandmap,
  Karte, Filter, Alarme), _Bulletins_ (Mitteilungen, Ausbreitung),
  _Kommunikation_ (Talk, Chat, Mail, Benutzer), _Erweitert_ (Werkzeuge,
  Rohterminal) und _Hilfe_.
- Ein farbiger **Punkt am Tab Verbindung**: grün = alle Profile online, gelb =
  einige verbinden sich, rot = keines aktiv.
- **Aktivitätspunkte** an anderen Tabs, wenn etwas Neues eintrifft, während du
  woanders schaust.
- Ein **CAT-Chip** (wenn die Funkgerätesteuerung an ist), der die Live-VFO zeigt.
- Eine **Sendeziel-Auswahl** (nur wenn mehr als ein befehlsfähiger Node online
  ist), die festlegt, an welchen Node deine Spots, Mail und Abfragen gehen.
- Ein Feld **Max. Alter**, das Spots, die älter als N Minuten sind, überall
  ausblendet.

Jedes Panel bleibt im Hintergrund geladen, sodass ein Tab-Wechsel nie deine
Position, deine abgerufene Mail-Liste oder eine offene Unterhaltung verliert.

## Deine Stationsdaten

Öffne **Verbindung → Einstellungen → Deine Station** und setze deinen
**Maidenhead-Locator** (z. B. `JN97MN`). Das treibt Antennenrichtungen, die
azimutale Kartenprojektion, Entfernungsringe und den Kartenlayer „wer hört mich“
an. Einmal machen.
