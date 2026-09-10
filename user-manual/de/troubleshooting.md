# Fehlerbehebung

## Verbindung

**„Der Node hat die Verbindung geschlossen … ist ein anderer Client woanders
verbunden?“** Die meisten Nodes erlauben nur eine Sitzung pro Rufzeichen. Trenne
deinen anderen Client oder verwende eine andere SSID.

**Hängt bei „meldet an“.** Manche Nodes sind langsam beim Senden ihrer
Eingabeaufforderung. Gib ihm 30 Sekunden. Prüfe das
[Rohterminal](raw-terminal.md), um zu sehen, was der Node tatsächlich sendet.
Fragt er etwas Unerwartetes, antworte einmal im Rohterminal — die App lernt die
Eingabeaufforderung für das nächste Mal nur bei bekannten Node-Typen.

**Keine Spots nach dem Verbinden.** Prüfe deine
[Schnellfilter](spots.md) — ein Band- oder Mode-Chip oder ein Suchbegriff könnte
alles ausblenden. Leere das Suchfeld und wähle alle Chips ab.

## Benachrichtigungen (Linux)

Desktop-Benachrichtigungen unter Linux laufen über einen eigenen Codepfad, weil
das Standard-Plugin auf vielen Setups ein stiller No-op ist. Wenn du **gar keinen
Toast** bekommst:

- Bei einem **Release-Build** wird die `.desktop`-Datei für dich installiert.
- Bei einem **Entwicklungslauf** (`cargo`/`pnpm tauri dev`) erstelle
  `~/.local/share/applications/hu.dacr.dxclusterdesktop.desktop` von Hand mit
  einer `Exec=`-Zeile, die auf die tatsächlich gebaute Binärdatei zeigt — GLib
  weist die Datei zurück, wenn diese Binärdatei nicht existiert.
- Unter **GNOME 49** kann ein bekannter Shell-Bug eine app-zugeordnete
  Benachrichtigung zerstören, bevor sie gezeichnet wird; die App umgeht das,
  indem sie jüngste Benachrichtigungs-Handles offen hält. Wenn Toasts immer noch
  aufblitzen und verschwinden, aktualisiere GNOME.

Setze die Umgebungsvariable `DXCD_NOTIFY_TEST=1`, um beim Start eine
Selbsttest-Benachrichtigung auszulösen.

## Funkgerätesteuerung

**„rigctld nicht gefunden“ / die Modellliste ist winzig.** Installiere Hamlib —
siehe [Funkgerätesteuerung und Logging](rig-and-logging.md). Ohne es ist nur ein
gebündelter Modell-Schnappschuss verfügbar und der serielle Modus kann seinen
eigenen `rigctld` nicht starten.

**CAT verbindet sich, aber die Frequenz aktualisiert sich nie.** Aktiviere
**VFO abfragen**.

**Falscher Mode bei DIGI-Spots gesetzt.** Ändere die Einstellung **Digitaler
Mode** (`none` / `USB` / `data`).

## Übergabe an das Logprogramm

**„QSO vorbereiten“ tut nichts.** Prüfe, ob der UDP-Port des Loggers zum
**Log-Push**-Port der App passt und ob der Logger auf WSJT-X- (oder ADIF-)
Datagramme lauscht. Nutze die **Test**-Schaltfläche, um die App vom Spot-Fluss zu
isolieren.

**Das Loggerfenster kommt nicht in den Vordergrund.** Unter Wayland musst du die
App-ID angeben (z. B. `io.github.foldynl.QLog`, aus `flatpak list`), nicht den
Fenstertitel. Installiere `wmctrl` / `xdotool` für X11-Sitzungen.

## Text / Kodierung

**Akzentuierte Zeichen in Mail kommen als `?` oder Kauderwelsch heraus.** Der
Node ist nur ASCII und entfernt sie — nicht die App. Nutze die Option **auf ASCII
falten** des Editors. Eingehender Latin-1-Text wird von der App korrekt
dekodiert.

## Datendateien

**DXCC-Nachschlagevorgänge sind leer.** Der `cty.dat`-Download und die gebündelte
Kopie konnten beide nicht geladen werden. Öffne **Einstellungen → DXCC-Länderdatei**
und klicke auf „jetzt prüfen“.

## Immer noch festgefahren?

Öffne ein Issue unter
[github.com/dacrhu/dx-cluster-desktop/issues](https://github.com/dacrhu/dx-cluster-desktop/issues)
mit deinem OS, der App-Version (Chip in der oberen Leiste / Tab Hilfe) und, falls
relevant, der Ausgabe des Rohterminals.
