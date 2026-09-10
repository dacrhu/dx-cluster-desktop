# Talk, chat, mail and users

All conversational cluster features, driven from the GUI.

## Talk

The **Talk** tab holds one-to-one `talk` conversations, threaded by callsign.
Pick a peer (or arrive here via "Talk to…" from a spot menu) and type — the
client sends the right `talk` command. Incoming talk messages addressed to you
land in the matching thread and light the tab's activity dot.

## Chat / conference

The **Chat** tab is group conference (`join` / `leave`), with a thread per
group. Your joined groups are remembered and re-joined automatically on
reconnect. `SH/CHAT` history can be imported.

## Users

The **Users** tab lists who is on the node and, per user, a station detail
lookup (`sh/station`). It also holds your **buddy list** — add a call and you
are notified when they appear. The list fetches once automatically after the
first connection.

## Mail and bulletins

The **Mail** tab is a full mail/bulletin client:

- **Directory** — the message list (`DIRECTORY`), fetched automatically after
  connect (with a short retry, since the node may still be sending its login
  banner).
- **Read** — opens a message; the body is cached in a local database, so read
  messages stay marked read even though nodes keep re-reporting bulletins as
  unread.
- **Delete** — `DELETE` a message.
- **Compose** — **SP** (personal), **SB** (bulletin) and **Reply**, orchestrated
  through the node's interactive prompts. A bulletin you post really does
  propagate.

### Non-ASCII warning

Many nodes are ASCII-only and mangle accented characters. The composer warns on
non-ASCII input and offers to fold it to plain ASCII (`Árvíztűrő` →
`Arvizturo`). Incoming Latin-1 text is decoded correctly.

### Mail watch

While **mail watch** is on (Connection → Settings → Mail, default on) the client
re-checks the directory every 10 minutes and fires a desktop notification +
activity dot on genuinely new mail. Switching nodes resets the baseline so you
are not notified about pre-existing messages.
