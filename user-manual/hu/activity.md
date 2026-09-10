# A forgalmi mátrix

A **Forgalom** fül egy olyan kérdésre válaszol, amelyre a spot-táblázat nem
tud: _melyik sáv erősödik, és merre?_ Beolvassa a spot-folyamot, sáv és a
DX-állomás kontinense szerint bontja, és megmutatja a **trendet** — egy
15 perces mozgóátlagot az azt megelőző 15 perchez képest.

Egy pillantással láthatod például, hogy a 40 m nyílik Európa felé, miközben a
15 m Észak-Amerika felé halványul.

## A „legnagyobb mozgók” sáv

Két sor a tetején — **Erősödő** és **Gyengülő** — mindegyik legfeljebb három
`sáv → kontinens` párt sorol fel, aszerint rangsorolva, mennyit mozogtak:

- `40m → EU  ▲▲ +180%` — az elmúlt 15 percben nagyjából 2,8-szer annyi 40 m-es
  spot volt európai DX-re, mint az azt megelőző 15 percben.
- `▲▲` / `▼▼` = erős mozgás (±100 % vagy több); `▲` / `▼` = enyhébb (±25 %).
- **new** a százalék helyett azt jelenti, hogy a sáv egy pillanattal ezelőtt
  csendes volt abban az irányban, és éppen most kelt életre.

Ha semmi nem mozog egyértelműen, a sáv egyetlen semleges sort mutat helyette.

Kattints bármelyik mozgóra, hogy a **Spotok** fülre ugorj, arra a sávra és
irányra szűrve.

## A mátrix

A sorok a sávok, az oszlopok a DX-állomás kontinense. Az oszlopfejléc mutatja a
kontinenst, az általános trendnyilát és a teljes spotszámát az elmúlt két órára.

Minden cella tartalmaz:

- egy **sparkline**-t az elmúlt két óráról 15 perces vödrökben,
- egy **fénylést**, amelynek fényereje a cella teljes forgalmát követi (egy
  forgalmas cella akkor is kitűnik, ha a trendje lapos),
- egy **jelvényt** — `▲▲ ▲ – ▼ ▼▼` és a százalékos változás. A zöld erősödik, a
  piros gyengül, egy tompa `–` állandó.

Egy üres cella (halvány `·`) azt jelenti, hogy nincs spot azon a sávon az adott
kontinens felé az ablakban.

A rács kitölti a panelt: kevés sávnál a sorok nőnek, és a sparkline-ok nagyok
lesznek; sok sávnál a sorok egy fix minimumra zsugorodnak, és a rács görgethető.
A sávok szűkítése (itt vagy a node-nál) jó módja a nagyobb ábráknak.

Kattints egy cellára, hogy a **Spotok** megnyíljon arra a sávra és irányra
szűrve.

## „Spotterek” — a trend hatókörének megadása

Ez a fontos vezérlő. A „40 m erősödik Észak-Amerika felé” **megtévesztő**, ha
minden skimmer, amely hallja Észak-Amerikát, maga is _Észak-Amerikában ül_ — a
saját állomásodról lehet, hogy semmit nem hallasz.

Ezért a mátrix először a spotokat azokra szűkíti, amelyeket egy **kiválasztott
kontinensen lévő spotter** készített, és csak ezután bontja aszerint, hol van a
DX. A **Spotterek** választó választja ki azt a kontinenst:

- **Auto** — a saját kontinensed, a QRA-lokátorodból kiszámítva (állítsd be a
  [Kapcsolat panelen](connections.md)). Ez az alapértelmezés és a leghasznosabb:
  megmutatja, mi dolgozható _innen_.
- **Egy konkrét kontinens** — nézd meg, mit hallanak mondjuk az észak-amerikai
  állomások.
- **Bárhol** — nincs spotter-szűrő; minden spot számít.

QRA-lokátor nélkül az Auto visszavált _Bárhol_-ra, és a panel ezt közli.

## Szűrők és ablakok

- A gyorsszűrő-sáv (keresés, skimmer / WSJT-X kapcsolók, sáv- és módcímkék)
  **közös a Spotokkal, a Sávtérképpel és a Térképpel**. A `mode:cw`-re szűkítés
  például CW-only trendet ad.
- Az ablakok fixek: egy **15 perces** mozgóátlag és egy **2 órás** sparkline-előzmény.
  Szándékosan **függetlenek a felső sáv „max. életkor”** beállításától — a
  panelnek mindig a teljes kétórás előzményre szüksége van.
- Minden mért adat a spot-feedből egy rövid ablakon át — a lendület becslése,
  nem terjedési előrejelzés.
