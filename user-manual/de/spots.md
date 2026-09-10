# Die Spot-Tabelle

Der Tab **Spots** ist das Herz der App: eine schnelle, virtualisierte Tabelle
jedes empfangenen DX-Spots, neueste oben.

## Spalten

- **Alter** — wie lange der Spot her ist, laufend aktualisiert.
- **Frequenz** und **Band**.
- **DX** — die gespottete Station, mit ihrer DXCC-Entität, CQ-Zone und
  Antennenrichtung von deinem Locator aus (für Details mit der Maus darüber).
- **Spotter** — wer ihn gemeldet hat, mit seiner DXCC.
- **Mode** — CW / SSB / DIGI / FM, farbcodiert. Das Label zeigt den konkreten
  Sub-Mode (FT8, RTTY, SSTV…), wenn der Kommentar ihn verrät.
- **Kommentar** — die Notiz des Spotters (QSX, RST, „up 2“ usw.).

Zeilen, die zu einem aktivierten Alarm passen, sind eingefärbt. Wenn die
Funkgerätesteuerung an ist, wird die Zeile am nächsten zu deiner VFO
hervorgehoben.

## Schnellfilter

Die Leiste über der Tabelle ist **mit Bandmap und Karte geteilt**:

- **Suchfeld** — die [Suchsprache](search-query.md), mit einem **?**-Popover,
  das sie dokumentiert.
- **Skimmer**- und **WSJT-X**-Schalter — diese Spot-Quellen ein-/ausblenden.
- **Band-Chips** und **Mode-Chips** — zum Einschließen klicken; leer bedeutet
  „alle“. Die Bandliste wird aus den tatsächlich im Feed vorhandenen Bändern
  gebildet.

Die Filterung ist sofort und lokal — sie ändert nie, was der Node sendet. Zur
Node-seitigen Filterung siehe [Spot-Filter](filters.md).

## Einfrieren beim Scrollen

Scrolle nach unten, und die Tabelle **friert** einen Schnappschuss ein, damit
eingehende Spots nicht verschieben, was du liest. Ein Chip oben („↓ N neu“)
springt zurück zur Live-Oberkante. Eine Änderung der Suche taut automatisch auf.

## Linksklick: das Spot-Popover

Klicke auf einen Spot, um eine kompakte Faktenkarte mit Frequenz/Band, Mode,
DXCC, Spotter, Richtung, Alter und Kommentar zu öffnen, plus Aktionsschaltflächen:

- **Funkgerät abstimmen** — dein Funkgerät auf den Spot setzen (benötigt
  [CAT](rig-and-logging.md)).
- **Split — TX auf …** — nur gezeigt, wenn im Kommentar ein QSX/Split erkannt
  wird.
- **QSO vorbereiten** — den Spot an dein Logprogramm übergeben (benötigt
  [Log-Push](rig-and-logging.md)).
- Das geteilte **Aktionsmenü** (siehe unten).

## Rechtsklick: das Aktionsmenü

- **Talk mit dem DX / Spotter** — springt zum Tab Talk mit diesem Rufzeichen.
- **Einen Spot vorbereiten** — füllt das darunterliegende Formular „einen Spot
  absetzen“ mit dieser Frequenz und diesem Rufzeichen vor.
- Kopierhelfer.

## Einen Spot absetzen

Das Formular **einen Spot absetzen** unten nimmt eine Frequenz, ein Rufzeichen
und einen optionalen Kommentar und sendet einen korrekt formatierten
`DX`-Befehl an deinen [Sendeziel](settings.md)-Node. Wenn CAT verbunden ist,
folgt das Frequenzfeld deiner VFO, bis du hineintippst; ein **VFO**-Chip holt es
zurück.

## Neu-Aktivitäts-Punkt

Der Tab Spots zeigt einen Aktivitätspunkt, wenn ein Spot, der zu deiner
aktuellen Suche passt, eintrifft, während du auf einem anderen Tab bist.
