# Mitteilungen, WWV/WCY und WX

## Mitteilungen

Der Tab **Mitteilungen** listet Cluster-Mitteilungen (`To ALL`-Nachrichten,
Node-Hinweise, DXpedition-Bulletins). Das Suchfeld nimmt durch Leerzeichen
getrennte **Einschluss**- / **`-Ausschluss`**-Begriffe, abgeglichen gegen
Absender, Ziel und Text — so blendet `-telnet` Zeilen aus, die telnet erwähnen,
und `dxpedition -test` engt auf echte Bulletins ein.

### Spam-Filter

Cluster-Nodes werben gern immer wieder für sich selbst. Drei Ebenen halten das
aus der Liste fern (die Daten werden nur ausgeblendet, nie gelöscht):

- **Cluster-Node-Werbung ausblenden** (standardmäßig an) — erkennt Mitteilungen,
  die einen Node bewerben (`telnet …`, `host:port`, eine IP-Adresse oder
  „cluster" / „DXSpider" zusammen mit einer Web-Adresse).
- **Wiederholungen bündeln (×N)** (standardmäßig an) — derselbe Text derselben
  Station erscheint einmal mit einem `×N`-Abzeichen; beim Darüberfahren siehst
  du alle Sendezeiten. Der von Nodes angehängte Datums-/Zeitstempel
  (`26-Oct-2026 2100Z`) zählt beim Vergleich nicht.
- **Manuell stummschalten** — fahre über eine Zeile und klicke **⊘**, um diese
  Mitteilung und alle gleichartigen (beliebiger Absender) auszublenden, oder
  **⊘⊘** für alles von dieser Station (alle SSIDs). Die Stummschaltungen bleiben
  gespeichert. **Stummgeschaltet: N ▾** listet sie auf, dort lassen sie sich
  entfernen; **Ausgeblendete zeigen (N)** listet die gefilterten Zeilen
  abgeblendet.

Ausgeblendete Mitteilungen und gebündelte Wiederholungen lassen den
Aktivitätspunkt des Tabs nicht aufleuchten.

Historische Mitteilungen können mit `SH/ANN` vom Node importiert werden.

## Ausbreitung (WWV / WCY)

Der Tab **Ausbreitung** zeigt die solar-terrestrischen Zahlen:

- **WWV** — SFI, A-Index, K-Index und eine kurze Vorhersage, wie ausgestrahlt.
- **WCY** — das DK0WCY-Bulletin: SFI, A, K, erwartetes K, Sonnenwind, Bz,
  Aurora-Aktivität, geomagnetisches Feld.

Beide werden als **aktuelle Kennzahlen-Kacheln** plus eine **Verlaufstabelle**
gezeigt. Ein Suchfeld über beiden Tabellen filtert sie (Einschluss / `-Ausschluss`,
abgeglichen gegen die Rohfelder).

Die WCY-Kurzcodes (`qui`, `act`, `maj`, `no`, `yes`…) werden im Kachel- und
Zellentext **dekodiert**; der Rohcode steht im Tooltip.

Unter den Kacheln liefert die **Bandvorhersage zu einem Ziel** ein VOACAP-artiges
Raster: Zielland wählen und für jedes Band (10–80 m) und jede UTC-Stunde sehen,
wie wahrscheinlich der Weg von deinem QTH offen ist (rot = geschlossen, grün =
zuverlässig), dazu TX- / MP- / RX-Streifen, die den Tag am QTH, an der Wegmitte
und am Ziel zeigen. Kurz- / Langweg umschaltbar; die aktuelle Stunde ist
unterstrichen. Es ist eine **Schätzung** (Sonnenfleckenzahl-MUF-Modell +
D-Schicht-Dämpfung), kein VOACAP-Lauf — keine Antennen, Leistung, Rauschen oder
Sporadic-E. Benötigt deinen QTH-Locator.

Diese Zahlen speisen auch das [Bedingungs-HUD und den MUF-Layer](map.md) der
Karte.

## WX (Wetter)

Ins Cluster gepostete Wetterbulletins erscheinen im Mitteilungsstrom (als
WX-Zeilen gekennzeichnet). Du kannst selbst ein **WX-Bulletin posten** aus dem
Panel Mitteilungen — es wird an deinen [Sendeziel](settings.md)-Node gesendet.

## Aktivitätspunkte

Die Tabs Mitteilungen und Ausbreitung lassen ihren Aktivitätspunkt aufleuchten,
wenn ein neues Bulletin eintrifft, während du woanders bist. Beim Start
empfangene Daten zählen nicht als „neu“.
