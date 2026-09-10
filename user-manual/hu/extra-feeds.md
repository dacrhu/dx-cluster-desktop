# További spot-források

A Telneten érkező cluster-spotok mellett három **opcionális, csak olvasható**
feed adhat szintetikus spotokat. Mind alapból kikapcsolt, és a **Kapcsolat →
Beállítások** menüben állítható. Egyik sem hordoz cluster-forgalmat — ezek
„ki/mi hallja a jeleket” források, és a spotjaik **soha nem íródnak a helyi
adatbázisba** (újraindításkor eltűnnek).

## RBN (Reverse Beacon Network)

Adj hozzá egy **RBN feed** kapcsolati profilt (lásd
[Csatlakozás cluster­ekhez](connections.md)). Az RBN egy CW/RTTY/FT
skimmer-tűzcsóva; a kliens csak a saját hívójeled spotjait tartja meg, és a
térkép [„rólam szóló jelentések”](map.md) rétegébe irányítja őket. Portok:
`7000` CW/RTTY, `7001` FT8/FT4.

## PSK Reporter — „ki hall engem”

Egy opcionális MQTT-előfizetés (`mqtt.pskreporter.info`, sima TCP, nyilvános
adatok). Kapcsold be a **PSK Reporter**-t, és opcionálisan sorolj fel figyelendő
hívójeleket (üres = a profiljaid hívójelei). A rólad szóló vételi jelentések
szintetikus skimmer-spotokká alakulnak a jelentő **pontos** gridjével, és a
térkép „rólam szóló jelentések” rétegén jelennek meg.

Csak digitális módok — a CW/RTTY-t az RBN fedi le. A portable/verseny-hívójeleknek
saját bejegyzés kell (az illesztés pontos).

## WSJT-X — „mit hall a rádióm”

Egy opcionális **helyi UDP**-figyelő. Irányítsd a WSJT-X UDP-szerverét a
programra (alapból `127.0.0.1:2237`) — vagy használd a multicast-címét; a kliens
minden interfészen csatlakozik, és együtt él a JTAlerttel / GridTrackerrel /
QLoggal, mindegyik továbbra is teljes másolatot kap.

Minden WSJT-X dekódolás spottá válik `WSJT-X` spotterrel, saját
forráskategóriával, a dekódolt állomás gridjén elhelyezve. RF-frekvencia =
tárcsa + audio-eltolás. A láthatóságukat a gyorsszűrő-sávban lévő dedikált
**WSJT-X** kapcsolóval kapcsolhatod (csak akkor jelenik meg, ha a feed
engedélyezett).

## Szűrés

A gyorsszűrő-sávban ([Spotok](spots.md)) lévő **skimmer** és **WSJT-X**
kapcsolók vezérlik, hogy ezek a szintetikus spotok megjelennek-e a
táblázatokban, a sávtérképen és a térképen.
