import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useCluster, useOnlineId } from "@/store/useCluster";
import { useT } from "@/i18n";
import * as ipc from "@/lib/ipc";
import { runQuery } from "@/lib/ipc";
import type { StationInfo } from "@/lib/types";

export const UsersPanel = memo(function UsersPanel() {
  const tr = useT();
  const onlineId = useOnlineId();
  const setPendingTalk = useCluster((s) => s.setPendingTalk);
  const [users, setUsers] = useState<string[]>([]);
  const [buddies, setBuddies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [station, setStation] = useState<StationInfo | null>(null);
  const [stationLoading, setStationLoading] = useState(false);
  const autoDone = useRef(false);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return q ? users.filter((u) => u.includes(q)) : users;
  }, [users, search]);

  // Populate the list automatically on the first connection.
  useEffect(() => {
    if (onlineId && users.length === 0 && !autoDone.current) {
      autoDone.current = true;
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineId]);

  async function refresh() {
    if (!onlineId) return;
    setLoading(true);
    try {
      const [uLines, bLines] = await Promise.all([
        runQuery(onlineId, "sh/users"),
        runQuery(onlineId, "sh/buddy"),
      ]);
      setUsers(await ipc.parseUsers(uLines));
      setBuddies(await ipc.parseUsers(bLines));
    } finally {
      setLoading(false);
    }
  }

  async function showStation(call: string) {
    setSelected(call);
    setStation(null);
    if (!onlineId) return;
    setStationLoading(true);
    try {
      const lines = await runQuery(onlineId, `sh/station ${call}`);
      setStation(await ipc.parseStation(lines));
    } finally {
      setStationLoading(false);
    }
  }

  async function toggleBuddy(call: string, add: boolean) {
    if (!onlineId) return;
    await ipc.setBuddy(onlineId, call, add);
    setBuddies((b) => (add ? [...new Set([...b, call])].sort() : b.filter((x) => x !== call)));
  }

  return (
    <div className="panel users-panel">
      <div className="panel-head">
        <h2>{tr("users.title")}</h2>
        <button className="primary" disabled={!onlineId || loading} onClick={refresh}>
          {loading ? tr("users.refreshing") : tr("users.refresh")}
        </button>
      </div>

      {buddies.length > 0 && (
        <div className="buddy-strip">
          <span className="muted">{tr("users.buddy")}</span>
          {buddies.map((b) => (
            <button key={b} className="chip active" onClick={() => showStation(b)}>
              {b}
            </button>
          ))}
        </div>
      )}

      <div className="users-layout">
        <div className="users-list">
          <input
            className="search"
            placeholder={tr("users.filterPlaceholder", { n: users.length })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {users.length === 0 && (
            <p className="muted">
              {loading
                ? tr("users.refreshing")
                : onlineId
                  ? tr("users.clickRefresh")
                  : tr("common.noConnection")}
            </p>
          )}
          <ul>
            {filtered.map((u) => (
              <li key={u} className={u === selected ? "active" : ""} onClick={() => showStation(u)}>
                <span className="mono">{u}</span>
                {buddies.includes(u) && (
                  <span className="buddy-dot" title={tr("users.buddy")}>
                    ★
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="station-detail">
          {!selected && <p className="muted">{tr("users.pick")}</p>}
          {selected && (
            <>
              <div className="panel-head">
                <h3 className="mono">{selected}</h3>
                <button className="primary" onClick={() => setPendingTalk(selected)}>
                  {tr("users.talk")}
                </button>
                {buddies.includes(selected) ? (
                  <button onClick={() => toggleBuddy(selected, false)}>
                    {tr("users.buddyRemove")}
                  </button>
                ) : (
                  <button onClick={() => toggleBuddy(selected, true)}>
                    {tr("users.buddyAdd")}
                  </button>
                )}
              </div>
              {stationLoading && <p className="muted">{tr("common.loading")}</p>}
              {!stationLoading && !station && <p className="muted">{tr("users.noStation")}</p>}
              {station && (
                <table className="data-table">
                  <tbody>
                    {station.fields.map(([k, v]) => (
                      <tr key={k}>
                        <th style={{ width: 130 }}>{k}</th>
                        <td>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});
