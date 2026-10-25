# Funkgerätesteuerung und Logging

Zwei optionale Verknüpfungen verwandeln einen Spot in ein QSO. Beide sind
standardmäßig aus, wohnen unter **Verbindung → Einstellungen** und sind **kein**
Cluster-Transport — sie sind eine lokale Hardwareverbindung und ein
Einweg-Hinweis an dein Logprogramm.

## Funkgerätesteuerung (CAT)

DX Cluster Desktop spricht mit deinem Funkgerät über **`rigctld`** aus
[Hamlib](https://hamlib.github.io/). **`rigctld` ist nicht gebündelt** —
installiere Hamlib selbst:

- **Linux** — `sudo dnf install hamlib` / `sudo apt install libhamlib-utils`.
- **macOS** — `brew install hamlib`.
- **Windows** — Hamlib herunterladen und dessen `bin` in deinen `PATH` legen.

Dann unter **Einstellungen → Funkgerätesteuerung (CAT)**:

| Transport    | Einrichtung                                                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Netzwerk** | Du führst `rigctld` selbst aus (oder es läuft auf einem anderen Rechner). Gib seinen Host und Port ein (Standard `127.0.0.1:4532`).                                                                                      |
| **Seriell**  | Die App startet und überwacht ihren eigenen `rigctld`. Wähle das **Modell** des Funkgeräts (Liste aus `rigctl -l`, oder ein gebündelter Schnappschuss, falls Hamlib fehlt), das **serielle Gerät** und die **Baudrate**. |

Weitere Optionen:

- **VFO abfragen** — das Funkgerät ~einmal pro Sekunde lesen; die
  Live-Frequenz/-Mode zeigt sich im **CAT-Chip** der oberen Leiste und treibt
  den Bandmap-Cursor an.
- **Folgen** — die Spots-Tabelle zur Zeile am nächsten zur VFO scrollen.
- **Digitaler Mode** — `none` / `USB` / `data`: welches Seitenband/welchen Mode
  die App für DIGI-Spots setzt (`PKTUSB` vs. einfaches `USB`).

### Auf einen Spot abstimmen

Aus dem [Popover](spots.md) eines Spots:

- **Funkgerät abstimmen** — Frequenz und (meist) Mode auf den Spot setzen.
- **Split — TX auf …** — gezeigt, wenn der Kommentar ein nutzbares QSX/Split hat
  (`QSX 14195`, `UP 2`, `up1.5`…). Setzt RX auf den Spot, TX auf das QSX. Ein
  einfaches _Funkgerät abstimmen_ danach löscht Split automatisch.

### „Einen Spot absetzen“ folgt der VFO

Solange CAT verbunden ist, spiegelt das Frequenzfeld von „einen Spot absetzen“
die VFO, bis du es bearbeitest; ein **VFO**-Chip holt es zurück.

## Übergabe an das Logprogramm („QSO vorbereiten“)

**QSO vorbereiten** sendet ein einmaliges UDP-Datagramm an dein Logprogramm,
damit sich sein Eingabefenster vorausfüllt. Es **speichert nie ein QSO** — du
loggst es weiterhin in deinem Programm.

| Format     | Für                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WSJT-X** | QLog, JTAlert, GridTracker, Log4OM — eine WSJT-X-Status-Nachricht mit Rufzeichen/Grid/Frequenz/Mode. (Diese Logger stempeln auch „Time On“ daraus, wie sie es für echtes WSJT-X tun.) |
| **ADIF**   | Logger im Log4OM-Stil — ein partieller `<CALL><FREQ><EOR>`-Datensatz.                                                                                                                 |

Setze **Host/Port** des Loggers (Standard `127.0.0.1:2237`). Aktiviere optional
**das Loggerfenster in den Vordergrund holen** und gib seinen Fenstertitel oder
seine freedesktop-App-ID an — die App wählt die richtige Methode für dein OS
(D-Bus/`gapplication` unter Wayland, `wmctrl`/`xdotool` unter X11, `AppActivate`
unter Windows, `osascript` unter macOS).

## Letztes QSO → Spot absetzen

Eine Station gearbeitet, die nicht im Cluster steht? Die Schaltfläche **Letztes
QSO** neben dem Spot-Formular übernimmt Rufzeichen und Frequenz aus dem letzten
Kontakt deines Logprogramms, ohne Abtippen. Zwei Quellen (Einstellungen →
Log-Gruppe):

- **ADIF-Datei** — Pfad zur ADIF-Datei deines Logs; bei jedem Klick wird der
  neueste Eintrag gelesen.
- **UDP vom Logprogramm** — bei leerem Pfad merkt sich die App das letzte QSO,
  das dein Logprogramm sendet: WSJT-X-/JTDX-Nachricht „QSO Logged“ oder ein
  ADIF-Datagramm von Log4OM oder GridTracker, oder die QLog-Meldung _Settings → Network → QSO Changes_. Das hört auf der Adresse des
  WSJT-X-Feeds; aktiviere ihn und richte das Logprogramm darauf aus.

Der Kommentar lautet immer `CQ <Modus>[/<Submodus>]` (Submodus nur, wenn das Log ihn enthält) — der eigene Log-Kommentar wird bewusst nie übernommen.

Die Schaltfläche füllt das Formular nur vor; **Senden** drückst du weiterhin selbst.

### Beispiel: QLog

Der Reiter _Settings → Network → Wsjtx_ in QLog legt nur fest, wie QLog
WSJT-X **empfängt** — er sendet nichts an uns. So übergibst du geloggte QSOs:

1. Hier: den WSJT-X-Feed aktivieren (Verbindung → Einstellungen) mit einer
   **Multicast**-Adresse wie `239.255.0.1:2237` (siehe
   [Zusätzliche Spot-Quellen](extra-feeds.md)).
2. In QLog: _Settings → Network → QSO Changes_ → an dieselbe Adresse und denselben
   Port senden.
3. Ein QSO in QLog loggen, dann **Letztes QSO** drücken.

Mit einer Multicast-Adresse bekommt jedes Programm eine eigene Kopie, QLog,
WSJT-X und diese App streiten also nicht um den Port. QLog sendet das
gespeicherte QSO als in JSON verpacktes ADIF; Löschungen werden ignoriert.

## Test-Schaltflächen

Beide Abschnitte haben eine **Test**-Schaltfläche — ein
CAT-Hin-und-Zurück-Lesevorgang oder ein Beispiel-Log-Push-Datagramm — sodass du
die Verkabelung ohne echten Spot prüfen kannst.
