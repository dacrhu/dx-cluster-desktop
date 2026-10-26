import { memo, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useCluster, useOnlineId } from "@/store/useCluster";
import { fmtAge, fmtUtc } from "@/lib/format";
import { matchTerms } from "@/lib/util";
import { annMuteKey, useVisibleAnnouncements, type AnnMute } from "@/lib/announceFilter";
import { patchSettings } from "@/lib/persist";
import type { StoredAnnounce } from "@/lib/types";
import { useT } from "@/i18n";
import * as ipc from "@/lib/ipc";
import { runQuery } from "@/lib/ipc";

export const AnnouncementsPanel = memo(function AnnouncementsPanel() {
  const tr = useT();
  const loadAnnouncements = useCluster((s) => s.loadAnnouncements);
  const spam = useCluster(
    useShallow((s) => ({
      hideNodeAds: s.annHideNodeAds,
      collapseRepeats: s.annCollapseRepeats,
      muted: s.annMuted,
      setHideNodeAds: s.setAnnHideNodeAds,
      setCollapseRepeats: s.setAnnCollapseRepeats,
      setMuted: s.setAnnMuted,
    })),
  );
  const onlineId = useOnlineId();

  const [tab, setTab] = useState<"all" | "wx">("all");
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [full, setFull] = useState(false);
  const [isWx, setIsWx] = useState(false);
  const [sent, setSent] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [showMuted, setShowMuted] = useState(false);
  const filtered = useVisibleAnnouncements(showHidden);

  function mute(a: StoredAnnounce, kind: AnnMute["kind"]) {
    const key = annMuteKey(a, kind);
    if (!key || spam.muted.some((m) => m.kind === kind && m.key === key)) return;
    const next = [...spam.muted, { kind, key }];
    spam.setMuted(next);
    void patchSettings({ annMuted: next });
  }
  function unmute(m: AnnMute) {
    const next = spam.muted.filter((x) => !(x.kind === m.kind && x.key === m.key));
    spam.setMuted(next);
    void patchSettings({ annMuted: next });
  }

  async function fetchHistory() {
    if (!onlineId) return;
    setFetching(true);
    setFetchMsg("");
    try {
      const lines = await runQuery(onlineId, "sh/ann", 6000);
      const { imported, announcements: merged } = await ipc.importAnnounceHistory(
        onlineId,
        lines,
        500,
      );
      loadAnnouncements(merged);
      setFetchMsg(imported > 0 ? tr("ann.imported", { n: imported }) : tr("ann.noNew"));
    } catch (e) {
      setFetchMsg(String(e));
    } finally {
      setFetching(false);
    }
  }

  const rows = useMemo(() => {
    const q = search.trim();
    return filtered.rows.filter(({ a }) => {
      if (tab === "wx" && !a.is_wx) return false;
      if (q && !matchTerms(`${a.sender} ${a.target} ${a.text}`, q)) return false;
      return true;
    });
  }, [filtered, tab, search]);

  async function send() {
    if (!onlineId || !text.trim()) return;
    try {
      const cmd = isWx
        ? await ipc.postWx(onlineId, text)
        : await ipc.postAnnounce(onlineId, text, full);
      setSent(tr("ann.sentAs", { cmd }));
      setText("");
    } catch (e) {
      setSent(String(e));
    }
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{tr("ann.title")}</h2>
        <div className="tabs">
          <button className={tab === "all" ? "tab active" : "tab"} onClick={() => setTab("all")}>
            {tr("ann.all")}
          </button>
          <button className={tab === "wx" ? "tab active" : "tab"} onClick={() => setTab("wx")}>
            {tr("ann.wx")}
          </button>
        </div>
        <span className="grow" />
        <button disabled={!onlineId || fetching} onClick={fetchHistory}>
          {fetching ? tr("filters.fetching") : tr("ann.fetchHistory")}
        </button>
        {fetchMsg && <span className="muted">{fetchMsg}</span>}
      </div>

      <div className="post-spot">
        <span>{isWx ? tr("ann.sendWx") : tr("ann.sendAnn")}</span>
        <input
          className="grow"
          placeholder={isWx ? tr("ann.wxPlaceholder") : tr("ann.annPlaceholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        {!isWx && (
          <label className="inline">
            <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} />
            {tr("ann.full")}
          </label>
        )}
        <label className="inline">
          <input type="checkbox" checked={isWx} onChange={(e) => setIsWx(e.target.checked)} />
          WX
        </label>
        <button className="primary" disabled={!onlineId || !text.trim()} onClick={send}>
          {tr("common.send")}
        </button>
        {sent && <span className="muted">{sent}</span>}
      </div>

      <input
        className="search"
        placeholder={tr("ann.searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        spellCheck={false}
      />

      <div className="ann-filterbar">
        <label className="inline">
          <input
            type="checkbox"
            checked={spam.hideNodeAds}
            onChange={(e) => {
              spam.setHideNodeAds(e.target.checked);
              void patchSettings({ annHideNodeAds: e.target.checked });
            }}
          />
          {tr("ann.hideNodeAds")}
        </label>
        <label className="inline">
          <input
            type="checkbox"
            checked={spam.collapseRepeats}
            onChange={(e) => {
              spam.setCollapseRepeats(e.target.checked);
              void patchSettings({ annCollapseRepeats: e.target.checked });
            }}
          />
          {tr("ann.collapseRepeats")}
        </label>
        {filtered.hidden > 0 && (
          <label className="inline">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
            />
            {tr("ann.showHidden", { n: filtered.hidden })}
          </label>
        )}
        <span className="grow" />
        <button onClick={() => setShowMuted((v) => !v)}>
          {tr("ann.mutedRules", { n: spam.muted.length })}
        </button>
      </div>
      {showMuted && (
        <ul className="ann-muted">
          {spam.muted.length === 0 && <li className="muted">{tr("ann.mutedNone")}</li>}
          {spam.muted.map((m) => (
            <li key={`${m.kind}:${m.key}`}>
              <span className="tag">
                {tr(m.kind === "sender" ? "ann.muteSenderTag" : "ann.muteTextTag")}
              </span>
              <span className="mono grow">{m.key}</span>
              <button title={tr("ann.unmute")} onClick={() => unmute(m)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>{tr("col.age")}</th>
            <th>{tr("col.utc")}</th>
            <th>{tr("col.sender")}</th>
            <th>{tr("col.target")}</th>
            <th>{tr("col.text")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                {tr("ann.none")}
              </td>
            </tr>
          )}
          {rows.map(({ a, count, times, spam: isSpam }) => (
            <tr key={a.id} className={`${a.is_wx ? "wx" : ""}${isSpam ? " ann-spam" : ""}`}>
              <td>{fmtAge(a.received_at)}</td>
              <td className="mono">{fmtUtc(a.received_at)}</td>
              <td className="mono">{a.sender}</td>
              <td>{a.target}</td>
              <td>
                {a.text}
                {count > 1 && (
                  <span
                    className="ann-count"
                    title={times.map((t) => `${fmtUtc(t)} (${fmtAge(t)})`).join("\n")}
                  >
                    ×{count}
                  </span>
                )}
              </td>
              <td className="ann-actions">
                {!a.is_wx && (
                  <>
                    <button
                      className="ann-mute"
                      title={tr("ann.muteText")}
                      onClick={() => mute(a, "text")}
                    >
                      ⊘
                    </button>
                    <button
                      className="ann-mute"
                      title={tr("ann.muteSender", { call: annMuteKey(a, "sender") })}
                      onClick={() => mute(a, "sender")}
                    >
                      ⊘⊘
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
