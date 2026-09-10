# Hirdetmények, WWV/WCY és WX

## Hirdetmények

A **Hirdetmények** fül a cluster-hirdetményeket listázza (`To ALL` üzenetek,
node-értesítések, DXpedíció-bulletinek). A keresőmező szóközzel elválasztott
**bevonó** / **`-kizáró`** kifejezéseket vár, a küldő, a célpont és a szöveg
ellen illesztve — tehát a `-telnet` elrejti a telnetet említő sorokat, a
`dxpedition -test` a valódi bulletinekre szűkít.

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

Ezek a számok a térkép [Feltétel-HUD-ját és MUF-rétegét](map.md) is táplálják.

## WX (időjárás)

A clusterre feladott időjárási bulletinek a Hirdetmények folyamban jelennek meg
(WX-sorokként megjelölve). Magad is **feladhatsz egy WX-bulletint** a
Hirdetmények panelről — a [küldési célpont](settings.md) node-odhoz megy.

## Aktivitáspöttyök

A Hirdetmények és a Terjedés fül felgyújtja az aktivitáspöttyét, amikor egy új
bulletin érkezik, miközben máshol vagy. Az induláskor kapott adat nem számít
„újnak”.
