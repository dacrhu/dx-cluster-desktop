import { memo, useEffect, useState } from "react";
import { useCluster, useOnlineId } from "@/store/useCluster";
import { useT } from "@/i18n";
import { runQuery, parseHistSpots, searchLocalSpots, shDxCommand } from "@/lib/ipc";
import { fmtAge, fmtHhmm } from "@/lib/format";
import { modeClass, modeLabel } from "@/lib/mode";
import { ALL_BANDS, type EnrichedSpot, type HistRow } from "@/lib/types";

interface QueryCmd {
  cmd: string;
  /** i18n key for the human label (`q.<cmd>`). */
  argKey: string | null;
  needsArg: boolean;
}

const QUERY_COMMANDS: QueryCmd[] = [
  { cmd: "sh/prefix", argKey: "q.arg.callOrPrefix", needsArg: true },
  { cmd: "sh/heading", argKey: "q.arg.callOrPrefix", needsArg: true },
  { cmd: "sh/qra", argKey: "q.arg.locatorPair", needsArg: true },
  { cmd: "sh/sun", argKey: "q.arg.callOrPrefix", needsArg: true },
  { cmd: "sh/moon", argKey: "q.arg.callOrPrefix", needsArg: true },
  { cmd: "sh/muf", argKey: "q.arg.locator", needsArg: true },
  { cmd: "sh/time", argKey: "q.arg.timeCall", needsArg: false },
  { cmd: "sh/dxqsl", argKey: "q.arg.call", needsArg: true },
  { cmd: "sh/db0sdx", argKey: "q.arg.call", needsArg: true },
  { cmd: "sh/ik3qar", argKey: "q.arg.call", needsArg: true },
  { cmd: "sh/route", argKey: "q.arg.call", needsArg: true },
  { cmd: "sh/dxcc", argKey: "q.arg.dxccPrefix", needsArg: true },
  { cmd: "sh/dxstats", argKey: null, needsArg: false },
  { cmd: "sh/configuration/nodes", argKey: null, needsArg: false },
];

export const ToolsPanel = memo(function ToolsPanel() {
  const tr = useT();
  const onlineId = useOnlineId();
  const targetSoftware = useCluster((s) =>
    onlineId ? (s.connections[onlineId]?.profile.software ?? "dx_spider") : "dx_spider",
  );

  const [cmdIdx, setCmdIdx] = useState(0);
  const [arg, setArg] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string[] | null>(null);
  const [note, setNote] = useState("");

  const active = QUERY_COMMANDS[cmdIdx];
  const argLabel = active.argKey ? tr(active.argKey) : "";

  async function run() {
    if (!onlineId) return;
    const full = `${active.cmd}${arg.trim() ? ` ${arg.trim()}` : ""}`;
    setRunning(true);
    setResult(null);
    setNote("");
    try {
      const lines = await runQuery(onlineId, full, 6000);
      setResult(lines);
      if (lines.some((l) => /^(unknown command|sorry)/i.test(l.trim()))) {
        setNote(tr("tools.notSupported", { cmd: active.cmd }));
      }
    } finally {
      setRunning(false);
    }
  }

  // --- SH/DX historical ---
  const [dxCount, setDxCount] = useState("25");
  const [dxBand, setDxBand] = useState("");
  const [dxCall, setDxCall] = useState("");
  const [dxBy, setDxBy] = useState("");
  const [dxHours, setDxHours] = useState("");
  const [dxRunning, setDxRunning] = useState(false);
  const [dxNote, setDxNote] = useState("");
  const [nodeRows, setNodeRows] = useState<HistRow[] | null>(null);
  const [localRows, setLocalRows] = useState<EnrichedSpot[] | null>(null);

  // The node query string is built in Rust (dialect-aware) — recomputed as the
  // form or the target node's software changes, so the button label and the
  // actual send always agree.
  const [dxCmd, setDxCmd] = useState("SH/DX");
  useEffect(() => {
    const n = Number(dxCount.trim());
    shDxCommand(
      {
        count: Number.isFinite(n) && n > 0 ? n : undefined,
        band: dxBand || undefined,
        call: dxCall.trim() || undefined,
        by: dxBy.trim() || undefined,
        hours: dxHours.trim() ? Number(dxHours.trim()) || undefined : undefined,
      },
      targetSoftware,
    )
      .then(setDxCmd)
      .catch(() => {});
  }, [dxCount, dxBand, dxCall, dxBy, dxHours, targetSoftware]);

  async function runNodeDx() {
    if (!onlineId) return;
    setDxRunning(true);
    setNodeRows(null);
    setLocalRows(null);
    setDxNote("");
    try {
      const lines = await runQuery(onlineId, dxCmd, 6000);
      setNodeRows(await parseHistSpots(lines));
      if (lines.some((l) => /^(unknown command|sorry|error)/i.test(l.trim())))
        setDxNote(tr("tools.notSupported", { cmd: dxCmd }));
    } finally {
      setDxRunning(false);
    }
  }

  async function runLocalDx() {
    setDxRunning(true);
    setNodeRows(null);
    setLocalRows(null);
    try {
      setLocalRows(
        await searchLocalSpots({
          dxPrefix: dxCall,
          band: dxBand,
          spotterPrefix: dxBy,
          sinceHours: dxHours.trim() ? Number(dxHours) : undefined,
          limit: Number(dxCount) || 100,
        }),
      );
    } finally {
      setDxRunning(false);
    }
  }

  return (
    <div className="panel tools-panel">
      <h2>{tr("tools.title")}</h2>

      <div className="tool-block">
        <div className="row">
          <label className="grow">
            {tr("tools.command")}
            <select value={cmdIdx} onChange={(e) => setCmdIdx(Number(e.target.value))}>
              {QUERY_COMMANDS.map((c, i) => (
                <option key={c.cmd} value={i}>
                  {c.cmd} — {tr(`q.${c.cmd}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="grow">
            {argLabel || tr("tools.noArg")}
            <input
              value={arg}
              placeholder={argLabel}
              disabled={!active.argKey}
              onChange={(e) => setArg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
            />
          </label>
          <button
            className="primary"
            disabled={!onlineId || running || (active.needsArg && !arg.trim())}
            onClick={run}
          >
            {running ? "…" : tr("common.run")}
          </button>
        </div>
        {note && <p className="warn">{note}</p>}
        {result && (
          <pre className="raw-block">
            {result.length ? result.join("\n") : tr("tools.noResponse")}
          </pre>
        )}
      </div>

      <div className="tool-block">
        <h3>{tr("tools.histTitle")}</h3>
        <div className="row">
          <label>
            {tr("tools.count")}
            <input
              style={{ width: 70 }}
              value={dxCount}
              onChange={(e) => setDxCount(e.target.value)}
            />
          </label>
          <label>
            {tr("col.band")}
            <select value={dxBand} onChange={(e) => setDxBand(e.target.value)}>
              <option value="">{tr("common.any")}</option>
              {ALL_BANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("tools.dxCall")}
            <input value={dxCall} onChange={(e) => setDxCall(e.target.value)} />
          </label>
          <label>
            {tr("col.spotter")}
            <input value={dxBy} onChange={(e) => setDxBy(e.target.value)} />
          </label>
          <label>
            {tr("tools.lastHours")}
            <input
              style={{ width: 70 }}
              value={dxHours}
              onChange={(e) => setDxHours(e.target.value)}
            />
          </label>
        </div>
        <div className="row">
          <button className="primary" disabled={!onlineId || dxRunning} onClick={runNodeDx}>
            {tr("tools.fromNode", { cmd: dxCmd })}
          </button>
          <button disabled={dxRunning} onClick={runLocalDx}>
            {tr("tools.fromLocal")}
          </button>
        </div>

        {dxNote && <p className="warn">{dxNote}</p>}
        {nodeRows && <HistTable rows={nodeRows} />}
        {localRows && <LocalTable rows={localRows} />}
      </div>
    </div>
  );
});

function HistTable({ rows }: { rows: HistRow[] }) {
  const tr = useT();
  if (rows.length === 0) return <p className="muted">{tr("tools.noHits")}</p>;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>{tr("col.utc")}</th>
          <th>{tr("col.band")}</th>
          <th>{tr("col.khz")}</th>
          <th>{tr("col.dx")}</th>
          <th>{tr("col.dxcc")}</th>
          <th>{tr("col.mode")}</th>
          <th>{tr("col.comment")}</th>
          <th>{tr("col.spotter")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{fmtHhmm(r.time)}</td>
            <td>{r.band ?? "—"}</td>
            <td className="mono">{r.freq_khz.toFixed(1)}</td>
            <td className="mono">{r.dx_call}</td>
            <td>{r.dxcc ?? "—"}</td>
            <td className={`mode-tag ${modeClass(r.mode)}`}>{modeLabel(r.mode, r.comment)}</td>
            <td>{r.comment}</td>
            <td className="mono">{r.spotter}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LocalTable({ rows }: { rows: EnrichedSpot[] }) {
  const tr = useT();
  if (rows.length === 0) return <p className="muted">{tr("tools.noLocal")}</p>;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>{tr("col.age")}</th>
          <th>{tr("col.utc")}</th>
          <th>{tr("col.band")}</th>
          <th>{tr("col.khz")}</th>
          <th>{tr("col.dx")}</th>
          <th>{tr("col.dxcc")}</th>
          <th>{tr("col.mode")}</th>
          <th>{tr("col.comment")}</th>
          <th>{tr("col.spotter")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.id}>
            <td>{fmtAge(s.received_at)}</td>
            <td>{fmtHhmm(s.time_hhmm)}</td>
            <td>{s.band ?? "—"}</td>
            <td className="mono">{s.freq_khz.toFixed(1)}</td>
            <td className="mono">{s.dx_call}</td>
            <td>{s.dx?.dxcc_name ?? "—"}</td>
            <td className={`mode-tag ${modeClass(s.mode)}`}>{modeLabel(s.mode, s.comment)}</td>
            <td>{s.comment}</td>
            <td className="mono">{s.spotter}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
