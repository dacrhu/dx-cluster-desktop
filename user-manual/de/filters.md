# Spot-Filter

Das Panel **Filter** baut wiederverwendbare Filterregeln. Jede Regel ist eine
einklappbare Karte: der Kopf zeigt ein Aktivierungs-Häkchen, ihr Label und eine
einzeilige Zusammenfassung; der Körper ist der Editor.

Die Regeln verwenden dasselbe **Akkordeon** wie das Panel Alarme — jeweils eine
Karte offen, alle standardmäßig eingeklappt.

## Lokal vs. Node-seitig

Jede Regel hat einen **Geltungsbereich**:

- **Nur lokal** (die Vorgabe) — die Regel filtert die Spots, die du in der App
  siehst. Nichts wird an das Cluster gesendet. Das ist fast immer die richtige
  Wahl: sofort, umkehrbar und ohne Auswirkung auf andere Clients.
- **An Node senden** — zeigt zusätzlich den erzeugten Cluster-Befehl und eine
  Schaltfläche **Anwenden**, sodass der Node selbst aufhört, nicht passende
  Spots zu senden.

## Bedingungen

Die Bedingungen sind zwischen der **DX**-Seite und der **Spotter**-Seite
symmetrisch:

| Bedingung               | DX-Seite      | Spotter-Seite |
| ----------------------- | ------------- | ------------- |
| Kontinent-Chips         | ✓ (nur lokal) | ✓ (nur lokal) |
| DXCC                    | ✓             | ✓             |
| CQ-Zone                 | ✓             | ✓             |
| Rufzeichen-Präfix (CSV) | ✓             | ✓             |
| Mode / Skimmer          | nur lokal     | —             |

> **Die CQ-Zonen-Unterscheidung zählt.** „DX-CQ-Zone = Europa“ lässt weiterhin
> ein europäisches DX zu, das von einem US-Skimmer gespottet wurde. Um auch
> einzuschränken, wer es gemeldet hat, setze **Spotter-Kontinente** oder
> **Spotter-CQ-Zonen**.

Ein Feld **erweiterte Abfrage** (die [Suchsprache](search-query.md)) kann
hinzugefügt werden und wird mit den strukturierten Bedingungen UND-verknüpft.

## Node-Dialekte

Der erzeugte Befehl folgt der Einstellung **Software** des Zielnodes
(siehe [Verbindung zu Clustern](connections.md)):

- **DXSpider** — `accept/spot` / `reject/spot` mit nummerierten Slots.
- **AR-Cluster** — ein einzelner `set/dx/filter`-Ausdruck (ein aktiver Filter
  pro Sitzung; eine _Reject_-Regel wird zu `not (...)`).

Die Befehlsvorschau ist immer verfügbar, auch ohne verbundenen Node.

## Node-Filter löschen

**Node-Filter löschen** entfernt die gesendeten Regeln vom Node —
`clear/spot all` bei DXSpider, ein leeres `set/dx/filter` bei AR-Cluster.
**Node-Filter abrufen** holt, was der Node aktuell hat (`show/dx options` bei
AR-Cluster).

Das Node-Verhalten variiert; im Zweifel halte die Filter **lokal**.
