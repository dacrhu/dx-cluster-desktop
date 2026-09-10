# The search query language

Every spot-search box in the app uses the same small query language:

- the search field on the **Spots**, **Bandmap** and **Map** panels (it is one
  shared filter across those three),
- the **advanced query** field of an [alert rule](alerts.md) — there the query
  is ANDed with the rule's prefix / band / mode / continent settings,
- the **advanced query** field of a [node/local filter](filters.md).

A **?** button next to every one of those boxes opens a short popover with the
same reference. This page is the long version.

Everything is **case-insensitive**. An **empty query matches every spot**.
Nothing ever throws — a fragment the parser can't understand is treated as
ordinary text to search for.

---

## 1. The three building blocks

### Bare words

A word with no `field:` prefix matches **anywhere** in the DX call, the
spotter's call, the comment, and the DX country name — as a substring.

| Query        | Matches                                                              |
| ------------ | -------------------------------------------------------------------- |
| `pota`       | any spot with "POTA" in the call, spotter or comment                 |
| `9a`         | "9A" anywhere — 9A… calls, but also `EA9AB`, a comment saying "9A0…" |
| `italy`      | spots whose DX country name contains "Italy"                         |
| `lighthouse` | comment mentions a lighthouse                                        |

Bare words are broad on purpose. To be precise, use a field (below).

### Fielded terms — `field:value`

`field:value` restricts the match to one attribute of the spot. Full list in
section 3 below.

| Query      | Matches                           |
| ---------- | --------------------------------- |
| `dx:VK9`   | DX callsign **starts with** `VK9` |
| `band:20m` | on the 20 m band                  |
| `cq:14`    | DX is in CQ zone 14               |
| `mode:ft8` | FT8 spots                         |

### Flags

Three bare keywords are **flags**, not text searches:

| Flag                               | Matches                                                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `skimmer`                          | only skimmer / RBN-type spots                                                                                                          |
| `grey` (or `greyline`, `grayline`) | the DX station is in its sunrise/sunset grey-line zone **right now** (fixed ±9° — it does not follow the Map's grey-line width slider) |

---

## 2. Combining terms

### AND — just use spaces

Terms separated by spaces must **all** match.

```
dx:VP8 band:20m cw
```

= DX starts with `VP8` **and** band is 20 m **and** mode is CW.

### OR — `OR` or `|`

`OR` (or `|`), **surrounded by spaces**, splits the query into alternative
groups. A spot matches if **any** group matches. AND binds tighter than OR, so:

```
dx:EA8 band:6m OR dx:CT3 band:6m
```

= (`dx:EA8` AND `band:6m`) OR (`dx:CT3` AND `band:6m`).

There are **no parentheses**. If you need to factor something out, repeat it in
each group.

### NOT — `-` or `!`

Prefix a term with `-` (or `!`) to exclude it.

```
dx:3 -dx:3D               3-prefix DX, but not 3D…
mode:digi -mode:ft8       digital, but not FT8
pota -c:test              "POTA" somewhere, but not the word "test" in the comment
```

### OR inside one term — commas

Inside a single fielded term, comma-separated values are ORed:

```
band:20m,40m,80m          any of three bands
cq:14,15,16               any of three zones
dx:CE0,VP8,ZL9            any of three prefixes
```

`band:20m,40m` is shorter than `band:20m OR band:40m` and means the same thing.

### Phrases — double quotes

Quotes keep spaces together. The quote characters themselves are removed.

```
"up 2"                    the literal phrase "up 2" anywhere
c:"nil heard"             comment contains "nil heard"
dxcc:"united states"      country name contains "united states"
```

---

## 3. Field reference

### Callsigns — prefix match

| Field                      | Applies to               | Match                                                      |
| -------------------------- | ------------------------ | ---------------------------------------------------------- |
| `dx:` / `call:`            | the spotted (DX) station | callsign **starts with** the value                         |
| `by:` / `de:` / `spotter:` | the spotter              | spotter callsign (SSID stripped) **starts with** the value |

```
dx:VK0             VK0MM, VK0AI…
call:W1,K1,N1,AA1  US first-district calls
by:OH              anything spotted by an OH station
by:W3LPL           one particular skimmer
```

There is **no `*` wildcard** — `dx:` / `call:` / `by:` are always
prefix matches. For anything else (suffixes, "contains", patterns) use `re:`
(see _Regular expressions_ below).

### Country and zones

| Field                  | Applies to          | Match                                                                                             |
| ---------------------- | ------------------- | ------------------------------------------------------------------------------------------------- |
| `dxcc:`                | DX country          | country **name contains** the value, **or** the value equals the country's primary prefix exactly |
| `bydxcc:`              | spotter's country   | same                                                                                              |
| `cq:`                  | DX CQ zone          | number — comparisons and ranges work (see _Numeric fields_ below)                                 |
| `bycq:`                | spotter's CQ zone   | number                                                                                            |
| `itu:`                 | DX ITU zone         | number                                                                                            |
| `cont:` / `continent:` | DX continent        | exact continent code: `EU AF AS NA SA OC AN`                                                      |
| `bycont:`              | spotter's continent | exact code                                                                                        |

```
dxcc:japan
dxcc:"czech republic"
dxcc:DL                    exact primary prefix for Germany
cont:AF -bycont:AF         African DX not reported by African stations
cq:2,3,4,5                 North-American zones
bycq:>30                   spotted by someone in a high-numbered zone
itu:28-29                  ITU zones 28 to 29
```

> **DX side vs spotter side.** `cq:14` ("DX is in Europe") still matches a
> European station spotted by a skimmer in the USA. Add `bycont:EU` or
> `bycq:14,15,16` to also constrain **who reported it**.

### Band and mode

| Field   | Match                                                                                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `band:` | the band label exactly as shown in the table: `160m 80m 40m 30m 20m 17m 15m 12m 10m 6m 4m 2m 70cm` …                                                  |
| `mode:` | the **category** (`cw` `ssb` `digi` `fm`) **or** a specific **sub-mode** (`ft8` `ft4` `rtty` `psk` `js8` `sstv` `jt65` …) recognised from the comment |

```
band:6m,4m,2m
mode:cw
mode:digi -mode:ft8       digital, but not FT8
mode:rtty                 RTTY specifically (a DIGI sub-mode)
mode:sstv
```

`mode:ft` is accepted as a legacy alias for `mode:digi`.

### Grid — prefix match

| Field   | Match                                                                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `grid:` | DX Maidenhead locator **starts with** the value (needs a grid on the spot — many cluster spots have none, WSJT-X / skimmer-enriched ones do) |

```
grid:JN                   the JN field
grid:JN97,JN86,JN76       a few squares
```

### Comment text

| Field             | Match                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `c:` / `comment:` | substring of the **comment only** (unlike a bare word, which also searches calls and country) |

```
c:qsx
c:"5 up"
c:73 -c:"tnx 73"
```

### Numeric fields — `freq`, `age`, `cq`, `itu`

`freq` / `f` (kHz), `age` (minutes since the spot arrived), and the zone fields
`cq` / `bycq` / `itu` accept:

| Form                                      | Meaning                                                | Example                        |
| ----------------------------------------- | ------------------------------------------------------ | ------------------------------ |
| `field:N`                                 | equals `N` (for `freq`, within ±0.05 kHz)              | `f:14074`                      |
| `field>N` `field<N` `field>=N` `field<=N` | comparison — the `:` is optional                       | `freq>14000`, `age<15`         |
| `field:LOW-HIGH`                          | inclusive range                                        | `freq:14000-14100`, `age:5-30` |
| `field:A,B,C`                             | any of several (each may itself be a range/comparison) | `f:7000-7040,7060`             |

```
f:14000-14100 mode:cw          20 m CW segment
freq>50000 freq<50500          6 m, roughly the DX/beacon segment
age<10                          arrived in the last 10 minutes
age>120 -mode:ft8              stale non-FT8 spots (candidates to hide)
```

### Regular expressions — `re:` / `regex:`

`re:` takes a **JavaScript regular expression**, always case-insensitive, tested
against the **DX call**, the **spotter call** and the **comment** (not the
country name). The value may contain `:` and `,` — it is not comma-split.

An invalid pattern quietly falls back to a plain text search, so a typo never
breaks the whole query.

```
re:/MM$              maritime-mobile ("…/MM" at the end)
re:/P$               portable
re:^(K|W|N|A)        US calls (start of the DX or spotter call)
re:\bPOTA\b          the word POTA (not "poташ" or a call containing it)
re:qsx\s*\d          "QSX" followed by a number
re:(pse|tnx)\s*qsl   a QSL request in the comment
```

Use `re:` whenever prefix matching and substrings aren't enough — suffixes,
alternation, word boundaries, "digit after this word", and so on.

### Unknown fields

If `field:` isn't one of the above, the **whole `field:value` token** is
searched as literal text. So `note:xyz` just looks for the string "note:xyz".

---

## 4. Worked examples

| Goal                                                | Query                                     |
| --------------------------------------------------- | ----------------------------------------- |
| Rare Pacific on any band                            | `dx:VK9 OR dx:ZL9 OR dx:T31 OR dx:E51`    |
| New FT8 in your grid field, last 10 min             | `mode:ft8 age<10 grid:JN`                 |
| 20 m + 40 m CW from Africa, self-spotted checks off | `band:20m,40m cont:AF cw -c:test`         |
| What one skimmer hears on 20 m CW                   | `by:W3LPL freq:14000-14100`               |
| European lowband, but only European skimmers        | `band:80m,160m cq:14,15,16 bycq:14,15,16` |
| Park/summit activity                                | `"pota" OR "sota" OR "wwff" OR "iota"`    |
| Maritime mobile, not digital                        | `re:/MM$ -mode:digi`                      |
| Everything except skimmer noise                     | `-skimmer`                                |
| DXpedition on 17 m, split working                   | `dx:3Y0 band:17m c:up`                    |
| Grey-line openings on the low bands                 | `grey band:80m,160m`                      |

---

## 5. Notes and limits

- Matching is **case-insensitive**; you never need capitals.
- `dx:`, `call:`, `by:`, `grid:` are **prefix** matches; `dxcc:`, `c:` and bare
  words are **substring** matches; `band:`, `cont:` are **exact**.
- There are **no parentheses** and no nesting — `OR` always splits at the top
  level.
- `OR` / `|` must have spaces around them (`a|b` is one bare word, not an OR).
- The `grey` flag is a fixed ±9° window so a saved search behaves the same
  regardless of the Map's grey-line display setting.
- In the [Alerts](alerts.md) panel the query is **ANDed** with the rule's other
  fields — it narrows, it can't widen.
