# A nyers terminál

A **Nyers terminál** fül (a _Haladó_ csoportban) a haladó felhasználók
vészkijárata: a node szűretlen sorfolyama, és egy mező nyers cluster-parancsok
begépeléséhez.

Ritkán lesz rá szükséged — minden cluster-funkciónak van GUI-megfelelője —, de
hasznos ehhez:

- pontosan látni, mit küldött egy node (egy parser-szélső eset hibakeresése),
- egy homályos parancs futtatása, amelyet az Eszközök panel nem listáz,
- a bejelentkezési kézfogás figyelése.

## Viselkedés

- **Auto-követés** — az új kimenet **csak akkor** görög a nézetbe, amíg **alul
  vagy**. Görgess felfelé az olvasáshoz, és megáll; egy **„↓ N”** címke folytatja.
- Az általad begépelt kimenő sorok egy `>` jelölővel visszahangzanak; a
  node-sorok és a hibák úgy jelennek meg, ahogy érkeznek.
- A parancsmező a jelenleg kiválasztott [küldési célpont](settings.md) node-nak
  küld.

## Egy szó a figyelmeztetésre

A nyers parancsok megkerülik a program biztonsági hálóit (a nem-ASCII
mail-figyelmeztetés, a `/EX` kitöltés a mail-szerkesztőben, a dialektus-helyes
szűrőszintaxis). Ha kézzel tolsz fel egy node-oldali szűrőt, a Szűrők panel nem
fog tudni róla.
