# Csatlakozás cluster­ekhez

A **Kapcsolat** panelnek két nézete van, a fejlécében lévő kapcsolóval
válthatsz köztük: **Kapcsolatok** (profilok és a preset-böngésző) és
**Beállítások** (minden más). Ez az oldal a Kapcsolatokkal foglalkozik.

## Kapcsolati profilok

Egy profil egy elmentett cluster-belépés. Kattints a **+ Hozzáadás** gombra egy
új létrehozásához, vagy kattints egy listabeli profilra a szerkesztéséhez.

| Mező             | Jelentés                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------- |
| Név              | Címke a listához — szabad szöveg.                                                            |
| Host / Port      | A node Telnet-címe, pl. `hg8lxl.ham.hu` / `7300`.                                            |
| Hívójel          | A belépési hívójeled.                                                                        |
| Jelszó           | Csak ha a node megköveteli. Futásidőben az OS kulcstartójában tárolódik.                     |
| Típus            | **Cluster** (normál DX cluster) vagy **RBN feed** — lásd lentebb.                            |
| Szoftver         | **DXSpider** vagy **AR-Cluster** — a parancsdialektust választja ki. Lásd lentebb.           |
| Skimmer spotok   | Node alapértelmezés / bekapcsolás kérése / kikapcsolás kérése — csak DXSpider. Lásd lentebb. |
| Auto-csatlakozás | Ez a profil automatikusan csatlakozzon induláskor.                                           |

Egyszerre több profil is csatlakoztatható. Az összesük spotjai összefésülődnek
és deduplikálódnak (90 másodperces ablak hívójel + frekvencia + spotter alapján).

## A preset-böngésző

Profil hozzáadásakor nyisd ki a **preset-böngészőt**, hogy ~730 nyilvános
node közül válassz. Válassz egy **országot** (kontinensenként csoportosítva),
majd egy node-ot — rákattintva kitölti a hostot, portot és nevet, és megtippeli
a szoftvertípust. Minden node országa a hívójeléből van feloldva.

A preset-lista hetente automatikusan frissül. Az állapota és egy kézi „ellenőrzés
most” gomb a **Beállítások → Cluster-presetek** menüben található. Forrás:
[dxcluster.info](https://dxcluster.info/), engedéllyel használva.

## RBN feed profilok

Kattints a **+ RBN feed** gombra, hogy előre kitölts egy profilt a Reverse Beacon
Networkhöz (`telnet.reversebeacon.net:7000` CW/RTTY-hez, `7001` FT8/FT4-hez). Az
RBN feed egy parancs nélküli skimmer-tűzcsóva, ezért a kliens:

- **csak** a **te** hívójeled spotjait tartja meg,
- soha nem írja őket a helyi adatbázisba (újraindításkor eltűnnek),
- a térkép „rólam szóló jelentések” rétegébe irányítja őket.

Az RBN-profilok `RBN` címkét kapnak a listában, és nem lehetnek küldési célpont.

## DXSpider kontra AR-Cluster

A két gyakori node-típus a parancsszintaxisban tér el. Állítsd be helyesen a
**Szoftvert**, hogy a kliens a megfelelő parancsokat generálja ehhez:

- **Spot-szűrők** — DXSpider `accept/reject spot` kontra AR-Cluster
  `set/dx/filter`. Lásd [Spot-szűrők](filters.md).
- **`SH/DX` előzmények** — pozicionális DXSpider-forma kontra AR-Cluster
  `field=value` forma. Lásd [Eszközök és node-lekérdezések](tools.md).

A spot-, WWV-, WCY- és hirdetmény-elemzés mindkettőnél közös. Ha bizonytalan
vagy, a DXSpider a biztonságos alapértelmezés, és messze a leggyakoribb.

## Skimmer spotok

Sok DXSpider node-on az RBN-től érkező skimmer spotokat vagy külön be kell
kapcsolni, vagy alapból küldi őket és neked kell kikapcsolnod. A profil
**Skimmer spotok** mezője (csak DXSpider) minden bejelentkezés után
automatikusan elküldi a `SET/SKIMMER` vagy `UNSET/SKIMMER` parancsot — egyszer
állítod be, nem kell a parancsot minden alkalommal kézzel begépelned. Amíg az
adott profil online, egy **Küldés most** gomb is megjelenik mellette, amivel a
változtatás azonnal, újracsatlakozás nélkül érvénybe lép.

A node nem küldi vissza az aktuális skimmer-állapotát, ezért ez egy egyszeri,
visszaigazolás nélküli beállítás, nem élő állapotkijelzés.

## Kapcsolati állapot

Minden profil megmutatja az állapotát: _leválasztva_, _csatlakozás_,
_bejelentkezés_, _online_ vagy egy hiba. A bejelentkezési állapotgép mind a
`login:` promptot küldő, mind az azonnal streamelni kezdő node-okat kezeli. A
hibák (köztük a „máshol már be vagy jelentkezve”) a helyszínen és a
[nyers terminálban](raw-terminal.md) is megjelennek.
