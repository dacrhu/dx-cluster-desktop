import { useEffect, useMemo, useRef, useState } from "react";
import { useCluster, useOnlineId } from "@/store/useCluster";
import { fmtUtc } from "@/lib/format";
import { patchSettings } from "@/lib/persist";
import { useT } from "@/i18n";
import * as ipc from "@/lib/ipc";
import { runQuery } from "@/lib/ipc";

// DXSpider has no "list groups" command — groups are ad-hoc. These are the
// common well-known ones; the rest are discovered from SH/CHAT traffic.
const KNOWN_GROUPS = ["#9000", "FOC", "RTTY", "DXNET", "SYSOP", "WX", "LOCAL"];

export function ChatPanel() {
  const tr = useT();
  const chat = useCluster((s) => s.chat);
  const chatGroups = useCluster((s) => s.chatGroups);
  const setChatGroups = useCluster((s) => s.setChatGroups);
  const onlineId = useOnlineId();

  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchedOnce, setFetchedOnce] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Last-activity per group seen in history.
  const activity = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of chat) m.set(c.group, Math.max(m.get(c.group) ?? 0, c.received_at));
    return m;
  }, [chat]);

  const joinedGroups = useMemo(
    () => [...chatGroups].sort((a, b) => (activity.get(b) ?? 0) - (activity.get(a) ?? 0)),
    [chatGroups, activity],
  );

  // Groups seen in SH/CHAT traffic or well-known, that we have NOT joined.
  const availableGroups = useMemo(() => {
    const set = new Set<string>([...activity.keys(), ...KNOWN_GROUPS]);
    for (const g of chatGroups) set.delete(g);
    return [...set].sort((a, b) => (activity.get(b) ?? 0) - (activity.get(a) ?? 0));
  }, [activity, chatGroups]);

  useEffect(() => {
    if (!selected && joinedGroups.length) setSelected(joinedGroups[0]);
  }, [joinedGroups, selected]);

  // Auto-pull SH/CHAT once on first connect so groups can be discovered.
  useEffect(() => {
    if (onlineId && !fetchedOnce && chat.length === 0) void fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineId]);

  const thread = useMemo(
    () =>
      chat
        .filter((m) => m.group === selected)
        .slice()
        .sort((a, b) => a.received_at - b.received_at || a.id - b.id),
    [chat, selected],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread.length]);

  async function persistGroups(next: string[]) {
    setChatGroups(next);
    await patchSettings({ chatGroups: next });
  }

  async function joinGroup(raw: string) {
    const g = raw.trim().toUpperCase();
    if (!g) return;
    if (onlineId) await ipc.chatMembership(onlineId, g, true).catch((e) => setErr(String(e)));
    if (!chatGroups.includes(g)) await persistGroups([...chatGroups, g]);
    setSelected(g);
    setNewGroup("");
  }
  const join = () => joinGroup(newGroup);

  async function leave(g: string) {
    if (onlineId) await ipc.chatMembership(onlineId, g, false).catch(() => {});
    await persistGroups(chatGroups.filter((x) => x !== g));
  }

  async function send() {
    if (!onlineId || !selected || !draft.trim()) return;
    setErr("");
    try {
      await ipc.sendChat(onlineId, selected, draft.trim());
      setDraft("");
    } catch (e) {
      setErr(String(e));
    }
  }

  async function fetchHistory() {
    if (!onlineId) return;
    setFetching(true);
    setFetchedOnce(true);
    try {
      const lines = await runQuery(onlineId, "sh/chat", 6000);
      useCluster.getState().loadChat(await ipc.importChatHistory(onlineId, lines, 2000));
    } finally {
      setFetching(false);
    }
  }

  const joined = selected ? chatGroups.includes(selected) : false;

  return (
    <div className="panel talk-panel">
      <div className="talk-layout">
        <aside className="talk-peers">
          <div className="new-talk">
            <input
              className="mono"
              placeholder={tr("chat.groupPlaceholder")}
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && join()}
            />
            <button style={{ marginTop: 4, width: "100%" }} onClick={join}>
              {tr("chat.join")}
            </button>
          </div>
          <div className="chat-group-section">{tr("chat.joined")}</div>
          {joinedGroups.length === 0 && <p className="muted">{tr("chat.noneJoined")}</p>}
          <ul>
            {joinedGroups.map((g) => (
              <li key={g} className={g === selected ? "active" : ""} onClick={() => setSelected(g)}>
                <span className="mono">{g}</span>
                <span className="buddy-dot">•</span>
              </li>
            ))}
          </ul>

          <div className="chat-group-section">
            {tr("chat.available")}
            <button
              className="chip"
              disabled={!onlineId || fetching}
              onClick={fetchHistory}
              title={tr("chat.fetchTitle")}
            >
              {fetching ? "…" : "↻"}
            </button>
          </div>
          <ul>
            {availableGroups.map((g) => (
              <li
                key={g}
                className={g === selected ? "available active" : "available"}
                onClick={() => setSelected(g)}
              >
                <span className="mono">{g}</span>
                <button
                  className="chip mini"
                  onClick={(e) => {
                    e.stopPropagation();
                    void joinGroup(g);
                  }}
                >
                  {tr("chat.joinShort")}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="talk-thread">
          {selected ? (
            <>
              <div className="talk-thread-head">
                <strong className="mono">{selected}</strong>
                <span className="grow" />
                {joined ? (
                  <button onClick={() => leave(selected)}>{tr("chat.leave")}</button>
                ) : (
                  <button onClick={() => joinGroup(selected)}>{tr("chat.join")}</button>
                )}
                <button disabled={!onlineId || fetching} onClick={fetchHistory}>
                  {fetching ? "…" : "sh/chat"}
                </button>
              </div>
              <div className="talk-messages">
                {thread.map((m) => (
                  <div key={m.id} className={m.outgoing ? "msg out" : "msg in"}>
                    <span className="msg-from mono">{m.sender}</span>
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
                    onlineId
                      ? joined
                        ? tr("chat.msgTo", { group: selected })
                        : tr("chat.joinToSend")
                      : tr("common.noConnection")
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
            <p className="muted">{tr("chat.pick")}</p>
          )}
        </section>
      </div>
      <p className="muted">{tr("chat.note")}</p>
    </div>
  );
}
