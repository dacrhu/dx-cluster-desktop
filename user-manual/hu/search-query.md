# A keresőnyelv

A program minden spot-kereső mezője ugyanezt a kis keresőnyelvet használja:

- a **Spotok**, **Sávtérkép** és **Térkép** paneleken lévő keresőmező (ez a
  három között egyetlen közös szűrő),
- egy [riasztási szabály](alerts.md) **haladó lekérdezés** mezője — ott a
  lekérdezés ÉS-kapcsolatban van a szabály prefix / sáv / mód / kontinens
  beállításaival,
- egy [node-/helyi szűrő](filters.md) **haladó lekérdezés** mezője.

Mindegyik ilyen mező mellett egy **?** gomb nyit egy rövid buborékot ugyanezzel
a referenciával. Ez az oldal a hosszú változat.

Minden **kis- és nagybetűre érzéketlen**. Az **üres lekérdezés minden spotra
illeszkedik**. Soha nem dob hibát — egy töredék, amelyet az elemző nem ért,
egyszerű keresendő szövegként kezelődik.

---

## 1. A három építőkő

### Szabad szavak

Egy `field:` prefix nélküli szó **bárhol** illeszkedik a DX-hívójelben, a
spotter hívójelében, a megjegyzésben és a DX ország nevében — részstringként.

| Lekérdezés   | Amire illeszkedik                                                                     |
| ------------ | ------------------------------------------------------------------------------------- |
| `pota`       | bármely spot, amelynek hívójelében, spotterében vagy megjegyzésében szerepel a „POTA” |
| `9a`         | „9A” bárhol — 9A… hívójelek, de `EA9AB` is, vagy egy „9A0…” megjegyzés                |
| `italy`      | spotok, amelyek DX országnevében szerepel az „Italy”                                  |
| `lighthouse` | a megjegyzés világítótornyot említ                                                    |

A szabad szavak szándékosan tágak. A pontossághoz használj mezőt (lentebb).

### Mezős kifejezések — `field:value`

A `field:value` a találatot a spot egyik attribútumára szűkíti. A teljes lista
a lenti 3. szakaszban.

| Lekérdezés | Amire illeszkedik                      |
| ---------- | -------------------------------------- |
| `dx:VK9`   | a DX-hívójel **ezzel kezdődik**: `VK9` |
| `band:20m` | a 20 m-es sávon                        |
| `cq:14`    | a DX a 14-es CQ-zónában van            |
| `mode:ft8` | FT8 spotok                             |

### Kapcsolók

Három szabad kulcsszó **kapcsoló**, nem szövegkeresés:

| Kapcsoló                             | Amire illeszkedik                                                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `skimmer`                            | csak skimmer / RBN-típusú spotok                                                                                                        |
| `grey` (vagy `greyline`, `grayline`) | a DX-állomás **épp most** a napkelte/napnyugta szürkületi zónájában van (fix ±9° — nem követi a Térkép szürkületi-szélesség csúszkáját) |

---

## 2. Kifejezések kombinálása

### ÉS — csak használj szóközt

A szóközzel elválasztott kifejezéseknek **mind** illeszkednie kell.

```
dx:VP8 band:20m cw
```

= a DX `VP8`-cal kezdődik **és** a sáv 20 m **és** a mód CW.

### VAGY — `OR` vagy `|`

Az `OR` (vagy `|`), **szóközökkel körülvéve**, alternatív csoportokra osztja a
lekérdezést. Egy spot akkor illeszkedik, ha **bármelyik** csoport illeszkedik.
Az ÉS erősebben köt, mint a VAGY, tehát:

```
dx:EA8 band:6m OR dx:CT3 band:6m
```

= (`dx:EA8` ÉS `band:6m`) VAGY (`dx:CT3` ÉS `band:6m`).

**Nincsenek zárójelek.** Ha ki kell emelned valamit, ismételd meg minden
csoportban.

### NEM — `-` vagy `!`

Tegyél egy kifejezés elé `-` (vagy `!`) jelet a kizárásához.

```
dx:3 -dx:3D               3-prefixű DX, de nem 3D…
mode:digi -mode:ft8       digitális, de nem FT8
pota -c:test              „POTA” valahol, de nem a „test” szó a megjegyzésben
```

### VAGY egyetlen kifejezésen belül — vesszők

Egyetlen mezős kifejezésen belül a vesszővel elválasztott értékek VAGY-kapcsolatban vannak:

```
band:20m,40m,80m          a három sáv bármelyike
cq:14,15,16               a három zóna bármelyike
dx:CE0,VP8,ZL9            a három prefix bármelyike
```

A `band:20m,40m` rövidebb, mint a `band:20m OR band:40m`, és ugyanazt jelenti.

### Kifejezések — kettős idézőjel

Az idézőjelek egyben tartják a szóközöket. Maguk az idézőjelek eltűnnek.

```
"up 2"                    a szó szerinti „up 2” kifejezés bárhol
c:"nil heard"             a megjegyzés tartalmazza: „nil heard”
dxcc:"united states"      az országnév tartalmazza: „united states”
```

---

## 3. Mezőreferencia

### Hívójelek — prefix-illesztés

| Mező                       | Mire vonatkozik        | Illesztés                                                      |
| -------------------------- | ---------------------- | -------------------------------------------------------------- |
| `dx:` / `call:`            | a spotolt (DX) állomás | a hívójel **ezzel kezdődik**: az érték                         |
| `by:` / `de:` / `spotter:` | a spotter              | a spotter hívójele (SSID levágva) **ezzel kezdődik**: az érték |

```
dx:VK0             VK0MM, VK0AI…
call:W1,K1,N1,AA1  amerikai első körzeti hívójelek
by:OH              bármi, amit egy OH-állomás spotolt
by:W3LPL           egy bizonyos skimmer
```

**Nincs `*` helyettesítő karakter** — a `dx:` / `call:` / `by:` mindig
prefix-illesztés. Bármi másra (utótagok, „tartalmaz”, minták) használd a `re:`
mezőt (lásd _Reguláris kifejezések_ lentebb).

### Ország és zónák

| Mező                   | Mire vonatkozik      | Illesztés                                                                                                   |
| ---------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `dxcc:`                | DX ország            | az országnév **tartalmazza** az értéket, **vagy** az érték pontosan egyenlő az ország elsődleges prefixével |
| `bydxcc:`              | a spotter országa    | ugyanaz                                                                                                     |
| `cq:`                  | DX CQ-zóna           | szám — az összehasonlítások és tartományok működnek (lásd _Numerikus mezők_ lentebb)                        |
| `bycq:`                | a spotter CQ-zónája  | szám                                                                                                        |
| `itu:`                 | DX ITU-zóna          | szám                                                                                                        |
| `cont:` / `continent:` | DX kontinens         | pontos kontinenskód: `EU AF AS NA SA OC AN`                                                                 |
| `bycont:`              | a spotter kontinense | pontos kód                                                                                                  |

```
dxcc:japan
dxcc:"czech republic"
dxcc:DL                    Németország pontos elsődleges prefixe
cont:AF -bycont:AF         afrikai DX, amelyet nem afrikai állomás jelentett
cq:2,3,4,5                 észak-amerikai zónák
bycq:>30                   olyasvalaki spotolta, aki magas számú zónában van
itu:28-29                  ITU-zónák 28-tól 29-ig
```

> **DX-oldal kontra spotter-oldal.** A `cq:14` („a DX Európában van”) még mindig
> illeszkedik egy európai állomásra, amelyet egy USA-beli skimmer spotolt. Adj
> hozzá `bycont:EU`-t vagy `bycq:14,15,16`-ot, hogy **azt is korlátozd, ki
> jelentette**.

### Sáv és mód

| Mező    | Illesztés                                                                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `band:` | a sávcímke pontosan úgy, ahogy a táblázatban látszik: `160m 80m 40m 30m 20m 17m 15m 12m 10m 6m 4m 2m 70cm` …                                                |
| `mode:` | a **kategória** (`cw` `ssb` `digi` `fm`) **vagy** egy konkrét **almód** (`ft8` `ft4` `rtty` `psk` `js8` `sstv` `jt65` …), amelyet a megjegyzésből ismer fel |

```
band:6m,4m,2m
mode:cw
mode:digi -mode:ft8       digitális, de nem FT8
mode:rtty                 kifejezetten RTTY (egy DIGI almód)
mode:sstv
```

A `mode:ft` elfogadott örökölt aliasa a `mode:digi`-nek.

### Grid — prefix-illesztés

| Mező    | Illesztés                                                                                                                                             |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grid:` | a DX Maidenhead-lokátora **ezzel kezdődik**: az érték (kell hozzá grid a spoton — sok cluster-spotnak nincs, a WSJT-X / skimmerrel dúsítottaknak van) |

```
grid:JN                   a JN mező
grid:JN97,JN86,JN76       néhány négyzet
```

### Megjegyzés-szöveg

| Mező              | Illesztés                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| `c:` / `comment:` | **kizárólag a megjegyzés** részstringje (ellentétben egy szabad szóval, amely a hívójeleket és az országot is keresi) |

```
c:qsx
c:"5 up"
c:73 -c:"tnx 73"
```

### Numerikus mezők — `freq`, `age`, `cq`, `itu`

A `freq` / `f` (kHz), az `age` (a spot érkezése óta eltelt percek) és a
zónamezők (`cq` / `bycq` / `itu`) ezt fogadják el:

| Forma                                     | Jelentés                                                                 | Példa                          |
| ----------------------------------------- | ------------------------------------------------------------------------ | ------------------------------ |
| `field:N`                                 | egyenlő `N`-nel (a `freq`-nél ±0,05 kHz-en belül)                        | `f:14074`                      |
| `field>N` `field<N` `field>=N` `field<=N` | összehasonlítás — a `:` opcionális                                       | `freq>14000`, `age<15`         |
| `field:LOW-HIGH`                          | zárt tartomány                                                           | `freq:14000-14100`, `age:5-30` |
| `field:A,B,C`                             | több közül bármelyik (mindegyik maga is lehet tartomány/összehasonlítás) | `f:7000-7040,7060`             |

```
f:14000-14100 mode:cw          20 m CW szegmens
freq>50000 freq<50500          6 m, nagyjából a DX/beacon szegmens
age<10                          az elmúlt 10 percben érkezett
age>120 -mode:ft8              elavult, nem FT8 spotok (elrejtésre jelöltek)
```

### Reguláris kifejezések — `re:` / `regex:`

A `re:` egy **JavaScript reguláris kifejezést** vár, mindig kis-/nagybetűre
érzéketlenül, amelyet a **DX-hívójel**, a **spotter hívójele** és a
**megjegyzés** ellen tesztel (az országnév ellen nem). Az érték tartalmazhat
`:` és `,` jeleket — nem lesz vessző mentén felbontva.

Egy érvénytelen minta csendben egyszerű szövegkeresésre vált vissza, így egy
elgépelés soha nem töri el az egész lekérdezést.

```
re:/MM$              maritime-mobile („…/MM” a végén)
re:/P$              portable
re:^(K|W|N|A)        amerikai hívójelek (a DX vagy a spotter hívójelének eleje)
re:\bPOTA\b          a POTA szó (nem „poташ” vagy egy hívójel, amelyben benne van)
re:qsx\s*\d          „QSX”, amelyet egy szám követ
re:(pse|tnx)\s*qsl   QSL-kérés a megjegyzésben
```

Használd a `re:`-t, valahányszor a prefix-illesztés és a részstringek nem
elegendők — utótagok, alternáció, szóhatárok, „szám ez után a szó után”, stb.

### Ismeretlen mezők

Ha a `field:` nem a fentiek egyike, a **teljes `field:value` token** szó szerinti
szövegként lesz keresve. Tehát a `note:xyz` egyszerűen a „note:xyz” stringet
keresi.

---

## 4. Kidolgozott példák

| Cél                                                  | Lekérdezés                                |
| ---------------------------------------------------- | ----------------------------------------- |
| Ritka csendes-óceáni bármely sávon                   | `dx:VK9 OR dx:ZL9 OR dx:T31 OR dx:E51`    |
| Új FT8 a grid-meződben, utolsó 10 perc               | `mode:ft8 age<10 grid:JN`                 |
| 20 m + 40 m CW Afrikából, önspotolás-ellenőrzések ki | `band:20m,40m cont:AF cw -c:test`         |
| Mit hall egy skimmer 20 m CW-n                       | `by:W3LPL freq:14000-14100`               |
| Európai alsó sávok, de csak európai skimmerek        | `band:80m,160m cq:14,15,16 bycq:14,15,16` |
| Park-/csúcsaktivitás                                 | `"pota" OR "sota" OR "wwff" OR "iota"`    |
| Maritime mobile, nem digitális                       | `re:/MM$ -mode:digi`                      |
| Minden a skimmer-zaj kivételével                     | `-skimmer`                                |
| DXpedíció 17 m-en, splitben dolgozik                 | `dx:3Y0 band:17m c:up`                    |
| Szürkületi nyílások az alsó sávokon                  | `grey band:80m,160m`                      |

---

## 5. Megjegyzések és korlátok

- Az illesztés **kis-/nagybetűre érzéketlen**; soha nincs szükség nagybetűkre.
- A `dx:`, `call:`, `by:`, `grid:` **prefix**-illesztés; a `dxcc:`, `c:` és a
  szabad szavak **részstring**-illesztés; a `band:`, `cont:` **pontos**.
- **Nincsenek zárójelek** és nincs beágyazás — az `OR` mindig a legfelső szinten
  oszt.
- Az `OR` / `|` körül szóközöknek kell lenniük (az `a|b` egy szabad szó, nem
  VAGY).
- A `grey` kapcsoló fix ±9°-os ablak, így egy elmentett keresés ugyanúgy
  viselkedik, függetlenül a Térkép szürkületi-megjelenítési beállításától.
- A [Riasztások](alerts.md) panelen a lekérdezés **ÉS-kapcsolatban** van a
  szabály többi mezőjével — szűkít, nem tud tágítani.
