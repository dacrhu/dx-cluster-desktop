# Beállítások és nyelvek

Nyisd meg a **Kapcsolat → Beállítások** menüt. Minden blokk egy összecsukható
csoport; az egyik megnyitása a többit bezárja.

## Felület nyelve

Válassz **Rendszer**, **English**, **Magyar** vagy **Deutsch** közül. A
„Rendszer” az OS felületi nyelvét követi (az OS-en keresztül észlelve, nem a
böngészőn, mert az Linuxon megbízhatatlan).

> Nyelvváltás után **erősen ajánlott az újraindítás** — néhány szöveg csak a
> következő indításkor frissül.

Másik nyelvet szeretnél? Lásd
[TRANSLATING.md](https://github.com/dacrhu/dx-cluster-desktop/blob/main/TRANSLATING.md)
— nincs szükség programozásra, szövegfájlokat szerkesztesz a GitHubon.

## Az állomásod

A **Maidenhead-lokátorod**. Működteti az antennairányokat, az azimutális
térképet, a távolsági gyűrűket és a „rólam szóló jelentések” réteget. Állítsd be
egyszer.

## Referenciaadatok

- **DXCC országfájl (`cty.dat`)** — hívójel → DXCC / zónák / kontinens /
  koordináták. Hetente automatikusan frissül feltételes letöltéssel. Állapot +
  „ellenőrzés most” itt. Forrás:
  [country-files.com](https://www.country-files.com/).
- **Cluster-presetek** — a preset-böngésző mögötti ~730 node-os lista.
  Ugyanaz az auto-frissítési minta. Forrás:
  [dxcluster.info](https://dxcluster.info/).

## Feedek

- **PSK Reporter** — engedélyezés + figyelt hívójelek. Lásd
  [További spot-források](extra-feeds.md).
- **WSJT-X** — engedélyezés + bind-cím + mutatás/elrejtés kapcsoló.
- **Mail** — mail-figyelés ki/be (10 perces directory-lekérdezés + értesítés).

## Rádióvezérlés (CAT) és log-push

Lásd [Rádióvezérlés és naplózás](rig-and-logging.md).

## Hol laknak a beállítások

- Nem titkos beállítások: `settings.json` a program adatkönyvtárában.
- Kapcsolati profilok: a Tauri store.
- Cluster-jelszavak: az **OS kulcstartód** — soha nem íródik lemezre nyílt
  szövegben.
- Spot-előzmények, mail-törzsek, talk/chat-előzmények: egy helyi SQLite
  adatbázis.
- Riasztási találatok és a térkép / sávtérkép / forgalom nézetállapot: külön
  megőrizve, így túlélik az újraindítást.

## Felső sáv gyorsbeállítások

- **Max. életkor (perc)** — a mindenhol ennél régebbi spotokat elrejti
  (0/∞ = ki).
- **Küldési célpont** — akkor jelenik meg, ha >1 parancsképes node van online;
  megadja, melyik node kapja a feladott spotjaidat, mailjeidet, talkjaidat és
  lekérdezéseidet.
