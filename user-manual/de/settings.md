# Einstellungen und Sprachen

Öffne **Verbindung → Einstellungen**. Jeder Block ist eine einklappbare Gruppe;
das Öffnen einer schließt die anderen.

## Oberflächensprache

Wähle **System**, **English**, **Magyar** oder **Deutsch**. „System“ folgt der
UI-Sprache deines Betriebssystems (über das OS erkannt, nicht über den Browser,
da das unter Linux unzuverlässig ist).

> Nach einer Sprachänderung wird **ein Neustart dringend empfohlen** — ein paar
> Zeichenketten aktualisieren sich erst beim nächsten Start.

Eine andere Sprache gewünscht? Siehe
[TRANSLATING.md](https://github.com/dacrhu/dx-cluster-desktop/blob/main/TRANSLATING.md)
— kein Programmieren nötig, du bearbeitest Textdateien auf GitHub.

## Deine Station

Dein **Maidenhead-Locator**. Treibt Antennenrichtungen, die azimutale Karte,
Entfernungsringe und den Layer „Meldungen über mich“ an. Einmal setzen.

## Referenzdaten

- **DXCC-Länderdatei (`cty.dat`)** — Rufzeichen → DXCC / Zonen / Kontinent /
  Koordinaten. Aktualisiert sich wöchentlich automatisch mit einem bedingten
  Download. Status + „jetzt prüfen“ hier. Quelle:
  [country-files.com](https://www.country-files.com/).
- **Cluster-Presets** — die ~730-Node-Liste hinter dem Preset-Browser. Dasselbe
  Auto-Update-Muster. Quelle: [dxcluster.info](https://dxcluster.info/).

## Feeds

- **PSK Reporter** — aktivieren + beobachtete Rufzeichen. Siehe
  [Zusätzliche Spot-Quellen](extra-feeds.md).
- **WSJT-X** — aktivieren + Bind-Adresse + Anzeigen/Ausblenden-Schalter.
- **Mail** — Mail-Überwachung Ein/Aus (10-Minuten-Directory-Abfrage +
  Benachrichtigung).

## Funkgerätesteuerung (CAT) und Log-Push

Siehe [Funkgerätesteuerung und Logging](rig-and-logging.md).

## Wo Einstellungen wohnen

- Nicht geheime Einstellungen: `settings.json` im Datenverzeichnis der App.
- Verbindungsprofile: der Tauri-Store.
- Cluster-Passwörter: dein **OS-Schlüsselbund** — nie im Klartext auf die
  Festplatte geschrieben.
- Spot-Verlauf, Mail-Körper, Talk-/Chat-Verlauf: eine lokale SQLite-Datenbank.
- Alarm-Treffer und der Ansichtszustand von Karte / Bandmap / Aktivität: separat
  gespeichert, sodass sie einen Neustart überstehen.

## Schnelleinstellungen der oberen Leiste

- **Max. Alter (Min.)** — blendet Spots, die älter als dies sind, überall aus
  (0/∞ = aus).
- **Sendeziel** — erscheint, wenn >1 befehlsfähiger Node online ist; wählt,
  welcher Node deine Spots, Mail, Talk und Abfragen empfängt.
