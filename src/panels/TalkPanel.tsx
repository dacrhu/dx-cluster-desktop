import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useCluster, useOnlineId } from "@/store/useCluster";
import { fmtUtc } from "@/lib/format";
import { useT } from "@/i18n";
import * as ipc from "@/lib/ipc";

export const TalkPanel = memo(function TalkPanel() {
  const tr = useT();
  const talk = useCluster((s) => s.talk);
  const onlineId = useOnlineId();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newCall, setNewCall] = useState("");
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Peers, most-recently-active first.
  const peers = useMemo(() => {
    const seen = new Map<string, number>();
    for (const t of talk) {
      const cur = seen.get(t.peer) ?? 0;
      if (t.received_at > cur) seen.set(t.peer, t.received_at);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  }, [talk]);

  useEffect(() => {
    if (!selected && peers.length) setSelected(peers[0]);
  }, [peers, selected]);

  // Adopt a callsign handed over from a spot's "Talk to …" menu.
  const pendingTalk = useCluster((s) => s.pendingTalk);
  useEffect(() => {
    if (!pendingTalk) return;
    setSelected(pendingTalk.toUpperCase());
    useCluster.getState().setPendingTalk(null);
  }, [pendingTalk]);

  const thread = useMemo(
    () =>
      talk
        .filter((t) => t.peer === selected)
        .slice()
        .sort((a, b) => a.received_at - b.received_at || a.id - b.id),
    [talk, selected],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread.length]);

  async function send() {
    const to = selected ?? newCall.trim().toUpperCase();
    if (!onlineId || !to || !draft.trim()) return;
    setErr("");
    try {
      await ipc.sendTalk(onlineId, to, draft.trim());
      setDraft("");
      setSelected(to);
      setNewCall("");
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <div className="panel talk-panel">
      <div className="talk-layout">
        <aside className="talk-peers">
          <div className="new-talk">
            <input
              className="mono"
              placeholder={tr("talk.newCall")}
              value={newCall}
              onChange={(e) => setNewCall(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCall.trim()) {
                  setSelected(newCall.trim().toUpperCase());
                  setNewCall("");
                }
              }}
            />
          </div>
          {peers.length === 0 && <p className="muted">{tr("talk.noThreads")}</p>}
          <ul>
            {peers.map((p) => (
              <li key={p} className={p === selected ? "active" : ""} onClick={() => setSelected(p)}>
                <span className="mono">{p}</span>
              </li>
            ))}
          </ul>
        </aside>

        <section className="talk-thread">
          {selected ? (
            <>
              <div className="talk-thread-head">
                <strong className="mono">{selected}</strong>
              </div>
              <div className="talk-messages">
                {thread.map((m) => (
                  <div key={m.id} className={m.outgoing ? "msg out" : "msg in"}>
                    <span className="msg-text">{m.text}</span>
                    <span className="msg-meta mono">{fmtUtc(m.received_at)}</span>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="talk-input">
                <input
                  className="grow"
                  placeholder={
                    onlineId ? tr("talk.msgTo", { call: selected }) : tr("common.noConnection")
                  }
                  value={draft}
                  disabled={!onlineId}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                />
                <button className="primary" disabled={!onlineId || !draft.trim()} onClick={send}>
                  {tr("common.send")}
                </button>
              </div>
              {err && <span className="err">{err}</span>}
            </>
          ) : (
            <p className="muted">{tr("talk.pick")}</p>
          )}
        </section>
      </div>
      <p className="muted">{tr("talk.note")}</p>
    </div>
  );
});
