# Zusätzliche Spot-Quellen

Neben Cluster-Spots über Telnet können drei **optionale, nur lesende** Feeds
synthetische Spots hinzufügen. Alle sind standardmäßig aus und werden unter
**Verbindung → Einstellungen** konfiguriert. Keiner trägt Cluster-Verkehr — es
sind „wer/was hört Signale“-Quellen, und ihre Spots werden **nie in die lokale
Datenbank geschrieben** (beim Neustart verschwinden sie).

## RBN (Reverse Beacon Network)

Füge ein Verbindungsprofil **RBN-Feed** hinzu (siehe
[Verbindung zu Clustern](connections.md)). Das RBN ist ein
CW/RTTY/FT-Skimmer-Feuerschlauch; der Client behält nur Spots deines eigenen
Rufzeichens und leitet sie in den Kartenlayer
[„Meldungen über mich“](map.md). Ports: `7000` CW/RTTY, `7001` FT8/FT4.

## PSK Reporter — „wer hört mich“

Ein optionales MQTT-Abonnement (`mqtt.pskreporter.info`, einfaches TCP,
öffentliche Daten). Schalte **PSK Reporter** ein und liste optional zu
beobachtende Rufzeichen (leer = die Rufzeichen deiner Profile). Empfangsmeldungen
über dich werden in synthetische Skimmer-Spots mit dem **exakten** Grid des
Melders verwandelt und erscheinen im Kartenlayer „Meldungen über mich“.

Nur digitale Modes — das RBN deckt CW/RTTY ab. Portable-/Contest-Rufzeichen
brauchen einen eigenen Eintrag (der Abgleich ist exakt).

## WSJT-X — „was mein Funkgerät hört“

Ein optionaler **lokaler UDP**-Listener. Richte den UDP-Server von WSJT-X auf die
App (Standard `127.0.0.1:2237`) — oder nutze seine Multicast-Adresse; der Client
tritt auf jeder Schnittstelle bei und koexistiert mit JTAlert / GridTracker /
QLog, die jeweils weiterhin eine vollständige Kopie erhalten.

Jede WSJT-X-Dekodierung wird zu einem Spot mit Spotter `WSJT-X`, einer eigenen
Quellkategorie, platziert am Grid der dekodierten Station. HF-Frequenz = Dial +
Audio-Offset. Schalte ihre Sichtbarkeit mit dem eigens dafür vorgesehenen
**WSJT-X**-Schalter in der Schnellfilter-Leiste um (nur gezeigt, wenn der Feed
aktiviert ist).

## Filterung

Die Schalter **Skimmer** und **WSJT-X** in der Schnellfilter-Leiste
([Spots](spots.md)) steuern, ob diese synthetischen Spots in den Tabellen, der
Bandmap und der Karte gezeigt werden.
