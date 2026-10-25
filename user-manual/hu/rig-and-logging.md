# Rádióvezérlés és naplózás

Két opcionális kapcsolat alakít egy spotot QSO-vá. Mindkettő alapból kikapcsolt,
a **Kapcsolat → Beállítások** menüben él, és **nem** cluster-transzport — ezek
egy helyi hardverkapcsolat és egy egyirányú tipp a naplóprogramodnak.

## Rádióvezérlés (CAT)

A DX Cluster Desktop a rádióddal a [Hamlib](https://hamlib.github.io/)
**`rigctld`**-jén keresztül beszél. A **`rigctld` nincs csomagolva** — telepítsd
magad a Hamlibet:

- **Linux** — `sudo dnf install hamlib` / `sudo apt install libhamlib-utils`.
- **macOS** — `brew install hamlib`.
- **Windows** — töltsd le a Hamlibet, és tedd a `bin`-jét a `PATH`-odra.

Majd a **Beállítások → Rádióvezérlés (CAT)** menüben:

| Transzport  | Beállítás                                                                                                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hálózat** | Te futtatod a `rigctld`-t magad (vagy egy másik gépen fut). Add meg a hostját és portját (alapból `127.0.0.1:4532`).                                                                                            |
| **Soros**   | A program elindítja és felügyeli a saját `rigctld`-jét. Válaszd ki a rádió **modelljét** (lista a `rigctl -l`-ből, vagy egy csomagolt pillanatkép, ha nincs Hamlib), a **soros eszközt** és a **baud rate**-et. |

Egyéb opciók:

- **VFO lekérdezése** — a rádió olvasása ~másodpercenként; az élő frekvencia/mód
  a felső sáv **CAT-címkéjén** látszik, és vezérli a Sávtérkép kurzorát.
- **Követés** — a Spotok táblázatot a VFO-hoz legközelebbi sorra görgeti.
- **Digitális mód** — `none` / `USB` / `data`: melyik oldalsávot/módot állítja
  be a program a DIGI-spotokhoz (`PKTUSB` kontra sima `USB`).

### Ráhangolás egy spotra

Egy spot [buborékjából](spots.md):

- **Rádió hangolása** — frekvencia és (általában) mód beállítása a spotra.
- **Split — TX itt: …** — akkor jelenik meg, ha a megjegyzésben dolgozható
  QSX/split van (`QSX 14195`, `UP 2`, `up1.5`…). RX-et a spotra, TX-et a QSX-re
  állít. Egy sima _Rádió hangolása_ utána automatikusan törli a splitet.

### A spot-feladás követi a VFO-t

Amíg a CAT csatlakoztatva van, a „spot feladása” frekvenciamezője a VFO-t
tükrözi, amíg bele nem gépelsz; egy **VFO** címke visszaugratja.

## Átadás a naplóprogramnak („QSO előkészítése”)

A **QSO előkészítése** egy egyszeri UDP-datagramot küld a naplóprogramodnak,
hogy a beviteli ablaka előre kitöltődjön. **Soha nem ment QSO-t** — azt
továbbra is a programodban naplózod.

| Formátum   | Ehhez                                                                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WSJT-X** | QLog, JTAlert, GridTracker, Log4OM — egy WSJT-X Status üzenet hívójellel/griddel/frekvenciával/móddal. (Ezek a naplók a „Time On”-t is ebből bélyegzik, ahogy valódi WSJT-X-nél teszik.) |
| **ADIF**   | Log4OM-stílusú figyelők — egy részleges `<CALL><FREQ><EOR>` rekord.                                                                                                                      |

Állítsd be a naplóprogram **hostját/portját** (alapból `127.0.0.1:2237`).
Opcionálisan engedélyezd a **naplóprogram ablakának előtérbe hozását**, és add
meg az ablakcímét vagy freedesktop app-id-jét — a program a rendszeredhez a
megfelelő módszert választja (D-Bus/`gapplication` Waylanden, `wmctrl`/`xdotool`
X11-en, `AppActivate` Windowson, `osascript` macOS-en).

## Utolsó QSO → spot feladása

Dolgoztál egy olyan állomással, ami nincs a clusterben? A spot-feladó űrlap
melletti **Utolsó QSO** gomb a naplóprogramod legutóbbi kapcsolatából tölti ki a
hívójelet és a frekvenciát, nem kell kézzel másolgatni. Két forrás (Beállítások
→ napló csoport):

- **ADIF fájl** — add meg a naplód ADIF fájljának útvonalát; a gomb minden
  kattintáskor az utolsó rekordot olvassa.
- **UDP a naplóprogramtól** — ha az útvonal üres, az app megjegyzi a naplózód
  által küldött utolsó QSO-t: WSJT-X / JTDX „QSO Logged” üzenet, vagy ADIF
  datagram Log4OM vagy GridTracker felől, illetve a QLog _Settings → Network → QSO Changes_ értesítése. Ez a WSJT-X feed címén hallgat,
  ezért kapcsold be azt a feedet, és a naplózót irányítsd rá.

A megjegyzés mindig `CQ <mód>[/<almód>]` (almód csak akkor, ha a napló megadja) — a napló saját megjegyzését szándékosan soha nem másolja át.

A gomb csak előtölti az űrlapot; a **Küldés** gombot továbbra is te nyomod meg.

### Példa: QLog

A QLog _Settings → Network → Wsjtx_ lapja csak azt állítja, hogyan **fogadja** a
QLog a WSJT-X-et — nekünk semmit nem küld. A naplózott QSO-k átadásához:

1. Itt: kapcsold be a WSJT-X feedet (Kapcsolat → Beállítások) egy **multicast**
   címmel, pl. `239.255.0.1:2237` (lásd: [További spot-források](extra-feeds.md)).
2. A QLogban: _Settings → Network → QSO Changes_ → ugyanerre a címre és portra
   küldjön.
3. Naplózz egy QSO-t a QLogban, majd nyomd meg az **Utolsó QSO** gombot.

Multicast címmel minden program saját másolatot kap, így a QLog, a WSJT-X és ez
az app nem verekszik a portért. A QLog a mentett QSO-t JSON-ba csomagolt ADIF-ként
küldi; a törléseket figyelmen kívül hagyjuk.

## Teszt gombok

Mindkét szakaszban van egy **Teszt** gomb — egy CAT oda-vissza olvasás, vagy egy
minta log-push datagram — így valódi spot nélkül ellenőrizheted a bekötést.
