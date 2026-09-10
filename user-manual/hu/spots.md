# A spot-táblázat

A **Spotok** fül a program szíve: minden beérkezett DX-spot gyors, virtualizált
táblázata, legfrissebb felül.

## Oszlopok

- **Életkor** — mennyi ideje érkezett a spot, folyamatosan frissül.
- **Frekvencia** és **Sáv**.
- **DX** — a spotolt állomás, a DXCC-egységével, CQ-zónájával és a lokátorodhoz
  viszonyított antennairánnyal (részletekért vidd fölé az egeret).
- **Spotter** — ki jelentette, a DXCC-jével.
- **Mód** — CW / SSB / DIGI / FM, színkódolva. A címke a konkrét almódot mutatja
  (FT8, RTTY, SSTV…), amikor a megjegyzés elárulja.
- **Megjegyzés** — a spotter jegyzete (QSX, RST, „up 2” stb.).

Az engedélyezett riasztásra illeszkedő sorok színezettek. Ha a rádióvezérlés be
van kapcsolva, a VFO-dhoz legközelebbi sor kiemelve jelenik meg.

## Gyorsszűrők

A táblázat feletti sáv **közös a Sávtérképpel és a Térképpel**:

- **Keresőmező** — a [keresőnyelv](search-query.md), egy **?** buborékkal, amely
  dokumentálja.
- **Skimmer** és **WSJT-X** kapcsolók — e spot-források mutatása/elrejtése.
- **Sávcímkék** és **Módcímkék** — kattints a bevonáshoz; üres = „mind”. A
  sávlista a feedben ténylegesen jelen lévő sávokból épül fel.

A szűrés azonnali és helyi — soha nem változtatja meg, mit küld a node. A
node-oldali szűréshez lásd [Spot-szűrők](filters.md).

## Fagyasztás görgetéskor

Görgess lefelé, és a táblázat **lefagyaszt** egy pillanatképet, hogy a beérkező
spotok ne mozdítsák el, amit épp olvasol. Egy címke a tetején („↓ N új”)
visszaugrik az élő tetejére. A keresés megváltoztatása automatikusan feloldja a
fagyasztást.

## Bal klikk: a spot-buborék

Kattints egy spotra egy tömör adatkártya megnyitásához, amely tartalmazza a
frekvenciát/sávot, módot, DXCC-t, spottert, irányt, életkort és megjegyzést,
plusz műveleti gombokat:

- **Rádió hangolása** — a rádiód a spotra állítása (kell hozzá [CAT](rig-and-logging.md)).
- **Split — TX itt: …** — csak akkor jelenik meg, ha a megjegyzésben QSX/split
  észlelhető.
- **QSO előkészítése** — a spot átadása a naplóprogramodnak (kell hozzá
  [log-push](rig-and-logging.md)).
- A közös **műveleti menü** (lásd lentebb).

## Jobb klikk: a műveleti menü

- **Talk a DX-szel / spotterrel** — a Talk fülre ugrik azzal a hívójellel.
- **Feladás előkészítése** — előre kitölti az alábbi „spot feladása” űrlapot
  ezzel a frekvenciával és hívójellel.
- Másolási segédek.

## Spot feladása

Az alján lévő **spot feladása** űrlap egy frekvenciát, egy hívójelet és egy
opcionális megjegyzést vár, majd egy helyesen formázott `DX` parancsot küld a
[küldési célpont](settings.md) node-odnak. Ha a CAT csatlakoztatva van, a
frekvenciamező a VFO-dat követi, amíg bele nem gépelsz; egy **VFO** címke
visszaugratja.

## Új-aktivitás pötty

A Spotok fül aktivitáspöttyöt mutat, amikor a jelenlegi keresésedre illeszkedő
spot érkezik, miközben egy másik fülön vagy.
