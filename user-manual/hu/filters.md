# Spot-szűrők

A **Szűrők** panel újrafelhasználható szűrőszabályokat épít. Minden szabály egy
összecsukható kártya: a fejben egy engedélyező jelölőnégyzet, a címkéje és egy
egysoros összefoglaló; a törzs a szerkesztő.

A szabályok ugyanazt az **akkordeont** használják, mint a Riasztások panel —
egyszerre egy kártya nyitva, alapból mind összecsukva.

## Helyi kontra node-oldali

Minden szabálynak van egy **hatóköre**:

- **Csak helyi** (az alapértelmezés) — a szabály a programban látott spotokat
  szűri. Semmi nem megy a clusterhez. Ez szinte mindig a helyes választás:
  azonnali, visszafordítható, és nem érinti a többi klienst.
- **Node-ra küldés** — ezenfelül megmutatja a generált cluster-parancsot és egy
  **Alkalmaz** gombot, így maga a node hagyja abba a nem illeszkedő spotok
  küldését.

## Feltételek

A feltételek szimmetrikusak a **DX**-oldal és a **spotter**-oldal között:

| Feltétel             | DX-oldal       | Spotter-oldal  |
| -------------------- | -------------- | -------------- |
| Kontinenscímkék      | ✓ (csak helyi) | ✓ (csak helyi) |
| DXCC                 | ✓              | ✓              |
| CQ-zóna              | ✓              | ✓              |
| Hívójel-prefix (CSV) | ✓              | ✓              |
| Mód / skimmer        | csak helyi     | —              |

> **A CQ-zóna megkülönböztetés számít.** A „DX CQ-zóna = Európa” még mindig
> átenged egy európai DX-et, amelyet egy amerikai skimmer spotolt. Hogy azt is
> korlátozd, ki jelentette, állítsd be a **spotter-kontinenseket** vagy a
> **spotter CQ-zónákat**.

Hozzáadható egy **haladó lekérdezés** mező (a [keresőnyelv](search-query.md)),
amely ÉS-kapcsolatban van a strukturált feltételekkel.

## Node-dialektusok

A generált parancs a célnode **Szoftver** beállítását követi
(lásd [Csatlakozás cluster­ekhez](connections.md)):

- **DXSpider** — `accept/spot` / `reject/spot` számozott slotokkal.
- **AR-Cluster** — egyetlen `set/dx/filter` kifejezés (egy aktív szűrő
  munkamenetenként; egy _Reject_ szabályból `not (...)` lesz).

A parancs-előnézet mindig elérhető, akkor is, ha nincs node csatlakoztatva.

## Node-szűrők törlése

A **Node-szűrők törlése** eltávolítja a feltöltött szabályokat a node-ról —
`clear/spot all` DXSpideren, egy üres `set/dx/filter` AR-Clusteren. A
**Node-szűrők lekérése** lehívja, mi van jelenleg a node-on (`show/dx options`
AR-Clusteren).

A node-viselkedés változó; ha kétséges, tartsd a szűrőket **helyben**.
