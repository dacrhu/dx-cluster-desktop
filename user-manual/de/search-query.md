# Die Suchsprache

Jedes Spot-Suchfeld in der App verwendet dieselbe kleine Suchsprache:

- das Suchfeld in den Panels **Spots**, **Bandmap** und **Karte** (es ist ein
  über diese drei geteilter Filter),
- das Feld **erweiterte Abfrage** einer [Alarmregel](alerts.md) — dort wird die
  Abfrage mit den Prefix-/Band-/Mode-/Kontinent-Einstellungen der Regel
  UND-verknüpft,
- das Feld **erweiterte Abfrage** eines [Node-/lokalen Filters](filters.md).

Neben jedem dieser Felder öffnet eine **?**-Schaltfläche ein kurzes Popover mit
derselben Referenz. Diese Seite ist die Langfassung.

Alles ist **Groß-/Kleinschreibung wird ignoriert**. Eine **leere Abfrage passt
auf jeden Spot**. Nichts wirft je einen Fehler — ein Fragment, das der Parser
nicht versteht, wird als gewöhnlicher Suchtext behandelt.

---

## 1. Die drei Bausteine

### Bare Wörter

Ein Wort ohne `field:`-Präfix passt **überall** im DX-Rufzeichen, im Rufzeichen
des Spotters, im Kommentar und im DX-Ländernamen — als Teilstring.

| Abfrage      | Passt auf                                                              |
| ------------ | ---------------------------------------------------------------------- |
| `pota`       | jeden Spot mit „POTA“ im Rufzeichen, Spotter oder Kommentar            |
| `9a`         | „9A“ überall — 9A…-Rufzeichen, aber auch `EA9AB`, ein Kommentar „9A0…“ |
| `italy`      | Spots, deren DX-Ländername „Italy“ enthält                             |
| `lighthouse` | der Kommentar erwähnt einen Leuchtturm                                 |

Bare Wörter sind absichtlich breit. Für Präzision nutze ein Feld (unten).

### Feld-Terme — `field:value`

`field:value` beschränkt den Treffer auf ein Attribut des Spots. Vollständige
Liste in Abschnitt 3 unten.

| Abfrage    | Passt auf                           |
| ---------- | ----------------------------------- |
| `dx:VK9`   | DX-Rufzeichen **beginnt mit** `VK9` |
| `band:20m` | auf dem 20-m-Band                   |
| `cq:14`    | DX ist in CQ-Zone 14                |
| `mode:ft8` | FT8-Spots                           |

### Flags

Drei bare Schlüsselwörter sind **Flags**, keine Textsuchen:

| Flag                                 | Passt auf                                                                                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skimmer`                            | nur Skimmer-/RBN-artige Spots                                                                                                                       |
| `grey` (oder `greyline`, `grayline`) | die DX-Station ist **gerade jetzt** in ihrer Sonnenauf-/-untergangs-Graulinien-Zone (fest ±9° — folgt nicht dem Graulinien-Breite-Regler der Karte) |

---

## 2. Terme kombinieren

### UND — einfach Leerzeichen verwenden

Durch Leerzeichen getrennte Terme müssen **alle** passen.

```
dx:VP8 band:20m cw
```

= DX beginnt mit `VP8` **und** Band ist 20 m **und** Mode ist CW.

### ODER — `OR` oder `|`

`OR` (oder `|`), **von Leerzeichen umgeben**, teilt die Abfrage in alternative
Gruppen. Ein Spot passt, wenn **irgendeine** Gruppe passt. UND bindet stärker
als ODER, also:

```
dx:EA8 band:6m OR dx:CT3 band:6m
```

= (`dx:EA8` UND `band:6m`) ODER (`dx:CT3` UND `band:6m`).

Es gibt **keine Klammern**. Wenn du etwas ausklammern musst, wiederhole es in
jeder Gruppe.

### NICHT — `-` oder `!`

Stelle einem Term ein `-` (oder `!`) voran, um ihn auszuschließen.

```
dx:3 -dx:3D               DX mit Präfix 3, aber nicht 3D…
mode:digi -mode:ft8       digital, aber nicht FT8
pota -c:test              „POTA“ irgendwo, aber nicht das Wort „test“ im Kommentar
```

### ODER innerhalb eines Terms — Kommas

Innerhalb eines einzelnen Feld-Terms werden kommagetrennte Werte ODER-verknüpft:

```
band:20m,40m,80m          eines von drei Bändern
cq:14,15,16               eine von drei Zonen
dx:CE0,VP8,ZL9            eines von drei Präfixen
```

`band:20m,40m` ist kürzer als `band:20m OR band:40m` und bedeutet dasselbe.

### Phrasen — doppelte Anführungszeichen

Anführungszeichen halten Leerzeichen zusammen. Die Anführungszeichen selbst
werden entfernt.

```
"up 2"                    die wörtliche Phrase „up 2“ irgendwo
c:"nil heard"             Kommentar enthält „nil heard“
dxcc:"united states"      Ländername enthält „united states“
```

---

## 3. Feldreferenz

### Rufzeichen — Präfix-Treffer

| Feld                       | Gilt für                    | Treffer                                                     |
| -------------------------- | --------------------------- | ----------------------------------------------------------- |
| `dx:` / `call:`            | die gespottete (DX) Station | Rufzeichen **beginnt mit** dem Wert                         |
| `by:` / `de:` / `spotter:` | der Spotter                 | Spotter-Rufzeichen (SSID entfernt) **beginnt mit** dem Wert |

```
dx:VK0             VK0MM, VK0AI…
call:W1,K1,N1,AA1  US-Rufzeichen des ersten Distrikts
by:OH              alles, was von einer OH-Station gespottet wurde
by:W3LPL           ein bestimmter Skimmer
```

Es gibt **keinen `*`-Platzhalter** — `dx:` / `call:` / `by:` sind immer
Präfix-Treffer. Für alles andere (Suffixe, „enthält“, Muster) nutze `re:`
(siehe _Reguläre Ausdrücke_ unten).

### Land und Zonen

| Feld                   | Gilt für               | Treffer                                                                                            |
| ---------------------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| `dxcc:`                | DX-Land                | Ländername **enthält** den Wert, **oder** der Wert entspricht genau dem primären Präfix des Landes |
| `bydxcc:`              | Land des Spotters      | dasselbe                                                                                           |
| `cq:`                  | DX-CQ-Zone             | Zahl — Vergleiche und Bereiche funktionieren (siehe _Numerische Felder_ unten)                     |
| `bycq:`                | CQ-Zone des Spotters   | Zahl                                                                                               |
| `itu:`                 | DX-ITU-Zone            | Zahl                                                                                               |
| `cont:` / `continent:` | DX-Kontinent           | exakter Kontinentcode: `EU AF AS NA SA OC AN`                                                      |
| `bycont:`              | Kontinent des Spotters | exakter Code                                                                                       |

```
dxcc:japan
dxcc:"czech republic"
dxcc:DL                    exaktes primäres Präfix für Deutschland
cont:AF -bycont:AF         afrikanisches DX, nicht von afrikanischen Stationen gemeldet
cq:2,3,4,5                 nordamerikanische Zonen
bycq:>30                   von jemandem in einer hochnummerierten Zone gespottet
itu:28-29                  ITU-Zonen 28 bis 29
```

> **DX-Seite vs. Spotter-Seite.** `cq:14` („DX ist in Europa“) passt weiterhin
> auf eine europäische Station, die von einem Skimmer in den USA gespottet
> wurde. Füge `bycont:EU` oder `bycq:14,15,16` hinzu, um auch einzuschränken,
> **wer sie gemeldet hat**.

### Band und Mode

| Feld    | Treffer                                                                                                                                                    |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `band:` | das Bandlabel genau wie in der Tabelle gezeigt: `160m 80m 40m 30m 20m 17m 15m 12m 10m 6m 4m 2m 70cm` …                                                     |
| `mode:` | die **Kategorie** (`cw` `ssb` `digi` `fm`) **oder** ein konkreter **Sub-Mode** (`ft8` `ft4` `rtty` `psk` `js8` `sstv` `jt65` …), erkannt aus dem Kommentar |

```
band:6m,4m,2m
mode:cw
mode:digi -mode:ft8       digital, aber nicht FT8
mode:rtty                 speziell RTTY (ein DIGI-Sub-Mode)
mode:sstv
```

`mode:ft` wird als veralteter Alias für `mode:digi` akzeptiert.

### Grid — Präfix-Treffer

| Feld    | Treffer                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `grid:` | DX-Maidenhead-Locator **beginnt mit** dem Wert (benötigt ein Grid auf dem Spot — viele Cluster-Spots haben keins, WSJT-X-/skimmer-angereicherte schon) |

```
grid:JN                   das JN-Feld
grid:JN97,JN86,JN76       ein paar Squares
```

### Kommentartext

| Feld              | Treffer                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| `c:` / `comment:` | Teilstring **nur des Kommentars** (anders als ein bare Wort, das auch Rufzeichen und Land durchsucht) |

```
c:qsx
c:"5 up"
c:73 -c:"tnx 73"
```

### Numerische Felder — `freq`, `age`, `cq`, `itu`

`freq` / `f` (kHz), `age` (Minuten seit Eintreffen des Spots) und die
Zonenfelder `cq` / `bycq` / `itu` akzeptieren:

| Form                                      | Bedeutung                                                     | Beispiel                       |
| ----------------------------------------- | ------------------------------------------------------------- | ------------------------------ |
| `field:N`                                 | gleich `N` (bei `freq` innerhalb ±0,05 kHz)                   | `f:14074`                      |
| `field>N` `field<N` `field>=N` `field<=N` | Vergleich — das `:` ist optional                              | `freq>14000`, `age<15`         |
| `field:LOW-HIGH`                          | inklusiver Bereich                                            | `freq:14000-14100`, `age:5-30` |
| `field:A,B,C`                             | eines von mehreren (jedes kann selbst Bereich/Vergleich sein) | `f:7000-7040,7060`             |

```
f:14000-14100 mode:cw          20-m-CW-Segment
freq>50000 freq<50500          6 m, grob das DX-/Bakensegment
age<10                          in den letzten 10 Minuten eingetroffen
age>120 -mode:ft8              alte Nicht-FT8-Spots (Kandidaten zum Ausblenden)
```

### Reguläre Ausdrücke — `re:` / `regex:`

`re:` nimmt einen **JavaScript-regulären Ausdruck**, immer ohne
Groß-/Kleinschreibung, getestet gegen das **DX-Rufzeichen**, das
**Spotter-Rufzeichen** und den **Kommentar** (nicht den Ländernamen). Der Wert
darf `:` und `,` enthalten — er wird nicht an Kommas aufgeteilt.

Ein ungültiges Muster fällt still auf eine einfache Textsuche zurück, sodass ein
Tippfehler nie die ganze Abfrage bricht.

```
re:/MM$              maritime mobil („…/MM“ am Ende)
re:/P$              portabel
re:^(K|W|N|A)        US-Rufzeichen (Anfang des DX- oder Spotter-Rufzeichens)
re:\bPOTA\b          das Wort POTA (nicht „poташ“ oder ein Rufzeichen, das es enthält)
re:qsx\s*\d          „QSX“ gefolgt von einer Zahl
re:(pse|tnx)\s*qsl   eine QSL-Anfrage im Kommentar
```

Nutze `re:`, wann immer Präfix-Treffer und Teilstrings nicht ausreichen —
Suffixe, Alternation, Wortgrenzen, „Ziffer nach diesem Wort“ und so weiter.

### Unbekannte Felder

Ist `field:` keines der obigen, wird der **gesamte `field:value`-Token** als
wörtlicher Text durchsucht. So sucht `note:xyz` einfach nach der Zeichenkette
„note:xyz“.

---

## 4. Durchgearbeitete Beispiele

| Ziel                                               | Abfrage                                   |
| -------------------------------------------------- | ----------------------------------------- |
| Seltenes Pazifik-DX auf jedem Band                 | `dx:VK9 OR dx:ZL9 OR dx:T31 OR dx:E51`    |
| Neues FT8 in deinem Grid-Feld, letzte 10 Min.      | `mode:ft8 age<10 grid:JN`                 |
| 20 m + 40 m CW aus Afrika, Selbst-Spot-Checks aus  | `band:20m,40m cont:AF cw -c:test`         |
| Was ein Skimmer auf 20 m CW hört                   | `by:W3LPL freq:14000-14100`               |
| Europäisches Lowband, aber nur europäische Skimmer | `band:80m,160m cq:14,15,16 bycq:14,15,16` |
| Park-/Gipfelaktivität                              | `"pota" OR "sota" OR "wwff" OR "iota"`    |
| Maritime mobil, nicht digital                      | `re:/MM$ -mode:digi`                      |
| Alles außer Skimmer-Rauschen                       | `-skimmer`                                |
| DXpedition auf 17 m, Split-Betrieb                 | `dx:3Y0 band:17m c:up`                    |
| Graulinien-Öffnungen auf den Lowbands              | `grey band:80m,160m`                      |

---

## 5. Hinweise und Grenzen

- Die Treffer ignorieren **Groß-/Kleinschreibung**; du brauchst nie
  Großbuchstaben.
- `dx:`, `call:`, `by:`, `grid:` sind **Präfix**-Treffer; `dxcc:`, `c:` und bare
  Wörter sind **Teilstring**-Treffer; `band:`, `cont:` sind **exakt**.
- Es gibt **keine Klammern** und keine Verschachtelung — `OR` teilt immer auf
  oberster Ebene.
- `OR` / `|` müssen von Leerzeichen umgeben sein (`a|b` ist ein bare Wort, kein
  ODER).
- Das `grey`-Flag ist ein festes ±9°-Fenster, sodass sich eine gespeicherte
  Suche unabhängig von der Graulinien-Anzeigeeinstellung der Karte gleich
  verhält.
- Im Panel [Alarme](alerts.md) wird die Abfrage mit den anderen Feldern der
  Regel **UND-verknüpft** — sie schränkt ein, sie kann nicht erweitern.
