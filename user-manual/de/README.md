# DX Cluster Desktop — Handbuch

Willkommen! Dieses Handbuch erklärt jeden Teil von DX Cluster Desktop, einem
freundlichen Desktop-Client für Amateurfunk-**DX-Cluster** über Telnet. Du musst
nie rohe Cluster-Befehle eintippen — alles wird über Tabellen, anklickbare
Zeilen und Formulare gesteuert.

Du kannst diese Seiten **in der App** (Tab _Hilfe_) oder hier auf GitHub lesen.
In der App wird jede Seite von GitHub geladen, wenn du online bist, und
andernfalls auf eine mit dem Release gebündelte Kopie zurückgegriffen.

## Inhalt

1. [Erste Schritte](getting-started.md) — Installation, erster Start, das Hauptfenster
2. [Verbindung zu Clustern](connections.md) — Profile, der Preset-Browser, DXSpider vs. AR-Cluster
3. [Die Spot-Tabelle](spots.md) — Spots lesen, Schnellfilter, einen Spot absetzen, das Funkgerät abstimmen
4. [Die Suchsprache](search-query.md) — `dx:` `by:` `band:` `re:` und Verwandte
5. [Die Bandmap](bandmap.md) — Bahnen je Band, der Bandplan, SOS/IBP-Marker
6. [Die Weltkarte](map.md) — Projektionen, Ausbreitungs-Layer, MUF, „wer hört mich“
7. [Die Aktivitätsmatrix](activity.md) — welches Band steigt oder fällt, nach Kontinent
8. [Spot-Filter](filters.md) — lokale Filterung und Node-seitige Filter
9. [Alarme](alerts.md) — Beobachtungslisten, Desktop-Benachrichtigungen, das Trefferprotokoll
10. [Mitteilungen, WWV/WCY und WX](bulletins.md) — die Bulletin- und Ausbreitungs-Feeds
11. [Talk, Chat, Mail und Benutzer](messaging.md) — jede Konversationsfunktion
12. [Werkzeuge und Node-Abfragen](tools.md) — `sh/dx`-Verlauf und generische `sh/*`-Abfragen
13. [Zusätzliche Spot-Quellen](extra-feeds.md) — RBN, PSK Reporter und WSJT-X
14. [Funkgerätesteuerung und Logging](rig-and-logging.md) — CAT über rigctld, Übergabe an das Logprogramm
15. [Einstellungen und Sprachen](settings.md) — jede Einstellung, plus wie man die Sprache ändert
16. [Das Rohterminal](raw-terminal.md) — die Konsole für Fortgeschrittene
17. [Fehlerbehebung](troubleshooting.md) — häufige Probleme und Lösungen

## Ein Hinweis zum Umfang

Der Client spricht für Cluster-Verkehr — Spots, Befehle, Mail, Chat —
**ausschließlich Telnet**. Ein paar optionale Nur-Lese-Feeds (RBN, PSK Reporter,
WSJT-X) und Referenzdaten-Downloads sind davon getrennt und im gesamten Handbuch
klar als solche gekennzeichnet.

`rigctld` (aus [Hamlib](https://hamlib.github.io/)) ist **nicht** Teil der App.
Installiere es separat, wenn du CAT-Steuerung möchtest — siehe
[Funkgerätesteuerung und Logging](rig-and-logging.md).
