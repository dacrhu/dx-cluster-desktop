# Werkzeuge und Node-Abfragen

Das Panel **Werkzeuge** führt Cluster-`SHOW`-Abfragen aus und präsentiert die
Ergebnisse — roh, wo es keine Struktur gibt, formatiert, wo es sie gibt.

## SH/DX — Spot-Verlauf

Eine strukturierte historische Spot-Suche. Fülle beliebige davon aus: Anzahl,
Band, Rufzeichen, Spotter, Stunden zurück. Das Panel zeigt den exakten Befehl,
den es senden wird (der sich je Node-Dialekt unterscheidet — positional bei
DXSpider, `field=value` bei AR-Cluster), sodass die Schaltfläche und der Befehl
immer übereinstimmen.

Die Ergebnisse werden als Tabelle mit derselben Mode-Einfärbung wie die
Live-Spots-Tabelle gezeigt. Hat der Node keinen Verlauf, kannst du dieselbe
Suche **offline** gegen die lokale Spot-Datenbank ausführen.

## Generische sh/*-Abfragen

Ein Dropdown gängiger Nachschlagevorgänge, jeder mit dem benötigten Argument:

| Befehl                                 | Verwendung                                    |
| -------------------------------------- | --------------------------------------------- |
| `sh/prefix`                            | DXCC-/Zonen-Info für ein Präfix               |
| `sh/heading`                           | Antennenrichtung zu einem Rufzeichen/Präfix   |
| `sh/qra`                               | Entfernung/Peilung zwischen zwei Locatoren    |
| `sh/sun`, `sh/moon`                    | Sonnenauf-/-untergang, Monddaten              |
| `sh/muf`                               | die MUF-Schätzung des Nodes für einen Locator |
| `sh/dxcc`                              | jüngste Spots für eine DXCC                   |
| `sh/dxqsl`, `sh/db0sdx`, `sh/ik3qar`   | QSL-Routen-Datenbanken                        |
| `sh/route`                             | wie man eine Station im Cluster-Netz erreicht |
| `sh/dxstats`, `sh/configuration/nodes` | Node-Statistiken                              |

Alles, was der Node nicht erkennt, wird als „auf diesem Node nicht unterstützt“
gemeldet.

## Wenn es keinen Node gibt

Offline-`SH/DX` funktioniert weiterhin aus der lokalen Datenbank. Die anderen
`sh/*`-Abfragen brauchen einen Live-Node — es sind Durchreichbefehle.
