import { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { EnrichedSpot } from "@/lib/types";

export interface SpotAction {
  label: string;
  run: (s: EnrichedSpot) => void;
}

function fmtFreq(khz: number) {
  return khz.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function fmtTime(hhmm: string) {
  return hhmm.length === 4 ? `${hhmm.slice(0, 2)}:${hhmm.slice(2)}` : hhmm;
}
function fmtAge(unix: number) {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - unix));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export function SpotTable({ spots, actions }: { spots: EnrichedSpot[]; actions: SpotAction[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; spot: EnrichedSpot } | null>(null);

  const rows = useVirtualizer({
    count: spots.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 12,
  });

  return (
    <div className="spot-table" onClick={() => setMenu(null)}>
      <div className="spot-header">
        <span className="c-age">kor</span>
        <span className="c-time">UTC</span>
        <span className="c-band">sáv</span>
        <span className="c-freq">kHz</span>
        <span className="c-call">DX</span>
        <span className="c-dxcc">DXCC</span>
        <span className="c-cq">CQ</span>
        <span className="c-mode">mód</span>
        <span className="c-spotter">spotter</span>
        <span className="c-comment">megjegyzés</span>
        <span className="c-beam">irány</span>
      </div>

      <div ref={parentRef} className="spot-body">
        <div style={{ height: rows.getTotalSize(), position: "relative" }}>
          {rows.getVirtualItems().map((vi) => {
            const s = spots[vi.index];
            return (
              <div
                key={s.id}
                className={`spot-row${s.is_skimmer ? " skimmer" : ""}`}
                style={{ transform: `translateY(${vi.start}px)` }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ x: e.clientX, y: e.clientY, spot: s });
                }}
              >
                <span className="c-age">{fmtAge(s.received_at)}</span>
                <span className="c-time">{fmtTime(s.time_hhmm)}</span>
                <span className="c-band">{s.band ?? "—"}</span>
                <span className="c-freq mono">{fmtFreq(s.freq_khz)}</span>
                <span className="c-call mono">{s.dx_call}</span>
                <span className="c-dxcc" title={s.dx?.dxcc_name}>
                  {s.dx?.dxcc_name ?? "—"}
                </span>
                <span className="c-cq">{s.dx?.cq_zone ?? ""}</span>
                <span className="c-mode">{s.mode === "UNKNOWN" ? "" : s.mode}</span>
                <span className="c-spotter mono">{s.spotter}</span>
                <span className="c-comment">{s.comment}</span>
                <span className="c-beam">
                  {s.dx?.bearing_deg != null
                    ? `${s.dx.bearing_deg}° ${s.dx.distance_km?.toLocaleString()} km`
                    : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {menu && (
        <ul className="context-menu" style={{ left: menu.x, top: menu.y }}>
          {actions.map((a) => (
            <li
              key={a.label}
              onClick={() => {
                a.run(menu.spot);
                setMenu(null);
              }}
            >
              {a.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
