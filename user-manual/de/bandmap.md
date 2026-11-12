# Die Bandmap

Die **Bandmap** zeigt je Band eine scrollbare vertikale Bahn, mit Stationen nach
Frequenz angeordnet — die klassische „Bandmap“-Ansicht, vollständig aus dem
Spot-Feed gesteuert.

## Eine Bahn lesen

- **Eine Zeile pro Station.** Spots desselben Rufzeichens innerhalb von ~0,5 kHz
  verschmelzen zu einem einzigen Marker, der den frischesten Spot und ein
  **×N**-Abzeichen zeigt (für die Liste der Spotter mit der Maus darüber). Eine
  von vielen Skimmern gehämmerte Station ist eine Zeile, nicht acht.
- Die **Frequenzachse ist nichtlinear**: Zeilen werden nach Dichte gepackt und
  jede Zeile druckt ihre exakte Frequenz in die linke Rinne. Die
  **Bandplan-Schattierung** (CW / DIGI / SSB) dehnt sich, um den Zeilen zu
  folgen. Eine leere Bahn fällt auf eine einfache lineare Skala mit MHz-Ticks
  zurück.
- **Alters-Verblassen** dimmt ältere Spots; **Alarm-Einfärbung** markiert eine
  Station, die zu einem aktivierten Alarm passt.
- Ein **Mode-Punkt** (ohne Text) ist nach Kategorie eingefärbt; der Tooltip hat
  den Sub-Mode.

## Filtern und Zoom

Die Schnellfilter-Leiste (Suche, Skimmer-/WSJT-X-Schalter, Band- und Mode-Chips)
ist **mit Spots und Karte geteilt** — siehe [Die Spot-Tabelle](spots.md) und
[die Suchsprache](search-query.md). Die gezeigten Bahnen sind einfach die Bänder,
die in den gefilterten Spots vorhanden sind.

**Vertikaler Zoom**: `Strg` + Mausrad oder der Regler. `1` passt in den
Viewport; höher skaliert Bahnhöhe und Marker-Schrift. Die Einstellung wird
gemerkt.

**Lineare Skala** (Kontrollkästchen in der Werkzeugleiste): Standardmäßig bekommt jede
Station eine eigene Zeile, leere Bandabschnitte fallen also weg. Mit _Lineare Skala_
ist die Bahn eine proportionale Frequenzachse mit kHz-Lineal — Lücken bleiben
sichtbar —, und sich überdeckende Stationen stehen nebeneinander (bis zu drei
Spalten; wo mehr nicht passen, öffnet ein **+N**-Chip eine Liste aller Stationen dort). Die
Einstellung wird gemerkt.

## Spezielle Referenzmarker

Zwei statische, nur im Frontend gezeichnete Markersätze werden in jede Bahn als
halbhohe Zeilen eingezeichnet:

- **SOS** (rot) — die „globalen Notfall“-Simplexfrequenzen der IARU-Region 1
  (3760 / 7110 / 14300 / 18160 / 21360 / 24960 / 28360 kHz). Diese sind ein
  Höflichkeits-Anruf-/Koordinationspunkt für Katastrophenverkehr, **keine**
  offizielle Notfrequenz.
- **IBP** (blau) — die fünf Frequenzen des NCDXF/IARU International Beacon
  Project (14100 / 18110 / 21150 / 24930 / 28200 kHz).

### Optionale Marker und eigene Frequenzen

Die Schaltfläche **Marker ▾** in der Schnellleiste fügt weitere Zeilen hinzu,
standardmäßig alle aus: die üblichen Anruf-/Dial-Frequenzen von **FT8, FT4, FT2,
JS8, RTTY, SSTV** und **FreeDV** (hake an, was du willst). SOS und IBP sind fest und
nicht abschaltbar. Unter den Kontrollkästchen kannst du **eigene Frequenzen**
anlegen — Name, kHz-Wert und Farbe, z. B. die Frequenz, auf der du dich mit
Freunden triffst. Sie werden mit den Einstellungen gespeichert und in dem Band
angezeigt, in das sie fallen. Marker auf derselben Frequenz (z. B. FT4 und JS8 auf
18104 kHz) werden zu einer Zeile zusammengefasst. Das sind gängige Konventionen,
keine Zuweisungen.

Klicke auf einen für ein minimales Popover mit einer Schaltfläche **Funkgerät
abstimmen** (ausgeblendet, wenn CAT aus ist). Oben im Panel gibt es eine
Legendenleiste.

## Interaktion

- **Linksklick** auf eine Station → das Spot-Popover (abstimmen / Split / QSO
  vorbereiten / Aktionen).
- **Rechtsklick** auf eine Station → das Aktionsmenü.
- Siehe [Die Spot-Tabelle](spots.md), was diese tun.

- Jede Bahn zeigt **Bandanfang und -ende** (Frequenz in MHz) als markierten Rand. Die Bandgrenzen
  unterscheiden sich je IARU-Region (z. B. endet 40 m in Region 1 und 3 bei 7200 kHz, in Region 2 bei
  7300), daher gibt es in der Kopfleiste eine **IARU-Region**-Auswahl — _Auto_ nimmt sie aus deinem
  QTH-Locator. Der Teil einer Bahn jenseits der Grenze deiner Region ist schraffiert; Spots dort
  werden weiterhin angezeigt.

## Mit Funkgerätesteuerung

Wenn [CAT](rig-and-logging.md) verbunden ist, ergänzt die Bandmap:

- eine **Cursorlinie** an deiner VFO; die enthaltende Bahn wird hervorgehoben und
  die anderen verblassen,
- der Spot innerhalb von ~0,5 kHz der VFO wird umringt,
- verlässt das Funkgerät die **Amateurbänder**, erscheint ein rot blinkendes
  „Außerhalb des Bandes“-Banner, und die Randmarkierung (sowie der Kopf) des
  nächsten Bandes blinkt rot,
- die aktive Bahn **scrollt automatisch, um die VFO zentriert zu halten**. Ein
  manuelles Scrollen pausiert das (und friert die Bahn ein); die Schaltfläche
  **⌖** in der Bahn-Kopfzeile oder ein Bandwechsel setzt es fort,
- **ein Klick auf die Kopfzeile einer anderen Bahn QSYt das Funkgerät auf jenes
  Band** (die Frequenz des mittleren Spots oder `untere Kante + 20 kHz`, wenn die
  Bahn leer ist). Nur Frequenz — keine Mode-Änderung.
