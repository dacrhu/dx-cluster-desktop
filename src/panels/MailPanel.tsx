import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useCluster, useOnlineId } from "@/store/useCluster";
import { useT } from "@/i18n";
import * as ipc from "@/lib/ipc";
import { runQuery, sendMail, type MailDraft } from "@/lib/ipc";
import { notify } from "@/lib/notify";
import type { MailHeader, StoredMail } from "@/lib/types";
import { hasNonAscii, toAsciiText } from "@/lib/util";

/** How often to re-check the mailbox for new arrivals while online. */
const MAIL_POLL_MS = 10 * 60 * 1000;

type Scope = "new" | "own" | "recent" | "all";

const SCOPE_CMD: Record<Scope, string> = {
  new: "directory new",
  own: "directory own",
  recent: "directory 30",
  all: "directory all 30",
};

const BULLETIN_CATS = ["ALL", "LOCAL", "DX", "WANTED", "FORSALE", "SYSOP"];

export const MailPanel = memo(function MailPanel() {
  const tr = useT();
  const onlineId = useOnlineId();

  const [scope, setScope] = useState<Scope>("recent");
  const [filter, setFilter] = useState("");
  const [headers, setHeaders] = useState<MailHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<StoredMail | null>(null);
  const [msgLoading, setMsgLoading] = useState(false);
  const [status, setStatus] = useState("");

  const [compose, setCompose] = useState<MailDraft | null>(null);
  const [sending, setSending] = useState(false);
  const autoDone = useRef(false);

  const { mailWatchEnabled, noteMailMsgnos, resetMailBaseline } = useCluster(
    useShallow((s) => ({
      mailWatchEnabled: s.mailWatchEnabled,
      noteMailMsgnos: s.noteMailMsgnos,
      resetMailBaseline: s.resetMailBaseline,
    })),
  );

  // Fetch the mailbox automatically once, shortly after the first connection
  // (like the Users panel). A retry covers the case where the node is still
  // sending its login banner when the first `directory` goes out and
  // `runQuery` finishes early on the ready prompt.
  useEffect(() => {
    if (!onlineId || autoDone.current) return;
    autoDone.current = true;
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        await new Promise((r) => setTimeout(r, attempt === 0 ? 1500 : 3000));
        if (cancelled) return;
        const rows = await refresh().catch(() => [] as MailHeader[]);
        if (rows.length) return;
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineId]);

  const visible = useMemo(() => {
    const q = filter.trim().toUpperCase();
    const list = q
      ? headers.filter((h) => `${h.from} ${h.to} ${h.subject}`.toUpperCase().includes(q))
      : headers;
    // Newest (highest message number) first.
    return [...list].sort((a, b) => b.msgno - a.msgno);
  }, [headers, filter]);

  async function refresh(): Promise<MailHeader[]> {
    if (!onlineId) return [];
    setLoading(true);
    setStatus("");
    try {
      const lines = await runQuery(onlineId, SCOPE_CMD[scope], 6000);
      const parsed = await ipc.parseDirectory(lines);
      setHeaders(parsed);
      noteMailMsgnos(parsed.map((h) => h.msgno));
      if (parsed.length === 0) setStatus(tr("mail.noMsgs"));
      return parsed;
    } finally {
      setLoading(false);
    }
  }

  // Re-baseline the "new mail" watcher whenever the target node changes, so the
  // first fetch against it doesn't fire a notification for pre-existing mail.
  useEffect(() => {
    resetMailBaseline();
  }, [onlineId, resetMailBaseline]);

  // Don't let a background poll fire a `directory` while the interactive
  // SP/SB/REPLY orchestration is waiting on a prompt.
  const busyRef = useRef(false);
  busyRef.current = compose !== null || sending;

  // Periodic mailbox poll while online → tab dot + desktop toast on new mail.
  // Kept light: no spinner / status churn, just the header list and the watcher.
  useEffect(() => {
    if (!onlineId || !mailWatchEnabled) return;
    let stop = false;
    const poll = async () => {
      if (busyRef.current) return;
      try {
        const lines = await runQuery(onlineId, SCOPE_CMD[scope], 6000);
        const parsed = await ipc.parseDirectory(lines);
        if (stop) return;
        setHeaders(parsed);
        if (noteMailMsgnos(parsed.map((h) => h.msgno)))
          void notify(tr("mail.notifyTitle"), tr("mail.notifyBody"));
      } catch {
        /* transient — next tick retries */
      }
    };
    const iv = setInterval(poll, MAIL_POLL_MS);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [onlineId, mailWatchEnabled, scope, noteMailMsgnos, tr]);

  async function open(h: MailHeader) {
    if (!onlineId) return;
    setMsg(null);
    setMsgLoading(true);
    try {
      const cached = await ipc.cachedMail(onlineId, h.msgno);
      if (cached) {
        setMsg(cached);
      } else {
        const lines = await runQuery(onlineId, `read ${h.msgno}`, 6000);
        const m = await ipc.readMail(onlineId, lines);
        setMsg(m);
        if (!m) setStatus(tr("mail.readError", { n: h.msgno }));
      }
      // mark it read in the local list
      setHeaders((hs) => hs.map((x) => (x.msgno === h.msgno ? { ...x, read: true } : x)));
    } finally {
      setMsgLoading(false);
    }
  }

  async function del(msgno: number) {
    if (!onlineId) return;
    await ipc.sendRaw(onlineId, `delete ${msgno}`);
    setHeaders((hs) => hs.filter((x) => x.msgno !== msgno));
    if (msg?.msgno === msgno) setMsg(null);
  }

  function startCompose(base?: Partial<MailDraft>) {
    setCompose({ to: "", subject: "", body: "", isPrivate: true, ...base });
  }

  function replyTo(m: StoredMail) {
    setCompose({
      to: m.from,
      subject: m.subject.toUpperCase().startsWith("RE:") ? m.subject : `Re: ${m.subject}`,
      body: "",
      isPrivate: true,
      replyTo: m.msgno,
    });
  }

  async function doSend() {
    if (!onlineId || !compose) return;
    setSending(true);
    try {
      const lines = await sendMail(onlineId, compose);
      const tail = lines.slice(-4).join(" ").trim();
      setStatus(tr("mail.sentNode", { tail: tail || tr("mail.sentNoResponse") }));
      setCompose(null);
      void refresh();
    } catch (e) {
      setStatus(String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="panel mail-panel">
      <div className="panel-head">
        <h2>{tr("mail.title")}</h2>
        <div className="tabs">
          {(["new", "recent", "own", "all"] as Scope[]).map((s) => (
            <button
              key={s}
              className={scope === s ? "tab active" : "tab"}
              onClick={() => setScope(s)}
            >
              {
                {
                  new: tr("mail.new"),
                  recent: tr("mail.recent"),
                  own: tr("mail.own"),
                  all: tr("mail.allMsgs"),
                }[s]
              }
            </button>
          ))}
        </div>
        <button className="primary" disabled={!onlineId || loading} onClick={refresh}>
          {loading ? "…" : tr("common.refresh")}
        </button>
        <button disabled={!onlineId} onClick={() => startCompose()}>
          {tr("mail.compose")}
        </button>
      </div>
      {status && <p className="muted">{status}</p>}

      <div className="mail-layout">
        <div className="mail-list">
          <input
            className="search"
            placeholder={tr("mail.filterPlaceholder")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th></th>
                <th>{tr("mail.fromTo")}</th>
                <th>{tr("col.date")}</th>
                <th>{tr("col.subject")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((h) => (
                <tr
                  key={h.msgno}
                  className={msg?.msgno === h.msgno ? "active" : ""}
                  onClick={() => open(h)}
                  style={{ cursor: "pointer", fontWeight: h.read ? "normal" : 600 }}
                >
                  <td className="mono">{h.msgno}</td>
                  <td>
                    {!h.read && <span title={tr("mail.unread")}>●</span>}
                    {h.private && <span title={tr("mail.private")}> P</span>}
                  </td>
                  <td className="mono">
                    {h.from} → {h.to}
                  </td>
                  <td>
                    {h.date} {h.time}
                  </td>
                  <td>{h.subject}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mail-view">
          {compose ? (
            <Composer
              draft={compose}
              onChange={setCompose}
              onSend={doSend}
              onCancel={() => setCompose(null)}
              sending={sending}
              disabled={!onlineId}
            />
          ) : msgLoading ? (
            <p className="muted">{tr("mail.reading")}</p>
          ) : msg ? (
            <>
              <div className="panel-head">
                <h3>{msg.subject || tr("mail.noSubject")}</h3>
                <button onClick={() => replyTo(msg)}>{tr("mail.reply")}</button>
                <button className="danger" onClick={() => del(msg.msgno)}>
                  {tr("common.delete")}
                </button>
              </div>
              <p className="muted mono">
                #{msg.msgno} · {msg.from} → {msg.to} · {msg.posted}
              </p>
              <pre className="raw-block">{msg.body}</pre>
            </>
          ) : (
            <p className="muted">{tr("mail.pick")}</p>
          )}
        </div>
      </div>

      <p className="muted">{tr("mail.note")}</p>
    </div>
  );
});

function Composer({
  draft,
  onChange,
  onSend,
  onCancel,
  sending,
  disabled,
}: {
  draft: MailDraft;
  onChange: (d: MailDraft) => void;
  onSend: () => void;
  onCancel: () => void;
  sending: boolean;
  disabled: boolean;
}) {
  const tr = useT();
  const nonAscii = hasNonAscii(draft.subject) || hasNonAscii(draft.body);
  return (
    <div className="editor">
      <h3>{draft.replyTo ? tr("mail.replyTitle", { n: draft.replyTo }) : tr("mail.newTitle")}</h3>
      {!draft.replyTo && (
        <div className="row">
          <label className="grow">
            {draft.isPrivate ? tr("mail.recipient") : tr("mail.bulletinCat")}
            <input
              value={draft.to}
              placeholder={draft.isPrivate ? "G1TLH" : "ALL"}
              list="bulletin-cats"
              onChange={(e) => onChange({ ...draft, to: e.target.value })}
            />
            <datalist id="bulletin-cats">
              {BULLETIN_CATS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={draft.isPrivate}
              onChange={(e) => onChange({ ...draft, isPrivate: e.target.checked })}
            />
            {tr("mail.private")}
          </label>
        </div>
      )}
      <label>
        {tr("mail.subject")}
        <input
          value={draft.subject}
          maxLength={60}
          onChange={(e) => onChange({ ...draft, subject: e.target.value })}
        />
      </label>
      <label>
        {tr("mail.body")}
        <textarea
          rows={10}
          value={draft.body}
          onChange={(e) => onChange({ ...draft, body: e.target.value })}
        />
      </label>
      {nonAscii && (
        <p className="mail-ascii-warn">
          {tr("mail.asciiWarn")}{" "}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...draft,
                subject: toAsciiText(draft.subject),
                body: toAsciiText(draft.body),
              })
            }
          >
            {tr("mail.asciiConvert")}
          </button>
        </p>
      )}
      <div className="row end">
        <button onClick={onCancel}>{tr("common.cancel")}</button>
        <button
          className="primary"
          disabled={
            disabled || sending || (!draft.replyTo && !draft.to.trim()) || !draft.body.trim()
          }
          onClick={onSend}
        >
          {sending ? tr("mail.sending") : tr("common.send")}
        </button>
      </div>
    </div>
  );
}
