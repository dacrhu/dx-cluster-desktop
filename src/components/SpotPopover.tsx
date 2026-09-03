import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { useCluster } from "@/store/useCluster";
import { modeClass, modeLabel } from "@/lib/mode";
import { fmtAge } from "@/lib/format";
import { prepareQso, tuneToSpot } from "@/lib/engage";
import type { EnrichedSpot, SpotAction } from "@/lib/types";

/**
 * The fact card shown when a spot is left-clicked in the Spots table or the
 * Bandmap — mirrors the Map's `.wm-popup`. Carries the "Tune radio" /
 * "Prepare QSO" buttons and the shared context-menu actions.
 */
export function SpotPopover({
  spot,
  x,
  y,
  actions,
  onClose,
}: {
  spot: EnrichedSpot;
  x: number;
  y: number;
  actions: SpotAction[];
  onClose: () => void;
}) {
  const tr = useT();
  const ref = useRef<HTMLDivElement>(null);
  const catEnabled = useCluster((s) => s.catEnabled);
  const logPushEnabled = useCluster((s) => s.logPushEnabled);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const rows: [string, string][] = [
    [tr("col.khz"), `${spot.freq_khz.toFixed(1)}${spot.band ? `  ·  ${spot.band}` : ""}`],
    [tr("col.mode"), modeLabel(spot.mode, spot.comment)],
  ];
  if (spot.dx) rows.push([tr("col.dxcc"), `${spot.dx.dxcc_name}  ·  CQ ${spot.dx.cq_zone}`]);
  rows.push([
    tr("col.spotter"),
    spot.by ? `${spot.spotter}  ·  ${spot.by.dxcc_name}` : spot.spotter,
  ]);
  if (spot.dx?.bearing_deg != null)
    rows.push([
      tr("col.beam"),
      `${Math.round(spot.dx.bearing_deg)}°${
        spot.dx.distance_km != null ? `  ·  ${Math.round(spot.dx.distance_km)} km` : ""
      }`,
    ]);
  rows.push([tr("col.age"), `${fmtAge(spot.received_at)}  ·  ${spot.time_hhmm} UTC`]);

  // Provisional position; corrected to the card's real size before paint so it
  // never spills off-screen (e.g. clicking a spot at the bottom of a band lane).
  const [pos, setPos] = useState({ left: x + 8, top: y + 8 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x + 8, window.innerWidth - width - 8)),
      // flip above the click if it wouldn't fit below
      top: Math.max(8, Math.min(y + 8, window.innerHeight - height - 8)),
    });
  }, [x, y]);

  return (
    <div className="spot-pop" ref={ref} style={{ left: pos.left, top: pos.top }}>
      <div className="spot-pop-head">
        <span className={`spot-pop-call ${modeClass(spot.mode)}`}>{spot.dx_call}</span>
        <button className="spot-pop-x" onClick={onClose} aria-label={tr("common.close")}>
          ×
        </button>
      </div>
      <dl className="spot-pop-rows">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {spot.comment && <p className="spot-pop-comment">{spot.comment}</p>}
      {(catEnabled || logPushEnabled) && (
        <div className="spot-pop-engage">
          {catEnabled && (
            <button onClick={() => void tuneToSpot(spot)}>{tr("spots.menu.tuneRadio")}</button>
          )}
          {logPushEnabled && (
            <button onClick={() => void prepareQso(spot)}>{tr("spots.menu.prepQso")}</button>
          )}
        </div>
      )}
      {actions.length > 0 && (
        <ul className="spot-pop-actions">
          {actions.map((a) => (
            <li
              key={a.label}
              onClick={() => {
                a.run(spot);
                onClose();
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
