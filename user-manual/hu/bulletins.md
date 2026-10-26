# Hirdetmények, WWV/WCY és WX

## Hirdetmények

A **Hirdetmények** fül a cluster-hirdetményeket listázza (`To ALL` üzenetek,
node-értesítések, DXpedíció-bulletinek). A keresőmező szóközzel elválasztott
**bevonó** / **`-kizáró`** kifejezéseket vár, a küldő, a célpont és a szöveg
ellen illesztve — tehát a `-telnet` elrejti a telnetet említő sorokat, a
`dxpedition -test` a valódi bulletinekre szűkít.

### Spamszűrő

A cluster node-ok szeretik újra és újra reklámozni magukat. Három réteg tartja
távol ezt a listából (az adat csak el van rejtve, nem törlődik):

- **Cluster-node hirdetések elrejtése** (alapból be) — felismeri a node-ot
  hirdető üzeneteket (`telnet …`, `host:port`, IP-cím, vagy a „cluster" /
  „DXSpider" szó webcímmel együtt).
- **Ismétlések összevonása (×N)** (alapból be) — ugyanaz a szöveg ugyanattól az
  állomástól egyszer jelenik meg `×N` jelvénnyel; fölé víve látszik minden
  feladási idő. Az összehasonlításnál a node-ok által hozzáfűzött dátum/idő
  (`26-Oct-2026 2100Z`) nem számít.
- **Kézi némítás** — vidd az egeret egy sor fölé, és kattints a **⊘**-ra: az
  üzenet és minden hasonlója (bármely feladótól) rejtve lesz; a **⊘⊘** az adott
  állomás mindent elrejti (minden SSID). A némítások megmaradnak. A **Némítva:
  N ▾** felsorolja őket, innen törölhetők; az **Elrejtettek mutatása (N)** a
  kiszűrt sorokat halványan mutatja.

Az elrejtett és összevont ismétlések nem gyújtják fel a fül aktivitás-pontját.

A történeti hirdetmények a node-ról importálhatók a `SH/ANN` paranccsal.

## Terjedés (WWV / WCY)

A **Terjedés** fül a nap-földi számokat mutatja:

- **WWV** — SFI, A-index, K-index és egy rövid előrejelzés, ahogy sugározzák.
- **WCY** — a DK0WCY bulletin: SFI, A, K, várható K, napszél, Bz,
  aurora-aktivitás, geomágneses tér.

Mindkettő **aktuális statisztikacsempeként** plusz egy **előzménytáblázatként**
jelenik meg. Egy keresőmező a két táblázat fölött szűri őket (bevonó /
`-kizáró`, a nyers mezők ellen illesztve).

A WCY rövidítéskódjai (`qui`, `act`, `maj`, `no`, `yes`…) **dekódolva** vannak a
csempe- és cellaszövegben; a nyers kód a buborékban van.

A csempék alatt a **Sáv-előrejelzés a célhoz** egy VOACAP-stílusú rácsot ad:
válassz célországot, és minden sávra (10–80 m) és minden UTC órára látod, mekkora
eséllyel nyitott az út a QTH-dtól (piros = zárt, zöld = megbízható), alatta
TX / MP / RX sávokkal, amelyek a nappalt mutatják a QTH-nál, az útvonal
felezőpontján és a célnál. Rövid / hosszú út váltható; az aktuális óra alá van
húzva. Ez **becslés** (napfoltszám-alapú MUF-modell + D-réteg elnyelés), nem
VOACAP-futtatás — nincs antenna, teljesítmény, zaj vagy sporadikus E. Szükséges
hozzá a QTH-lokátorod.

Ezek a számok a térkép [Feltétel-HUD-ját és MUF-rétegét](map.md) is táplálják.

## WX (időjárás)

A clusterre feladott időjárási bulletinek a Hirdetmények folyamban jelennek meg
(WX-sorokként megjelölve). Magad is **feladhatsz egy WX-bulletint** a
Hirdetmények panelről — a [küldési célpont](settings.md) node-odhoz megy.

## Aktivitáspöttyök

A Hirdetmények és a Terjedés fül felgyújtja az aktivitáspöttyét, amikor egy új
bulletin érkezik, miközben máshol vagy. Az induláskor kapott adat nem számít
„újnak”.
