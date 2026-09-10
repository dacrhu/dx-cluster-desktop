# Das Rohterminal

Der Tab **Rohterminal** (in der Gruppe _Erweitert_) ist die Notluke für
Fortgeschrittene: der ungefilterte Zeilenstrom vom Node und ein Feld zum
Eintippen roher Cluster-Befehle.

Du solltest es selten brauchen — jede Cluster-Funktion hat ein GUI-Äquivalent —,
aber es ist nützlich für:

- genau zu sehen, was ein Node gesendet hat (Debuggen eines Parser-Grenzfalls),
- einen obskuren Befehl auszuführen, den das Panel Werkzeuge nicht auflistet,
- den Login-Handshake zu beobachten.

## Verhalten

- **Auto-Folgen** — neue Ausgabe scrollt **nur** ins Bild, während du **ganz
  unten** bist. Scrolle hoch zum Lesen und es pausiert; ein **„↓ N“**-Chip setzt
  es fort.
- Ausgehende Zeilen, die du tippst, werden mit einem `>`-Marker zurückgespiegelt;
  Node-Zeilen und Fehler werden wie empfangen gezeigt.
- Das Befehlsfeld sendet an den aktuell gewählten
  [Sendeziel](settings.md)-Node.

## Ein Wort der Vorsicht

Rohe Befehle umgehen die Sicherheitsnetze der App (die Nicht-ASCII-Mail-Warnung,
das `/EX`-Auffüllen im Mail-Editor, die dialektkorrekte Filtersyntax). Wenn du
einen Node-seitigen Filter von Hand sendest, weiß das Panel Filter nichts davon.
