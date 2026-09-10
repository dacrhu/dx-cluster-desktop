# Die Weltkarte

Der Tab **Karte** trägt Spots auf einer eingebetteten Weltkarte auf. Mit dem Rad
zoomen, mit der Maus ziehen zum Verschieben.

## Projektion

In den **Einstellungen** (das Layers-Popover) oder der Karten-Schnellleiste
kannst du wählen:

- **Flach** (equirektangular) — die Vorgabe.
- **Azimutal** — auf deinen QTH zentriert (aus deinem Locator), sodass
  Richtungen und Entfernungen von zu Hause aus stimmen. Großkreispfade werden zu
  geraden Linien.

## Basis-Layer

- **DX-Spot-Punkte** — nach Mode eingefärbt, nach Alter verblasst, umringt, wenn
  sie zu einem Alarm passen. Klicke auf einen Punkt für eine Faktenkarte mit
  einer Schaltfläche **Aktionen ▾** (dasselbe Menü wie die Spot-Tabelle); ein
  Rechtsklick öffnet dieses Menü direkt.
- **Graulinie / Nachtkappe** — der aktuelle subsolare Punkt, Nachtschattierung
  und der Terminator.
- **Entfernungsringe** und **Großkreisbögen** von deinem QTH (Schalter).
- **DXCC-Präfix-Labels** — schwache Länderpräfixe, bei Bedarf ausgedünnt, damit
  die Karte lesbar bleibt.
- **„Meldungen über mich“** — siehe unten.

## Ausbreitungs-Layer (Karten-Schnellleiste)

Alle auf deinem Rechner aus bereits in der App vorhandenen Daten berechnet
(WWV/WCY-Zahlen, der Spot-Strom, dein QTH) — keine zusätzlichen Downloads,
**außer** dem gemessenen MUF-Overlay:

| Layer              | Was er zeigt                                                                                                                                                                                                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Graulinie**      | Ein Dämmerungsring (Breite 3–12° einstellbar) und Ringe an Spot-Punkten, deren DX darin liegt.                                                                                                                                                                                                                                          |
| **Aurora**         | Nach K-Index skalierte Ovale um die geomagnetischen Pole.                                                                                                                                                                                                                                                                               |
| **MUF**            | Eine MUF(3000)-Karte mit gefüllten Konturen. Ein modelliertes Feld (aus SFI/SSN), gemischt mit **gemessenen** Ionosonden-Daten von [prop.kc2g.com](https://prop.kc2g.com/), wenn der Layer an ist (alle 15 Min. abgerufen, nur im Speicher). Die Legende zeigt `kc2g · N` vs. `model · SSN n`. Es ist eine Schätzung, keine Vorhersage. |
| **Öffnungen**      | Jeder Spot der letzten 30 Minuten als schwacher Großkreisbogen — die Überlappung zeigt, wo tatsächlich Ausbreitung stattfindet.                                                                                                                                                                                                         |
| **Bandrose**       | Jüngste Spots in 12 Richtungssektoren gebinnt; jedes Blütenblatt ist ein Stapel mode-eingefärbter Segmente. Eine große Blüte am QTH in der azimutalen Projektion, eine kleine Eckenrose in der flachen.                                                                                                                                 |
| **Bedingungs-HUD** | Ein kleines SFI-/A-/K-/SSN-Panel (oben links), Rahmen nach K eingefärbt. Klicke darauf, um zum Tab Ausbreitung zu springen.                                                                                                                                                                                                             |

Die Band- und Mode-Chips in der Karten-Schnellleiste filtern die Marker **und**
die Öffnungs-/Bandrosen-Layer.

## Meldungen über mich

Dieser Layer beantwortet **„wer hört mich gerade jetzt?“**. Er durchsucht den
Spot-Strom (einschließlich der [RBN-, PSK-Reporter- und
WSJT-X](extra-feeds.md)-Feeds) nach Spots deines Rufzeichens, trägt die
**Empfänger**-Position auf und zeichnet einen grünen Bogen nach Hause.

- Skimmer-Positionen stammen aus einer echten Grid-Tabelle, nicht aus einem
  Länder-Schwerpunkt — ein US-Skimmer wird in Maryland aufgetragen, nicht in der
  Mitte von Kansas. Das exakte Empfänger-Grid von PSK Reporter gewinnt, wenn
  verfügbar.
- Meldungen derselben Station auf derselben Frequenz aus verschiedenen Feeds
  werden zu einem Marker **zusammengeführt** (`spotter ×N`); das Popup listet
  jede zugrunde liegende Meldung mit ihrem Alter, SNR/WPM und Kommentar.

## Karteneinstellungen bleiben erhalten

Projektion und jeder Layer-Schalter werden zwischen Sitzungen gespeichert.
