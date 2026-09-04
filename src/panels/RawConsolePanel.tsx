import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useCluster } from "@/store/useCluster";
import { useShallow } from "zustand/react/shallow";
import { useT } from "@/i18n";
import * as ipc from "@/lib/ipc";

export const RawConsolePanel = memo(function RawConsolePanel() {
  const tr = useT();
  const { connections, raw } = useCluster(
    useShallow((s) => ({ connections: s.connections, raw: s.raw })),
  );
  const ids = Object.keys(connections);
  const [selected, setSelected] = useState<string>(ids[0] ?? "");
  const [cmd, setCmd] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const consoleRef = useRef<HTMLDivElement>(null);
  // Follow new output only while the view is scrolled to the bottom; scrolling
  // up pauses it, scrolling back down (or the jump button) resumes.
  const [stick, setStick] = useState(true);
  const detachLenRef = useRef(0);

  useEffect(() => {
    if (!selected && ids.length) setSelected(ids[0]);
  }, [ids, selected]);

  const lines = useMemo(() => raw[selected] ?? [], [raw, selected]);

  useEffect(() => setStick(true), [selected]);

  useEffect(() => {
    if (stick && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [lines.length, stick, selected]);

  function onConsoleScroll() {
    const el = consoleRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setStick((prev) => {
      if (prev && !atBottom) detachLenRef.current = lines.length;
      return atBottom;
    });
  }
  const pending = stick ? 0 : Math.max(0, lines.length - detachLenRef.current);

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
        <h2>{tr("raw.title")}</h2>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {ids.length === 0 && <option value="">{tr("raw.noConnection")}</option>}
          {ids.map((id) => (
            <option key={id} value={id}>
              {id} — {connections[id]?.state}
            </option>
          ))}
        </select>
      </div>
      <p className="muted">{tr("raw.note")}</p>

      <div className="console-wrap">
        <div className="console" ref={consoleRef} onScroll={onConsoleScroll}>
          {lines.map((l, i) => (
            <div key={i} className={l.dir === "out" ? "cline out" : "cline in"}>
              <span className="mono">{l.dir === "out" ? "» " : "  "}</span>
              <span className="mono">{l.text}</span>
            </div>
          ))}
        </div>
        {!stick && (
          <button
            className="console-jump"
            title={tr("raw.jumpLatest")}
            onClick={() => setStick(true)}
          >
            ↓ {pending > 0 ? pending : ""}
          </button>
        )}
      </div>

      <div className="console-input">
        <input
          className="mono grow"
          placeholder={online ? tr("raw.cmdPlaceholder") : tr("common.noConnection")}
          value={cmd}
          disabled={!online}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={onKey}
        />
        <button className="primary" disabled={!online} onClick={send}>
          {tr("common.send")}
        </button>
      </div>
    </div>
  );
});
