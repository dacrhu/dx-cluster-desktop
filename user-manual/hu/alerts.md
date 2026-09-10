# Riasztások

A **Riasztások** panel az érdekes spotokat asztali értesítéssé, hanggá és
naplózott „találattá” alakítja. Három szakasza van.

## 1. Riasztási találatok

Egy kiemelt táblázat a tetején naplózza minden spotot, amely riasztást váltott
ki (legfrissebb felül, 100-nál felső korlát, munkamenetek között megőrizve).
Kattints egy sorra, hogy a **Spotok** megnyíljon `dx:<call>`-ra szűrve. Az
engedélyezett riasztásra illeszkedő élő sorok színezettek a Spotok és a
Sávtérkép nézetben. Egy új találat felgyújtja a Riasztások fül aktivitáspöttyét.

A zaj elkerülésére egy találat **nem** kerül újra naplózásra, ha ugyanaz a
hívójel nagyjából ugyanazon a frekvencián már kiváltott egyet az elmúlt
5 percben (ez egyetlen sorrá vonja össze a több spottertől és több szabálytól
érkező sorozatokat), és minden szabálynak van egy 5 perces, hívójelenkénti
értesítési türelmi ideje.

## 2. Értesítések

Az értesítési blokkban:

- **Riasztások engedélyezése** — fő ki/be.
- **Hang** — ki/be, plusz egy **stílus** választó: `chime`, `morse` vagy `sweep`
  (mind szintetizált, nincs fájl). Az egyidejű találatok egyszer szólalnak meg.
- **Teszt** — egy minta-értesítés + hang kiváltása.

## 3. Figyelőszabályok

Kattints a **+ Új szabály** gombra (ebben a szakaszban, nem a panel fejlécében).
Minden szabály egy összecsukható kártya:

- **Fej** — engedélyező jelölőnégyzet, név, egy közérthető összefoglaló, törlés.
- **Törzs** — név, „spottert is illeszd”, hívójel-**prefixek**, egy **haladó
  lekérdezés** (a [keresőnyelv](search-query.md)), és **sáv / mód / kontinens**
  címkék.

Egy szabály minden feltétele **ÉS-kapcsolatban** áll. Hagyj egy mezőt üresen,
hogy ne korlátozz rá. Egy csak prefixekkel megadott szabály e prefixek bármely
spotjára kivált.

A szabályok az egy-nyitva **akkordeont** használják; egy szabály hozzáadása csak
az újat nyitja meg.

## Tippek

- Használd a haladó lekérdezést bármihez, amit a címkék nem tudnak kifejezni,
  pl. `re:/P$ -mode:ft8` vagy `cq:2,3,4,5 band:6m`.
- Egy DXpedícióhoz egy prefix-szabály (`VP8`, `3Y`) plusz egy sávcímke általában
  elég.
- A riasztások függetlenek a [Szűrők](filters.md) paneltől — egy riasztás
  kiválthat egy olyan spotra, amelyet kiszűrtél a táblázatból.
