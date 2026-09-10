# A sávtérkép

A **Sávtérkép** sávonként egy görgethető függőleges sávot mutat, benne az
állomások frekvencia szerint elrendezve — a klasszikus „bandmap” nézet,
teljes egészében a spot-feedből vezérelve.

## Egy sáv olvasása

- **Állomásonként egy sor.** Az azonos hívójel spotjai ~0,5 kHz-en belül
  egyetlen jelölővé olvadnak össze, amely a legfrissebb spotot és egy **×N**
  jelvényt mutat (vidd fölé az egeret a spotterek listájáért). Egy sok skimmer
  által vert állomás egy sor, nem nyolc.
- A **frekvenciatengely nemlineáris**: a sorok sűrűség szerint vannak
  becsomagolva, és minden sor kiírja a pontos frekvenciáját a bal oldali
  margóra. A **sávterv-árnyékolás** (CW / DIGI / SSB) a sorokat követve nyúlik.
  Egy üres sáv egyszerű lineáris skálára vált vissza MHz-jelölésekkel.
- Az **életkor-halványítás** tompítja a régebbi spotokat; a **riasztás-színezés**
  jelöli az engedélyezett riasztásra illeszkedő állomást.
- Egy **módpötty** (szöveg nélkül) a kategória szerint színezett; a buborékban
  ott az almód.

## Szűrés és nagyítás

A gyorsszűrő-sáv (keresés, skimmer/WSJT-X kapcsolók, sáv- és módcímkék) **közös
a Spotokkal és a Térképpel** — lásd [A spot-táblázat](spots.md) és
[a keresőnyelv](search-query.md). A megjelenített sávok egyszerűen a szűrt
spotokban jelen lévő sávok.

**Függőleges nagyítás**: `Ctrl` + egérgörgő, vagy a csúszka. Az `1` a nézetablakhoz
illeszt; a magasabb érték a sáv magasságát és a jelölő betűméretét skálázza. A
beállítás megjegyződik.

## Speciális referenciajelölők

Két statikus, csak frontendes jelölőkészlet van berajzolva minden sávba
félmagasságú sorokként:

- **SOS** (piros) — az IARU 1. körzet „globális vészhelyzeti” szimplex
  frekvenciái (3760 / 7060 / 14300 / 18160 / 21360 / 24960 / 28560 kHz). Ezek egy
  udvariassági hívó-/koordinációs pont a katasztrófa-forgalomhoz, **nem**
  hivatalos vészfrekvencia.
- **IBP** (kék) — az NCDXF/IARU International Beacon Project öt frekvenciája
  (14100 / 18110 / 21150 / 24930 / 28200 kHz).

Kattints egyikre egy minimális felbukkanóért egy **Rádió hangolása** gombbal
(elrejtve, ha a CAT ki van kapcsolva). A panel tetején van egy jelmagyarázat-sáv.

## Interakció

- **Bal klikk** egy állomáson → a spot-buborék (hangolás / split / QSO előkészítése / műveletek).
- **Jobb klikk** egy állomáson → a műveleti menü.
- Lásd [A spot-táblázat](spots.md), hogy ezek mit csinálnak.

## Rádióvezérléssel

Amikor a [CAT](rig-and-logging.md) csatlakoztatva van, a Sávtérkép ezt adja hozzá:

- egy **kurzorvonal** a VFO-dnál; az azt tartalmazó sáv kiemelve, a többi
  elhalványul,
- a VFO-tól ~0,5 kHz-en belüli spot bekarikázva,
- az aktív sáv **automatikusan görget, hogy a VFO-t középen tartsa**. Egy kézi
  görgetés ezt szünetelteti (és lefagyasztja a sávot); a sáv fejlécében lévő
  **⌖** gomb, vagy a sávváltás folytatja,
- **egy másik sáv fejlécére kattintva a rádió arra a sávra QSY-zik** (a középső
  spot frekvenciája, vagy `alsó él + 20 kHz`, ha a sáv üres). Csak frekvencia —
  nincs módváltás.
