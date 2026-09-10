# Eszközök és node-lekérdezések

Az **Eszközök** panel cluster `SHOW` lekérdezéseket futtat, és megjeleníti az
eredményeket — nyersen, ahol nincs struktúra, formázva, ahol van.

## SH/DX — spot-előzmények

Egy strukturált történeti spot-keresés. Töltsd ki bármelyiket: darabszám, sáv,
hívójel, spotter, hány óra visszamenőleg. A panel megmutatja a pontos parancsot,
amelyet küldeni fog (ez node-dialektusonként eltér — pozicionális DXSpideren,
`field=value` AR-Clusteren), így a gomb és a parancs mindig egyezik.

Az eredmények táblázatként jelennek meg, ugyanazzal a mód-színezéssel, mint az
élő Spotok táblázat. Ha a node-nak nincs előzménye, ugyanezt a keresést
**offline is futtathatod** a helyi spot-adatbázis ellen.

## Általános sh/* lekérdezések

Gyakori lekérdezések legördülő listája, mindegyik a hozzá szükséges argumentummal:

| Parancs                                | Használat                                    |
| -------------------------------------- | -------------------------------------------- |
| `sh/prefix`                            | DXCC / zóna infó egy prefixhez               |
| `sh/heading`                           | antennairány egy hívójelhez/prefixhez        |
| `sh/qra`                               | távolság/irány két lokátor között            |
| `sh/sun`, `sh/moon`                    | napkelte/napnyugta, holdadatok               |
| `sh/muf`                               | a node MUF-becslése egy lokátorhoz           |
| `sh/dxcc`                              | friss spotok egy DXCC-hez                    |
| `sh/dxqsl`, `sh/db0sdx`, `sh/ik3qar`   | QSL-útvonal adatbázisok                      |
| `sh/route`                             | hogyan érhető el egy állomás a cluster-hálón |
| `sh/dxstats`, `sh/configuration/nodes` | node-statisztikák                            |

Bármit, amit a node nem ismer fel, „ezen a node-on nem támogatott”-ként jelez.

## Amikor nincs node

Az offline `SH/DX` a helyi adatbázisból továbbra is működik. A többi `sh/*`
lekérdezéshez élő node kell — ezek átmenő parancsok.
