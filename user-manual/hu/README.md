# DX Cluster Desktop — Felhasználói útmutató

Üdvözlünk! Ez az útmutató a DX Cluster Desktop minden részét bemutatja. A program
egy barátságos asztali kliens rádióamatőr **DX cluster**ekhez, Telneten
keresztül. Soha nem kell nyers cluster-parancsokat begépelned — mindent
táblázatokból, kattintható sorokból és űrlapokból lehet vezérelni.

Ezeket az oldalakat **a programon belül** (a _Súgó_ fülön) és itt, a GitHubon is
elolvashatod. A programon belül minden oldal a GitHubról töltődik le, amikor
online vagy, offline állapotban pedig a kiadásba csomagolt másolatra vált.

## Tartalom

1. [Első lépések](getting-started.md) — telepítés, első indítás, a főablak
2. [Csatlakozás cluster­ekhez](connections.md) — profilok, a preset-böngésző, DXSpider kontra AR-Cluster
3. [A spot-táblázat](spots.md) — spotok olvasása, gyorsszűrők, spot feladása, a rádió ráhangolása
4. [A keresőnyelv](search-query.md) — `dx:` `by:` `band:` `re:` és társaik
5. [A sávtérkép](bandmap.md) — sávonkénti sávok, a sávterv, SOS/IBP jelölők
6. [A világtérkép](map.md) — vetületek, terjedési rétegek, MUF, „ki hall engem”
7. [A forgalmi mátrix](activity.md) — melyik sáv erősödik vagy gyengül, kontinensenként
8. [Spot-szűrők](filters.md) — helyi szűrés és node-oldali szűrők
9. [Riasztások](alerts.md) — figyelőlisták, asztali értesítések, a találati napló
10. [Hirdetmények, WWV/WCY és WX](bulletins.md) — a bulletin- és terjedési feedek
11. [Talk, chat, mail és felhasználók](messaging.md) — minden beszélgetős funkció
12. [Eszközök és node-lekérdezések](tools.md) — `sh/dx` előzmények és általános `sh/*` lekérdezések
13. [További spot-források](extra-feeds.md) — RBN, PSK Reporter és WSJT-X
14. [Rádióvezérlés és naplózás](rig-and-logging.md) — CAT a rigctld-n át, átadás a naplóprogramnak
15. [Beállítások és nyelvek](settings.md) — minden beállítás, és hogyan válts nyelvet
16. [A nyers terminál](raw-terminal.md) — a haladó felhasználók konzolja
17. [Hibaelhárítás](troubleshooting.md) — gyakori problémák és megoldásaik

## Egy szó a hatókörről

A kliens a cluster-forgalomhoz — spotok, parancsok, mail, chat — **kizárólag
Telnetet** használ. Néhány opcionális, csak olvasható feed (RBN, PSK Reporter,
WSJT-X) és referenciaadat-letöltés ettől külön áll, és az útmutatóban végig
egyértelműen meg van jelölve.

A `rigctld` (a [Hamlib](https://hamlib.github.io/) része) **nem** a program
része. Ha CAT-vezérlést szeretnél, telepítsd külön — lásd
[Rádióvezérlés és naplózás](rig-and-logging.md).
