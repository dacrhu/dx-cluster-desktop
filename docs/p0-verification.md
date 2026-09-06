# P0 live verification checklist

> **Status (done):** both checks were run against live nodes.
> §1 — a generated `set/dx/filter` was pushed to a live AR-Cluster V6 and
> accepted, spot stream filtered as expected.
> §2 — a bulletin was composed and posted on a live DXSpider net and
> propagated.
> The only issues that surfaced were unrelated and since fixed: the mailbox
> didn't auto-refresh for new mail (now polled, §3), and accented text was
> mangled node-side (`Árvíztűrő` → `�rvíztűr�` — Latin-1 decode fallback +
> a compose-time ASCII warning added).
> Kept as a reference for re-runs / other nodes.

The command/orchestration code was audited and hardened (see the git history
for `commands.rs` / `ipc.ts`). Run these with the app against a real node and
the **Raw terminal** tab open so you can watch what goes out and comes back.

---

## 1. AR-Cluster `SET/DX/FILTER` push

**Goal:** confirm a GUI-built filter rule, pushed to a live AR-Cluster V6 node,
is accepted and actually filters the spot stream.

**Node:** `dxcluster.hadxc.hu` (V6 6.1.5123) or any AR-Cluster V6.

### Setup

1. Connection panel → new profile → pick the AR-Cluster preset (or set
   **Software = AR-Cluster** by hand). Connect. Confirm the `AR` tag on the row.
2. Raw terminal: `show/dx options` → expect the `DX configuration options:`
   block (`Count/Filter/Mode/Output/Comment Options`). This part is already
   known-good; it's the baseline.

### Test A — accept by band + DXCC

1. Filters panel → new rule:
   - Action **Accept**
   - Bands: `20m`
   - DX DXCC: `HA`
   - tick **push to node**
2. Preview should read: `set/dx/filter Band=20 and Cty=HA`
3. Click **apply to node**. Raw terminal: the node should echo an
   acknowledgement (something like `DX filter set` / no error). **A `?` or
   `Unknown command` / `Error` is a failure — copy the exact line.**
4. `show/dx options` → the `Filter:` line should now reflect the expression.
5. Watch the live spots for ~2 min: only 20m spots of Hungarian stations
   should arrive. (Use `set/dx/mode debug` on the node to see `+`/`-` prefixed
   pass/reject decisions, then `set/dx/mode filter` to go back.)

### Test B — reject with an OR-group (checks the `not (...)` form)

1. New rule: Action **Reject**, Spotter call prefixes: `W3, K1` (two values),
   push to node.
2. Preview: `set/dx/filter not (Spotter=W3* or Spotter=K1*)`
3. Apply. Confirm accepted, then confirm spots from W3*/K1* skimmers stop.

### Test C — prefix wildcard (the one thing the manual doesn't pin down)

1. New rule: Action **Accept**, DX call prefixes: `P5` (just one), push.
2. Preview: `set/dx/filter Call=P5*`
3. Apply. If the node rejects `Call=P5*` or it matches nothing when a `P5`-ish
   spot is clearly present, the trailing-`*` prefix match is **not** supported
   on `Call=` — in that case we need to switch `prefix_terms` to emit
   `Call=*P5*` (infix, the documented `*BUST*` style) or exact `Call=P5`.
   Record which forms the node accepts.

### Cleanup

- Filters panel → **Clear node filters** → sends empty `set/dx/filter`.
- `show/dx options` → `Filter:` back to default (`not skimmer or skimvalid`).

### What to report back

- The exact ack / error line for each apply.
- Whether Test C's `Call=P5*` worked, and if not, which of `Call=*P5*` /
  `Call=P5` the node accepts.

### Test D — Tools panel `SH/DX` against AR-Cluster (added later)

1. With an AR-Cluster connection selected, Tools panel → SH/DX historical
   section → set count 10, band 40m, then hit **from node**.
2. The button label should read `show/dx/10 band=40` (not `SH/DX 10 on 40m`).
3. Rows should fill the history table. An `unknown command` reply shows a
   `tools.notSupported` note instead.
4. Add a DX call / spotter and confirm the label becomes
   `show/dx/10 band=40 and call=… and spotter=…` and still returns rows.

---

## 2. DXSpider mail compose (`sendMail`)

**Goal:** confirm the interactive SP/SB/REPLY orchestration matches the real
prompt wording end to end.

**Node:** `hg8lxl.ham.hu` / `hg8lxl` (DXSpider) or any DXSpider ≥ 1.5x. Use a
**private message to yourself** first so nothing hits a public bulletin net.

### Test A — private message to self

1. Mail panel → compose → **Private**, To: your own call, Subject:
   `p0 test 1`, Body: two or three lines.
2. Send. Watch Raw terminal for the sequence:
   - `sp <YOURCALL>` goes out
   - node: `Enter Subject (30 characters):` → app sends the subject
   - node: `Enter Message /EX to send or /ABORT to exit` → app sends body lines
   - app sends `/EX`
   - node: confirmation (note the **exact** wording — `Msg N queued`? silent?)
3. Mail panel → Directory → the new message should appear; open it, body intact,
   line breaks preserved.

### Test B — body line starting with `/`

1. Compose to self again, put a line `/EX now` and a line `/abort test` in the
   **middle** of the body.
2. Send. The message must arrive **complete** (the hardening space-pads those
   lines). If it arrives truncated at that line, the padding isn't enough and
   we need a different escape.

### Test C — reply

1. Directory → select the message from Test A → Reply. Subject prefilled
   `Re: ...`. Add a line, send. Confirm it threads / arrives.

### Test D — slow-login race (optional)

1. Immediately after connecting (while the node is still printing its login
   banner / MOTD), fire a compose. It should still work — the 8 s blind
   fallback must not fire before the real `Enter Subject` prompt. If the
   subject text shows up as a raw command in the Raw terminal, the timing
   needs more work.

### Then — one real bulletin

Only after A–C look clean: post one genuine bulletin (e.g. to `LOCAL` or a
regional group) and confirm it propagates.

### What to report back

- The exact confirmation line after `/EX` (feeds the `stage === "done"` regex
  in `sendMail` — currently `/(queued|msg.*sent|not sent|aborted|no such)/i`).
- The exact subject + message prompt strings if they differ from the documented
  wording.
- Test B result (complete vs truncated).

---

## 3. Mail watch (new feature — quick check)

Connection panel → Settings → **Mail** → "Watch for new mail" (on by default).

1. Connect. Within a few seconds the mailbox auto-loads (baseline set silently).
2. From another client / the Raw terminal, send yourself a message.
3. Within 10 min: a **desktop notification** ("New mail") fires and the **Mail
   tab shows an activity dot** (if you're on another tab). Opening the Mail tab
   clears the dot.
4. Turning the toggle off stops the polling entirely.

If the poll ever fires a `directory` in the middle of a compose (visible on the
Raw terminal as a stray `directory` between the subject/body prompts), the
`busyRef` guard in `MailPanel` isn't holding — report it.
