# Talk, Chat, Mail und Benutzer

Alle Konversations-Cluster-Funktionen, aus der GUI gesteuert.

## Talk

Der Tab **Talk** hält Eins-zu-eins-`talk`-Unterhaltungen, nach Rufzeichen in
Threads sortiert. Wähle einen Partner (oder komm über „Talk mit…“ aus einem
Spot-Menü hierher) und tippe — der Client sendet den richtigen `talk`-Befehl.
Eingehende Talk-Nachrichten an dich landen im passenden Thread und lassen den
Aktivitätspunkt des Tabs aufleuchten.

## Chat / Konferenz

Der Tab **Chat** ist Gruppenkonferenz (`join` / `leave`), mit einem Thread pro
Gruppe. Deine beigetretenen Gruppen werden gemerkt und bei einer erneuten
Verbindung automatisch wieder betreten. `SH/CHAT`-Verlauf kann importiert werden.

## Benutzer

Der Tab **Benutzer** listet, wer am Node ist, und pro Benutzer eine
Stations-Detailabfrage (`sh/station`). Er hält auch deine **Buddy-Liste** — füge
ein Rufzeichen hinzu und du wirst benachrichtigt, wenn es erscheint. Die Liste
ruft einmal automatisch nach der ersten Verbindung ab.

## Mail und Bulletins

Der Tab **Mail** ist ein vollständiger Mail-/Bulletin-Client:

- **Directory** — die Nachrichtenliste (`DIRECTORY`), nach dem Verbinden
  automatisch abgerufen (mit einem kurzen erneuten Versuch, da der Node noch
  seinen Login-Banner senden könnte).
- **Read** — öffnet eine Nachricht; der Körper wird in einer lokalen Datenbank
  zwischengespeichert, sodass gelesene Nachrichten als gelesen markiert bleiben,
  auch wenn Nodes Bulletins immer wieder als ungelesen melden.
- **Delete** — eine Nachricht `DELETE`.
- **Compose** — **SP** (persönlich), **SB** (Bulletin) und **Reply**, über die
  interaktiven Eingabeaufforderungen des Nodes orchestriert. Ein von dir
  gepostetes Bulletin propagiert tatsächlich.

### Nicht-ASCII-Warnung

Viele Nodes sind nur ASCII und verstümmeln akzentuierte Zeichen. Der Editor
warnt bei Nicht-ASCII-Eingabe und bietet an, sie auf reines ASCII zu falten
(`Árvíztűrő` → `Arvizturo`). Eingehender Latin-1-Text wird korrekt dekodiert.

### Mail-Überwachung

Solange die **Mail-Überwachung** an ist (Verbindung → Einstellungen → Mail,
standardmäßig an), prüft der Client das Directory alle 10 Minuten erneut und löst
eine Desktop-Benachrichtigung + einen Aktivitätspunkt bei wirklich neuer Mail
aus. Ein Node-Wechsel setzt die Basislinie zurück, sodass du nicht über bereits
vorhandene Nachrichten benachrichtigt wirst.
