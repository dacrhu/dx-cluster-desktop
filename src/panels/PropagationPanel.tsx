import { useEffect, useState } from "react";
import { useCluster, useOnlineId } from "@/store/useCluster";
import { fmtAge, fmtUtc } from "@/lib/format";
import { useT } from "@/i18n";
import { runQuery } from "@/lib/ipc";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function PropagationPanel() {
  const tr = useT();
  const { wwv, wcy } = useCluster();
  const onlineId = useOnlineId();
  const [showTable, setShowTable] = useState<string[] | null>(null);
  const [fetching, setFetching] = useState(false);

  const latestWwv = wwv[0];
  const latestWcy = wcy[0];

  // Auto-request a WWV history table once on first connect if we have nothing.
  useEffect(() => {
    if (onlineId && wwv.length === 0 && !fetching && showTable === null) {
      void fetchHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineId]);

  async function fetchHistory() {
    if (!onlineId) return;
    setFetching(true);
    try {
      const [w, c] = await Promise.all([
        runQuery(onlineId, "sh/wwv 10"),
        runQuery(onlineId, "sh/wcy 10"),
      ]);
      setShowTable([...w, "", ...c]);
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{tr("prop.title")}</h2>
        <button disabled={!onlineId || fetching} onClick={fetchHistory}>
          {fetching ? tr("filters.fetching") : tr("prop.fetchHistory")}
        </button>
      </div>

      <div className="stat-row">
        {latestWwv ? (
          <>
            <Stat label="SFI" value={latestWwv.sfi} hint={tr("prop.solarFlux")} />
            <Stat label="A" value={latestWwv.a} />
            <Stat label="K" value={latestWwv.k} />
            <Stat
              label="WWV"
              value={`${latestWwv.sender} <${latestWwv.hour}z>`}
              hint={`${fmtAge(latestWwv.received_at)} · ${latestWwv.forecast}`}
            />
          </>
        ) : (
          <p className="muted">{tr("prop.noWwv")}</p>
        )}
      </div>

      {latestWcy && (
        <div className="stat-row">
          <Stat label="SFI" value={latestWcy.sfi} />
          <Stat label="A" value={latestWcy.a} />
          <Stat label="K / exp" value={`${latestWcy.k} / ${latestWcy.expk}`} />
          <Stat label="R" value={latestWcy.r} hint={tr("prop.sunspots")} />
          <Stat label="SA" value={latestWcy.sa} hint={tr("prop.solarActivity")} />
          <Stat label="GMF" value={latestWcy.gmf} hint={tr("prop.geomagField")} />
          <Stat label={tr("prop.aurora")} value={latestWcy.aurora} />
          <Stat label="WCY" value={latestWcy.sender} hint={fmtAge(latestWcy.received_at)} />
        </div>
      )}

      {showTable && showTable.length > 0 && <pre className="raw-block">{showTable.join("\n")}</pre>}

      <h3>{tr("prop.wwvHistory")}</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>{tr("col.utc")}</th>
            <th>{tr("col.hour")}</th>
            <th>SFI</th>
            <th>A</th>
            <th>K</th>
            <th>{tr("col.forecast")}</th>
            <th>{tr("col.sender")}</th>
          </tr>
        </thead>
        <tbody>
          {wwv.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                {tr("prop.noData")}
              </td>
            </tr>
          )}
          {wwv.map((w) => (
            <tr key={w.id}>
              <td className="mono">{fmtUtc(w.received_at)}</td>
              <td>{w.hour}z</td>
              <td>{w.sfi}</td>
              <td>{w.a}</td>
              <td>{w.k}</td>
              <td>{w.forecast}</td>
              <td className="mono">{w.sender}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {wcy.length > 0 && (
        <>
          <h3>{tr("prop.wcyHistory")}</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>{tr("col.utc")}</th>
                <th>{tr("col.hour")}</th>
                <th>SFI</th>
                <th>A</th>
                <th>K</th>
                <th>R</th>
                <th>SA</th>
                <th>GMF</th>
                <th>Au</th>
              </tr>
            </thead>
            <tbody>
              {wcy.map((w) => (
                <tr key={w.id}>
                  <td className="mono">{fmtUtc(w.received_at)}</td>
                  <td>{w.hour}z</td>
                  <td>{w.sfi}</td>
                  <td>{w.a}</td>
                  <td>{w.k}</td>
                  <td>{w.r}</td>
                  <td>{w.sa}</td>
                  <td>{w.gmf}</td>
                  <td>{w.aurora}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="muted">{tr("prop.note")}</p>
    </div>
  );
}
