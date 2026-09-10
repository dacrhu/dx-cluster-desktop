# Első lépések

## Telepítés

Töltsd le a platformodhoz tartozó telepítőt a
[Kiadások oldaláról](https://github.com/dacrhu/dx-cluster-desktop/releases).
Minden build önálló — **nem** kell Rustot, Node-ot vagy bármilyen futtatókörnyezetet
telepítened.

| Platform              | Fájl                            | Megjegyzés                                                                                                                  |
| --------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Windows 10/11         | `.msi` vagy `.exe` (NSIS)       | A WebView2 a Windows 11 része; Windows 10 alatt automatikusan települ, ha hiányzik.                                         |
| macOS (Apple Silicon) | `aarch64` `.dmg`                | Húzd az Applications mappába. Első indítás: jobb klikk → _Megnyitás_, hogy megkerüld a Gatekeepert egy aláíratlan buildnél. |
| macOS (Intel)         | `x64` `.dmg`                    | Mint fent.                                                                                                                  |
| Linux                 | `.AppImage`, `.deb` vagy `.rpm` | Az AppImage hordozható — `chmod +x` és indítsd. A `.deb`/`.rpm` behúzza a WebKitGTK függőséget.                             |

Az egyetlen opcionális külső program a **`rigctld`** a rádióvezérléshez. Lásd
[Rádióvezérlés és naplózás](rig-and-logging.md).

## Első indítás

A program a **Kapcsolat** fülön nyílik meg, konfigurált profilok nélkül. Hogy
adásba kerülj:

1. Kattints a **+ Hozzáadás** gombra, és vagy töltsd ki kézzel egy cluster
   host/port/hívójel adatait, vagy nyisd meg a **preset-böngészőt**, és válassz
   egy nyilvános node-ot ország szerint. Lásd
   [Csatlakozás cluster­ekhez](connections.md).
2. Add meg a **hívójeled**, és ha a node kéri, egy jelszót (a jelszavak az
   operációs rendszer kulcstartójában tárolódnak, soha nem fájlban).
3. Mentsd el, majd kattints a **Csatlakozás** gombra.

Miután csatlakoztál, a **Spotok** fül megtelik élő spotokkal. Minden más — a
sávtérkép, a térkép, a riasztások, a mail — ugyanezen a kapcsolaton dolgozik.

## A főablak

A felső sávban:

- **A program címe** és egy kis **`v…` verziócímke** — kattints rá, hogy a
  _Súgó_ fülre ugorj.
- **Fülcsoportok**, cél szerint keretezve: _Kapcsolat_, _Spotolás_ (Spotok,
  Sávtérkép, Térkép, Szűrők, Riasztások), _Bulletinek_ (Hirdetmények, Terjedés),
  _Kommunikáció_ (Talk, Chat, Mail, Felhasználók), _Haladó_ (Eszközök, Nyers
  terminál) és _Súgó_.
- Egy színes **pötty a Kapcsolat fülön**: zöld = minden profil online, sárga =
  némelyik csatlakozik, piros = egy sincs fent.
- **Aktivitáspöttyök** a többi fülön, ha valami új érkezik, miközben máshol
  nézelődsz.
- Egy **CAT-címke** (ha a rádióvezérlés be van kapcsolva), amely az élő VFO-t
  mutatja.
- Egy **küldési célpont-választó** (csak ha egynél több parancsképes node van
  online), amely megadja, melyik node-hoz mennek a feladott spotjaid, a mailjeid
  és a lekérdezéseid.
- Egy **max. életkor** mező, amely N percnél régebbi spotokat mindenhol elrejt.

Minden panel a háttérben betöltve marad, így a fülek közötti váltás soha nem
veszíti el, hol tartottál, a letöltött mail-listádat vagy egy nyitott
beszélgetést.

## Az állomásod adatai

Nyisd meg a **Kapcsolat → Beállítások → Az állomásod** menüt, és add meg a
**Maidenhead-lokátorodat** (pl. `JN97MN`). Ez működteti az antennairányokat, az
azimutális térképvetületet, a távolsági gyűrűket és a „ki hall engem” térképréteget.
Ezt egyszer kell megtenned.
