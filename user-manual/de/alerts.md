# Alarme

Das Panel **Alarme** verwandelt interessante Spots in eine
Desktop-Benachrichtigung, einen Ton und einen protokollierten „Treffer“. Es hat
drei Abschnitte.

## 1. Alarm-Treffer

Eine prominente Tabelle oben protokolliert jeden Spot, der einen Alarm ausgelöst
hat (neueste zuerst, auf 100 begrenzt, zwischen Sitzungen erhalten). Klicke auf
eine Zeile, um **Spots** gefiltert auf `dx:<call>` zu öffnen. Live-Zeilen, die zu
einem aktivierten Alarm passen, sind in den Ansichten Spots und Bandmap
eingefärbt. Ein neuer Treffer lässt den Aktivitätspunkt am Tab Alarme aufleuchten.

Um Lärm zu vermeiden, wird ein Treffer **nicht** erneut protokolliert, wenn
dasselbe Rufzeichen auf etwa derselben Frequenz in den letzten 5 Minuten schon
einen ausgelöst hat (das fasst Bündel von mehreren Spottern und mehreren Regeln
zu einer Zeile zusammen), und jede Regel hat eine 5-minütige
Benachrichtigungs-Abklingzeit pro Rufzeichen.

## 2. Benachrichtigungen

Der Benachrichtigungsblock hat:

- **Alarme aktivieren** — Haupt-Ein/Aus.
- **Ton** — Ein/Aus, plus eine **Stil**-Auswahl: `chime`, `morse` oder `sweep`
  (alle synthetisiert, keine Dateien). Gleichzeitige Treffer klingen einmal.
- **Test** — eine Beispiel-Benachrichtigung + Ton auslösen.

## 3. Beobachtungsregeln

Klicke auf **+ Neue Regel** (in diesem Abschnitt, nicht in der Panel-Kopfzeile).
Jede Regel ist eine einklappbare Karte:

- **Kopf** — Aktivierungs-Häkchen, Name, eine Zusammenfassung in Klartext,
  Löschen.
- **Körper** — Name, „Spotter ebenfalls abgleichen“, Rufzeichen-**Präfixe**,
  **exakte Rufzeichen**, eine **erweiterte Abfrage** (die
  [Suchsprache](search-query.md)) und **Band-/Mode-/Kontinent**-Chips.

Alle Bedingungen in einer Regel werden **UND-verknüpft**. Lasse ein Feld leer,
um darauf nicht einzuschränken. Eine Regel mit nur gesetzten Präfixen löst bei
jedem Spot dieser Präfixe aus.

Das Feld **exakte Rufzeichen** ist eine kommagetrennte Liste mit exakter
Übereinstimmung (Portable-Suffixe wie `/P`, `/MM`, … werden entfernt, also
löst `HA5XX` auch bei `HA5XX/P` aus) — im Gegensatz zum Präfix-Feld löst
`PA5M` hier nie auch bei `PA5MB` aus. Nutze es zum Jagen einer konkreten
Stationsliste (Diplome, eine benötigte DXCC-Liste); für alles Offene das
Präfix-Feld oder die erweiterte Abfrage.

Die Regeln verwenden das Ein-offen-**Akkordeon**; eine Regel hinzuzufügen öffnet
nur die neue.

## Tipps

- Nutze die erweiterte Abfrage für alles, was die Chips nicht ausdrücken können,
  z. B. `re:/P$ -mode:ft8` oder `cq:2,3,4,5 band:6m`.
- Für eine DXpedition genügt eine Präfix-Regel (`VP8`, `3Y`) plus ein Band-Chip
  meist.
- Für eine feste, konkrete Stationsliste (z. B. Diplomjagd) nutze das Feld
  **exakte Rufzeichen** statt der Präfixe — so löst es nicht bei einem
  ähnlich beginnenden, aber unpassenden längeren Rufzeichen aus.
- Alarme sind unabhängig vom Panel [Filter](filters.md) — ein Alarm kann bei
  einem Spot auslösen, den du aus der Tabelle herausgefiltert hast.
