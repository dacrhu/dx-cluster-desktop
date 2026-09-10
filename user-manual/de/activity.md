# Die Aktivitätsmatrix

Der Tab **Aktivität** beantwortet eine Frage, die die Spot-Tabelle nicht kann:
_welches Band zieht an, und wohin?_ Er liest den Spot-Strom, binnt ihn nach Band
und nach dem Kontinent der DX-Station und zeigt den **Trend** — einen
15-Minuten-Gleitdurchschnitt gegen die vorangehenden 15 Minuten.

Auf einen Blick siehst du zum Beispiel, dass sich 40 m nach Europa öffnet,
während 15 m nach Nordamerika verblasst.

## Die Leiste „größte Bewegungen“

Zwei Zeilen oben — **Steigend** und **Fallend** — listen jeweils bis zu drei
`Band → Kontinent`-Paare, danach geordnet, wie stark sie sich bewegt haben:

- `40m → EU  ▲▲ +180%` — in den letzten 15 Minuten gab es rund 2,8-mal so viele
  40-m-Spots für europäisches DX wie in den 15 Minuten davor.
- `▲▲` / `▼▼` = eine starke Bewegung (±100 % oder mehr); `▲` / `▼` = eine
  mildere (±25 %).
- **new** statt eines Prozentwerts bedeutet, dass das Band in dieser Richtung
  einen Moment zuvor still war und gerade zum Leben erwacht ist.

Bewegt sich nichts eindeutig, zeigt die Leiste stattdessen eine einzelne
neutrale Zeile.

Klicke auf eine Bewegung, um zum Tab **Spots** zu springen, gefiltert auf jenes
Band und jene Richtung.

## Die Matrix

Zeilen sind Bänder, Spalten sind der Kontinent der DX-Station. Die
Spaltenkopfzeile zeigt den Kontinent, seinen Gesamt-Trendpfeil und seine
Gesamt-Spotzahl der letzten zwei Stunden.

Jede Zelle trägt:

- eine **Sparkline** der letzten zwei Stunden in 15-Minuten-Eimern,
- ein **Glühen**, dessen Helligkeit dem Gesamtverkehr der Zelle folgt (eine
  belebte Zelle sticht heraus, auch wenn ihr Trend flach ist),
- ein **Abzeichen** — `▲▲ ▲ – ▼ ▼▼` und die prozentuale Änderung. Grün steigt,
  Rot fällt, ein gedämpftes `–` ist stabil.

Eine leere Zelle (ein schwaches `·`) bedeutet keine Spots auf jenem Band in
Richtung jenes Kontinents im Fenster.

Das Raster füllt das Panel: mit nur wenigen Bändern wachsen die Zeilen und die
Sparklines werden groß; mit vielen Bändern schrumpfen die Zeilen auf ein festes
Minimum und das Raster scrollt. Die Bänder einzuengen (hier oder am Node) ist ein
guter Weg zu größeren Diagrammen.

Klicke auf eine Zelle, um **Spots** gefiltert auf jenes Band und jene Richtung zu
öffnen.

## „Spotter“ — den Trend eingrenzen

Das ist die wichtige Steuerung. „40 m steigt nach Nordamerika“ ist
**irreführend**, wenn jeder Skimmer, der Nordamerika hört, auch _dort sitzt_ —
von deiner eigenen Station aus hörst du vielleicht nichts.

Also engt die Matrix die Spots zuerst auf jene ein, die von einem **Spotter auf
einem gewählten Kontinent** gemacht wurden, und binnt sie erst dann danach, wo
das DX ist. Die Auswahl **Spotter** wählt diesen Kontinent:

- **Auto** — dein eigener Kontinent, aus deinem QRA-Locator ermittelt (setze ihn
  im [Verbindungs-Panel](connections.md)). Das ist die Vorgabe und die
  nützlichste: es zeigt, was _von hier aus_ arbeitbar ist.
- **Ein bestimmter Kontinent** — sieh, was etwa nordamerikanische Stationen
  hören.
- **Überall** — kein Spotter-Filter; jeder Spot zählt.

Ohne QRA-Locator fällt Auto auf _Überall_ zurück und das Panel sagt das.

## Filter und Fenster

- Die Schnellfilter-Leiste (Suche, Skimmer-/WSJT-X-Schalter, Band- und
  Mode-Chips) ist **mit Spots, Bandmap und Karte geteilt**. Auf `mode:cw`
  einzuengen ergibt zum Beispiel einen reinen CW-Trend.
- Die Fenster sind fest: ein **15-Minuten**-Gleitdurchschnitt und ein
  **2-Stunden**-Sparkline-Verlauf. Sie sind bewusst **unabhängig von der
  Einstellung „Max. Alter“ der oberen Leiste** — das Panel braucht immer die
  vollen zwei Stunden Verlauf.
- Alles ist gemessene Daten aus dem Spot-Feed über ein kurzes Fenster — eine
  Schätzung des Momentums, keine Ausbreitungsvorhersage.
