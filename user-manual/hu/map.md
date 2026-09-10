# A világtérkép

A **Térkép** fül a spotokat egy beágyazott világtérképen ábrázolja. Görgetéssel
nagyíthatsz, húzással pásztázhatsz.

## Vetület

A **Beállításokban** (a Rétegek felbukkanó) vagy a Térkép gyorssávján
választhatsz:

- **Sík** (equirectangular) — az alapértelmezés.
- **Azimutális** — a QTH-dra (a lokátorodból) központozva, így az irányok és
  távolságok otthonról nézve helyesek. A nagykörös útvonalak egyenessé válnak.

## Alaprétegek

- **DX-spot pöttyök** — mód szerint színezve, életkor szerint halványítva,
  bekarikázva, ha riasztásra illeszkednek. Kattints egy pöttyre egy
  adatkártyáért egy **Műveletek ▾** gombbal (ugyanaz a menü, mint a
  spot-táblázatban); a jobb klikk közvetlenül megnyitja azt a menüt.
- **Szürkület / éjszakai sapka** — az aktuális szubszoláris pont, éjszakai
  árnyékolás és a terminátor.
- **Távolsági gyűrűk** és **nagykörös ívek** a QTH-dtól (kapcsolók).
- **DXCC-prefix címkék** — halvány országprefixek, szükség szerint kiritkítva,
  hogy a térkép olvasható maradjon.
- **„Rólam szóló jelentések”** — lásd lentebb.

## Terjedési rétegek (Térkép gyorssáv)

Mind a gépeden számítva, a programban már meglévő adatokból (WWV/WCY számok, a
spot-folyam, a QTH-d) — nincs extra letöltés, **kivéve** a mért MUF-réteget:

| Réteg            | Amit mutat                                                                                                                                                                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Szürkület**    | Egy szürkületi gyűrű (szélessége 3–12° között állítható) és karikák azokon a spot-pöttyökön, amelyek DX-e benne van.                                                                                                                                                                                                               |
| **Aurora**       | K-index szerint skálázott ovális a geomágneses pólusok körül.                                                                                                                                                                                                                                                                      |
| **MUF**          | Egy kitöltött-kontúros MUF(3000) térkép. Egy modellezett mező (SFI/SSN-ből) összekeverve a [prop.kc2g.com](https://prop.kc2g.com/) **mért** ionoszonda-adataival, amikor a réteg be van kapcsolva (15 percenként lehívva, csak a memóriában). A jelmagyarázat `kc2g · N` kontra `model · SSN n`-t mutat. Becslés, nem előrejelzés. |
| **Nyílások**     | Az elmúlt 30 perc minden spotja egy halvány nagykörös ívként — az átfedés megmutatja, hol történik ténylegesen terjedés.                                                                                                                                                                                                           |
| **Sávrózsa**     | A friss spotok 12 irányszektorba osztva; minden szirom mód szerint színezett szegmensek halmaza. Nagy virág a QTH-n az azimutális vetületben, kis sarokrózsa a síkon.                                                                                                                                                              |
| **Feltétel-HUD** | Egy kis SFI / A / K / SSN panel (bal felül), a keret a K szerint színezve. Kattints rá, hogy a Terjedés fülre ugorj.                                                                                                                                                                                                               |

A Térkép gyorssávjában lévő sáv- és módcímkék szűrik a jelölőket **és** a
nyílások / sávrózsa rétegeket.

## Rólam szóló jelentések

Ez a réteg a **„ki hall engem épp most?”** kérdésre válaszol. Végigpásztázza a
spot-folyamot (beleértve az [RBN, PSK Reporter és WSJT-X](extra-feeds.md)
feedeket) a hívójeledet tartalmazó spotokért, ábrázolja a **vevő** pozícióját, és
egy zöld ívet húz haza.

- A skimmer-pozíciók egy valódi grid-táblából jönnek, nem egy ország
  középpontjából — egy amerikai skimmer Marylandbe kerül, nem Kansas közepére. A
  PSK Reporter pontos vevő-gridje nyer, amikor elérhető.
- Az azonos állomásról azonos frekvencián különböző feedekből érkező jelentések
  egyetlen jelölővé **fésülődnek** össze (`spotter ×N`); a felbukkanó felsorolja
  az összes mögöttes jelentést az életkorával, SNR/WPM-jével és megjegyzésével.

## A térkép-beállítások megmaradnak

A vetület és minden rétegkapcsoló megmarad a munkamenetek között.
