# Alerts

The **Alerts** panel turns interesting spots into a desktop notification, a
sound and a logged "hit". It has three sections.

## 1. Alert hits

A prominent table at the top logs every spot that fired an alert (newest first,
capped at 100, kept between sessions). Click a row to open **Spots** filtered to
`dx:<call>`. Live rows matching an enabled alert are tinted in the Spots and
Bandmap views. A new hit lights the activity dot on the Alerts tab.

To avoid noise, a hit is **not** logged again if the same call at roughly the
same frequency already fired in the last 5 minutes (this collapses
multi-spotter and multi-rule bursts into one row), and each rule has a 5-minute
per-call notification cooldown.

## 2. Notifications

The notification block has:

- **Enable alerts** — master on/off.
- **Sound** — on/off, plus a **style** select: `chime`, `morse` or `sweep`
  (all synthesised, no files). Simultaneous hits sound once.
- **Test** — fire a sample notification + sound.

## 3. Watch rules

Click **+ New rule** (in this section, not the panel header). Each rule is a
collapsible card:

- **Head** — enable checkbox, name, a plain-language summary, delete.
- **Body** — name, "match spotter too", callsign **prefixes**, **exact
  callsigns**, an **advanced query** (the [query language](search-query.md)),
  and **band / mode / continent** chips.

All conditions in a rule are **ANDed**. Leave a field blank to not constrain on
it. A rule with only prefixes set fires on any spot of those prefixes.

The **exact callsigns** field is a comma-separated list matched exactly
(portable `/P`, `/MM`, … suffixes are stripped, so `HA5XX` still fires on
`HA5XX/P`) — unlike the prefix field, `PA5M` here never also fires on
`PA5MB`. Use it for hunting a specific list of stations (awards, a DXCC
needed-list); use the prefix field or the advanced query for anything
open-ended.

Rules use the one-open **accordion**; adding a rule opens just the new one.

## Tips

- Use the advanced query for anything the chips can't express, e.g.
  `re:/P$ -mode:ft8` or `cq:2,3,4,5 band:6m`.
- For a DXpedition, a prefix rule (`VP8`, `3Y`) plus a band chip is usually
  enough.
- For a fixed list of specific stations (e.g. an awards chase), use the
  **exact callsigns** field instead of prefixes — it won't misfire on an
  unrelated longer callsign that happens to start the same way.
- Alerts are independent of the [Filters](filters.md) panel — an alert can fire
  on a spot you have filtered out of the table.
