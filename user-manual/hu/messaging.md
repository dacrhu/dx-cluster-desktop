# Talk, chat, mail és felhasználók

Minden beszélgetős cluster-funkció, a GUI-ból vezérelve.

## Talk

A **Talk** fül az egy az egyben `talk` beszélgetéseket tartja, hívójel szerint
szálakra bontva. Válassz egy partnert (vagy érkezz ide egy spot menüjéből a
„Talk vele…” opcióval), és gépelj — a kliens elküldi a megfelelő `talk`
parancsot. A neked címzett beérkező talk-üzenetek a megfelelő szálba kerülnek, és
felgyújtják a fül aktivitáspöttyét.

## Chat / konferencia

A **Chat** fül csoportos konferencia (`join` / `leave`), csoportonként egy
szállal. A csatlakozott csoportjaid megjegyződnek, és újracsatlakozáskor
automatikusan újra csatlakozol. A `SH/CHAT` előzmény importálható.

## Felhasználók

A **Felhasználók** fül listázza, ki van a node-on, és felhasználónként egy
állomás-részlet lekérdezést (`sh/station`). Ez tartja a **haver­listádat** is —
adj hozzá egy hívójelet, és értesítést kapsz, amikor megjelenik. A lista egyszer
automatikusan lehív az első csatlakozás után.

## Mail és bulletinek

A **Mail** fül egy teljes mail-/bulletin-kliens:

- **Directory** — az üzenetlista (`DIRECTORY`), a csatlakozás után automatikusan
  lehívva (egy rövid újrapróbálkozással, mivel a node még a bejelentkezési
  bannerét küldheti).
- **Read** — megnyit egy üzenetet; a törzs egy helyi adatbázisban gyorsítótárba
  kerül, így az elolvasott üzenetek olvasottnak maradnak jelölve, még ha a
  node-ok folyton olvasatlanként jelentik is újra a bulletineket.
- **Delete** — egy üzenet `DELETE`-elése.
- **Compose** — **SP** (személyes), **SB** (bulletin) és **Reply**, a node
  interaktív promptjain keresztül vezényelve. Egy általad feladott bulletin
  valóban propagálódik.

### Nem-ASCII figyelmeztetés

Sok node csak ASCII, és összezavarja az ékezetes karaktereket. A szerkesztő
figyelmeztet a nem-ASCII bevitelre, és felajánlja az egyszerű ASCII-vá alakítást
(`Árvíztűrő` → `Arvizturo`). A beérkező Latin-1 szöveg helyesen dekódolódik.

### Mail-figyelés

Amíg a **mail-figyelés** be van kapcsolva (Kapcsolat → Beállítások → Mail,
alapból be), a kliens 10 percenként újraellenőrzi a directoryt, és asztali
értesítést + aktivitáspöttyöt vált ki valóban új mailnél. A node-váltás
visszaállítja az alapvonalat, így nem kapsz értesítést a már meglévő üzenetekről.
