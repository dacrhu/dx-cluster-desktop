import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useT } from "@/i18n";
import { useCluster } from "@/store/useCluster";
import { matchingAlert } from "@/lib/alerts";
import { modeClass, modeLabel } from "@/lib/mode";
import { SpotPopover } from "@/components/SpotPopover";
import type { EnrichedSpot, SpotAction } from "@/lib/types";

export type { SpotAction };

/** Virtual-row height — must match `.spot-row` height in global.css. */
const ROW_H = 28;

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
  const tr = useT();
  const alerts = useCluster((s) => s.alerts);
  const alertsEnabled = useCluster((s) => s.alertsEnabled);
  const activeRules = alertsEnabled ? alerts : [];
  const parentRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; spot: EnrichedSpot } | null>(null);
  const [pop, setPop] = useState<{ x: number; y: number; spot: EnrichedSpot } | null>(null);
  const followFreqKhz = useCluster((s) => s.followFreqKhz);

  // While scrolled away from the top, freeze the list so incoming spots never
  // move what you're reading (like the raw console). `frozen` is the snapshot
  // shown; `null` = live + auto-follow the newest.
  const [frozen, setFrozen] = useState<EnrichedSpot[] | null>(null);
  const shown = frozen ?? spots;

  // Drop a stale snapshot when the live list has diverged a lot (the search /
  // filter changed) — a few spots ageing out is not enough to unfreeze.
  useEffect(() => {
    if (!frozen || frozen.length === 0) return;
    const live = new Set(spots.map((s) => s.id));
    const overlap = frozen.reduce((n, f) => n + (live.has(f.id) ? 1 : 0), 0);
    if (overlap < frozen.length * 0.5) setFrozen(null);
  }, [spots, frozen]);

  const rows = useVirtualizer({
    count: shown.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });

  // "Follow radio": the row nearest the rig's frequency, kept in view.
  const nearIdx = useMemo(() => {
    if (followFreqKhz == null || shown.length === 0) return -1;
    let best = -1;
    let bestD = Infinity;
    shown.forEach((s, i) => {
      const d = Math.abs(s.freq_khz - followFreqKhz);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return bestD <= 5 ? best : -1;
  }, [followFreqKhz, shown]);

  useEffect(() => {
    if (nearIdx >= 0) rows.scrollToIndex(nearIdx, { align: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearIdx]);

  // Snap to the very top once, right after unfreezing via the pill — then the
  // natural top-anchored render keeps the newest spot in view without fighting
  // the user's scroll.
  const snapTop = useRef(false);
  useLayoutEffect(() => {
    if (!frozen && snapTop.current) {
      snapTop.current = false;
      if (parentRef.current) parentRef.current.scrollTop = 0;
    }
  }, [frozen]);

  function onScroll() {
    const el = parentRef.current;
    if (!el) return;
    // 8 px dead-zone so browser/virtualizer scroll jitter at the top doesn't
    // flip the state.
    if (el.scrollTop <= 8) {
      if (frozen) setFrozen(null);
    } else if (!frozen) {
      setFrozen(spots);
    }
  }
  const pending = frozen
    ? (() => {
        const i = spots.findIndex((s) => s.id === frozen[0]?.id);
        return i < 0 ? spots.length : i;
      })()
    : 0;

  function openRow(e: React.MouseEvent, s: EnrichedSpot) {
    setMenu(null);
    setPop({ x: e.clientX, y: e.clientY, spot: s });
  }

  return (
    <div className="spot-table" onClick={() => setMenu(null)}>
      <div className="spot-header">
        <span className="c-age">{tr("col.age")}</span>
        <span className="c-time">{tr("col.utc")}</span>
        <span className="c-band">{tr("col.band")}</span>
        <span className="c-freq">{tr("col.khz")}</span>
        <span className="c-call">{tr("col.dx")}</span>
        <span className="c-dxcc">{tr("col.dxcc")}</span>
        <span className="c-cq">{tr("col.cq")}</span>
        <span className="c-mode">{tr("col.mode")}</span>
        <span className="c-spotter">{tr("col.spotter")}</span>
        <span className="c-comment">{tr("col.comment")}</span>
        <span className="c-beam">{tr("col.beam")}</span>
      </div>

      <div ref={parentRef} className="spot-body" onScroll={onScroll}>
        <div style={{ height: rows.getTotalSize(), position: "relative" }}>
          {rows.getVirtualItems().map((vi) => {
            const s = shown[vi.index];
            const hit = activeRules.length ? matchingAlert(s, activeRules) : null;
            return (
              <div
                key={s.id}
                className={`spot-row actionable${s.is_skimmer ? " skimmer" : ""}${
                  hit ? " alert-hit" : ""
                }${vi.index === nearIdx ? " radio-near" : ""}`}
                style={{ transform: `translateY(${vi.start}px)` }}
                title={hit ? hit.label || tr("alerts.title") : undefined}
                onClick={(e) => openRow(e, s)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setPop(null);
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
                <span className={`c-mode mode-tag ${modeClass(s.mode)}`}>
                  {modeLabel(s.mode, s.comment)}
                </span>
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
      {frozen && (
        <button
          className="console-jump"
          title={tr("spots.jumpLatest")}
          onClick={() => {
            snapTop.current = true;
            setFrozen(null);
          }}
        >
          ↑ {pending > 0 ? pending : ""}
        </button>
      )}

      {pop && (
        <SpotPopover
          spot={pop.spot}
          x={pop.x}
          y={pop.y}
          actions={actions}
          onClose={() => setPop(null)}
        />
      )}

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
