# Hibaelhárítás

## Kapcsolat

**„A node lezárta a kapcsolatot… csatlakozik máshol egy másik kliens?”**
A legtöbb node csak egy munkamenetet enged hívójelenként. Válaszd le a másik
klienst, vagy használj másik SSID-t.

**Beragadt a „bejelentkezés”-nél.** Néhány node lassan küldi a promptját. Adj
neki 30 másodpercet. Nézd meg a [nyers terminált](raw-terminal.md), hogy lásd,
mit küld ténylegesen a node. Ha valami váratlant kérdez, válaszolj egyszer a
nyers terminálban — a program csak jól ismert node-típusoknál tanulja meg a
promptot a következő alkalomra.

**Nincs spot a csatlakozás után.** Ellenőrizd a
[gyorsszűrőidet](spots.md) — egy sáv- vagy módcímke, vagy egy keresőkifejezés
elrejthet mindent. Töröld a keresőmezőt, és szüntesd meg minden címke
kijelölését.

## Értesítések (Linux)

A Linux asztali értesítései egy dedikált kódúton mennek, mert a szabványos
plugin sok rendszeren csendes no-op. Ha **egyáltalán nincs toast**:

- Egy **kiadási buildnél** a `.desktop` fájl helyetted települ.
- Egy **fejlesztői futásnál** (`cargo`/`pnpm tauri dev`) hozd létre kézzel a
  `~/.local/share/applications/hu.dacr.dxclusterdesktop.desktop` fájlt egy
  `Exec=` sorral, amely a ténylegesen buildelt binárisra mutat — a GLib
  elutasítja a fájlt, ha az a bináris nem létezik.
- A **GNOME 49**-en egy ismert shell-hiba elpusztíthat egy app-hoz rendelt
  értesítést, mielőtt kirajzolódna; a program ezt megkerüli azzal, hogy a friss
  értesítés-handle-öket nyitva tartja. Ha a toastok még mindig felvillannak és
  eltűnnek, frissítsd a GNOME-ot.

Állítsd be a `DXCD_NOTIFY_TEST=1` környezeti változót egy önteszt-értesítés
kiváltásához induláskor.

## Rádióvezérlés

**„rigctld nem található” / a modell-lista pici.** Telepítsd a Hamlibet — lásd
[Rádióvezérlés és naplózás](rig-and-logging.md). Nélküle csak egy csomagolt
modell-pillanatkép érhető el, és a soros mód nem tudja elindítani a saját
`rigctld`-jét.

**A CAT csatlakozik, de a frekvencia soha nem frissül.** Engedélyezd a
**VFO lekérdezése** opciót.

**Rossz mód beállítva a DIGI-spotoknál.** Változtasd meg a **Digitális mód**
beállítást (`none` / `USB` / `data`).

## Átadás a naplóprogramnak

**A „QSO előkészítése” nem csinál semmit.** Ellenőrizd, hogy a naplóprogram
UDP-portja egyezik-e a program **log-push** portjával, és hogy a naplóprogram
figyel-e WSJT-X (vagy ADIF) datagramokra. Használd a **Teszt** gombot, hogy
elkülönítsd a programot a spot-folyamtól.

**A naplóprogram ablaka nem jön előtérbe.** Wayland alatt az app-id-t kell
megadnod (pl. `io.github.foldynl.QLog`, a `flatpak list`-ből), nem az
ablakcímet. Telepíts `wmctrl` / `xdotool`-t X11-munkamenetekhez.

## Szöveg / kódolás

**A mailben az ékezetes karakterek `?`-ként vagy zagyvaságként jönnek ki.** A
node csak ASCII, és levágja őket — nem a program. Használd a szerkesztő
**ASCII-vá alakítás** opcióját. A beérkező Latin-1 szöveget a program helyesen
dekódolja.

## Adatfájlok

**A DXCC-lekérdezések üresek.** A `cty.dat` letöltés és a csomagolt másolat is
betöltési hibát adott. Nyisd meg a **Beállítások → DXCC országfájl** menüt, és
kattints az „ellenőrzés most” gombra.

## Még mindig elakadtál?

Nyiss egy issue-t a
[github.com/dacrhu/dx-cluster-desktop/issues](https://github.com/dacrhu/dx-cluster-desktop/issues)
oldalon az OS-eddel, a program verziójával (felső sáv címke / Súgó fül) és, ha
releváns, a nyers terminál kimenetével.
