# Mitteilungen, WWV/WCY und WX

## Mitteilungen

Der Tab **Mitteilungen** listet Cluster-Mitteilungen (`To ALL`-Nachrichten,
Node-Hinweise, DXpedition-Bulletins). Das Suchfeld nimmt durch Leerzeichen
getrennte **Einschluss**- / **`-Ausschluss`**-Begriffe, abgeglichen gegen
Absender, Ziel und Text — so blendet `-telnet` Zeilen aus, die telnet erwähnen,
und `dxpedition -test` engt auf echte Bulletins ein.

Historische Mitteilungen können mit `SH/ANN` vom Node importiert werden.

## Ausbreitung (WWV / WCY)

Der Tab **Ausbreitung** zeigt die solar-terrestrischen Zahlen:

- **WWV** — SFI, A-Index, K-Index und eine kurze Vorhersage, wie ausgestrahlt.
- **WCY** — das DK0WCY-Bulletin: SFI, A, K, erwartetes K, Sonnenwind, Bz,
  Aurora-Aktivität, geomagnetisches Feld.

Beide werden als **aktuelle Kennzahlen-Kacheln** plus eine **Verlaufstabelle**
gezeigt. Ein Suchfeld über beiden Tabellen filtert sie (Einschluss / `-Ausschluss`,
abgeglichen gegen die Rohfelder).

Die WCY-Kurzcodes (`qui`, `act`, `maj`, `no`, `yes`…) werden im Kachel- und
Zellentext **dekodiert**; der Rohcode steht im Tooltip.

Diese Zahlen speisen auch das [Bedingungs-HUD und den MUF-Layer](map.md) der
Karte.

## WX (Wetter)

Ins Cluster gepostete Wetterbulletins erscheinen im Mitteilungsstrom (als
WX-Zeilen gekennzeichnet). Du kannst selbst ein **WX-Bulletin posten** aus dem
Panel Mitteilungen — es wird an deinen [Sendeziel](settings.md)-Node gesendet.

## Aktivitätspunkte

Die Tabs Mitteilungen und Ausbreitung lassen ihren Aktivitätspunkt aufleuchten,
wenn ein neues Bulletin eintrifft, während du woanders bist. Beim Start
empfangene Daten zählen nicht als „neu“.
