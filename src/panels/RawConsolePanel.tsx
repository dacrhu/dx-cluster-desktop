import { useEffect, useMemo, useRef, useState } from "react";
import { useCluster } from "@/store/useCluster";
import * as ipc from "@/lib/ipc";

export function RawConsolePanel() {
  const { connections, raw } = useCluster();
  const ids = Object.keys(connections);
  const [selected, setSelected] = useState<string>(ids[0] ?? "");
  const [cmd, setCmd] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected && ids.length) setSelected(ids[0]);
  }, [ids, selected]);

  const lines = useMemo(() => raw[selected] ?? [], [raw, selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lines.length]);

  const online = connections[selected]?.state === "online";

  function send() {
    const line = cmd.trim();
    if (!line || !selected) return;
    ipc.sendRaw(selected, line);
    setHistory((h) => [line, ...h].slice(0, 100));
    setHistIdx(-1);
    setCmd("");
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      send();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.length - 1);
      if (history[next] !== undefined) {
        setHistIdx(next);
        setCmd(history[next]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = histIdx - 1;
      setHistIdx(next);
      setCmd(next >= 0 ? history[next] : "");
    }
  }

  return (
    <div className="panel raw-panel">
      <div className="panel-head">
        <h2>Nyers terminál</h2>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {ids.length === 0 && <option value="">nincs kapcsolat</option>}
          {ids.map((id) => (
            <option key={id} value={id}>
              {id} — {connections[id]?.state}
            </option>
          ))}
        </select>
      </div>
      <p className="muted">
        A GUI minden funkciót lefed — ez a fül a haladó felhasználóknak van, tetszőleges
        cluster-parancshoz.
      </p>

      <div className="console">
        {lines.map((l, i) => (
          <div key={i} className={l.dir === "out" ? "cline out" : "cline in"}>
            <span className="mono">{l.dir === "out" ? "» " : "  "}</span>
            <span className="mono">{l.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="console-input">
        <input
          className="mono grow"
          placeholder={online ? "parancs…" : "(nincs élő kapcsolat)"}
          value={cmd}
          disabled={!online}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={onKey}
        />
        <button className="primary" disabled={!online} onClick={send}>
          Küldés
        </button>
      </div>
    </div>
  );
}
