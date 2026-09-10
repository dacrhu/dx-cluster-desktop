# Verbindung zu Clustern

Das Panel **Verbindung** hat zwei Ansichten, umgeschaltet über den Schalter in
seiner Kopfzeile: **Verbindungen** (Profile und der Preset-Browser) und
**Einstellungen** (alles Übrige). Diese Seite behandelt Verbindungen.

## Verbindungsprofile

Ein Profil ist ein gespeicherter Cluster-Login. Klicke auf **+ Hinzufügen**, um
eines anzulegen, oder klicke auf ein Profil in der Liste, um es zu bearbeiten.

| Feld           | Bedeutung                                                                       |
| -------------- | ------------------------------------------------------------------------------- |
| Name           | Ein Label für die Liste — freier Text.                                          |
| Host / Port    | Die Telnet-Adresse des Nodes, z. B. `hg8lxl.ham.hu` / `7300`.                   |
| Rufzeichen     | Dein Login-Rufzeichen.                                                          |
| Passwort       | Nur wenn der Node eines verlangt. Zur Laufzeit im OS-Schlüsselbund gespeichert. |
| Typ            | **Cluster** (ein normales DX-Cluster) oder **RBN-Feed** — siehe unten.          |
| Software       | **DXSpider** oder **AR-Cluster** — wählt den Befehlsdialekt. Siehe unten.       |
| Auto-Verbinden | Dieses Profil beim Start automatisch verbinden.                                 |

Mehrere Profile können gleichzeitig verbunden sein. Spots von allen werden
zusammengeführt und dedupliziert (ein 90-Sekunden-Fenster über Rufzeichen +
Frequenz + Spotter).

## Der Preset-Browser

Klappe beim Hinzufügen eines Profils den **Preset-Browser** auf, um aus ~730
öffentlichen Nodes zu wählen. Wähle ein **Land** (nach Kontinent gruppiert), dann
einen Node — ein Klick füllt Host, Port und Name aus und errät den Softwaretyp.
Das Land jedes Nodes wird aus seinem Rufzeichen aufgelöst.

Die Preset-Liste aktualisiert sich wöchentlich automatisch. Ihr Status und eine
manuelle Schaltfläche „Jetzt prüfen“ befinden sich unter **Einstellungen →
Cluster-Presets**. Quelle: [dxcluster.info](https://dxcluster.info/), mit
Genehmigung verwendet.

## RBN-Feed-Profile

Klicke auf **+ RBN-Feed**, um ein Profil für das Reverse Beacon Network
vorauszufüllen (`telnet.reversebeacon.net:7000` für CW/RTTY, `7001` für
FT8/FT4). Ein RBN-Feed ist ein befehlsloser Skimmer-Feuerschlauch, deshalb:

- behält der Client **nur** Spots **deines** Rufzeichens,
- schreibt sie nie in die lokale Datenbank (beim Neustart verschwinden sie),
- leitet sie in den Kartenlayer „Meldungen über mich“.

RBN-Profile sind in der Liste mit `RBN` gekennzeichnet und können kein Sendeziel
sein.

## DXSpider vs. AR-Cluster

Die beiden verbreiteten Node-Typen unterscheiden sich in der Befehlssyntax.
Stelle **Software** korrekt ein, damit der Client die richtigen Befehle erzeugt
für:

- **Spot-Filter** — DXSpider `accept/reject spot` vs. AR-Cluster
  `set/dx/filter`. Siehe [Spot-Filter](filters.md).
- **`SH/DX`-Verlauf** — positionale DXSpider-Form vs. AR-Cluster-`field=value`-Form.
  Siehe [Werkzeuge und Node-Abfragen](tools.md).

Das Parsen von Spots, WWV, WCY und Mitteilungen ist bei beiden gleich. Wenn du
unsicher bist, ist DXSpider die sichere Vorgabe und bei Weitem am häufigsten.

## Verbindungszustand

Jedes Profil zeigt seinen Zustand: _getrennt_, _verbindet_, _meldet an_,
_online_ oder einen Fehler. Der Login-Automat behandelt sowohl Nodes, die eine
`login:`-Eingabeaufforderung senden, als auch Nodes, die einfach zu streamen
beginnen. Fehler (einschließlich „du bist bereits woanders verbunden“)
erscheinen inline und im [Rohterminal](raw-terminal.md).
