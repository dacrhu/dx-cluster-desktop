import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n";
import { useCluster } from "@/store/useCluster";
import { modeClass, modeLabel } from "@/lib/mode";
import { fmtAge } from "@/lib/format";
import { prepareQso, tuneSplitToSpot, tuneToSpot } from "@/lib/engage";
import { qsxFromComment } from "@/lib/split";
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

  const qsx = catEnabled && spot.comment ? qsxFromComment(spot.comment, spot.freq_khz) : null;

  const rows: [string, string][] = [
    [tr("col.khz"), `${spot.freq_khz.toFixed(1)}${spot.band ? `  ·  ${spot.band}` : ""}`],
    [tr("col.mode"), modeLabel(spot.mode, spot.comment)],
  ];
  if (qsx != null) {
    const d = qsx - spot.freq_khz;
    rows.push([tr("col.split"), `${qsx.toFixed(1)}  ·  ${d > 0 ? "+" : ""}${d.toFixed(1)}`]);
  }
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

  // Rendered into <body> — not as a descendant of the Spots table / Bandmap
  // lanes — so it always paints above them regardless of any ancestor's own
  // stacking context (e.g. a Bandmap `.dimmed` lane's `opacity`, which would
  // otherwise trap this element's z-index inside that lane's local stacking
  // order and let a later sibling lane's markers show over its corner).
  return createPortal(
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
            <button className="primary" onClick={() => void tuneToSpot(spot)}>
              <TuneIcon />
              {tr("spots.menu.tuneRadio")}
            </button>
          )}
          {catEnabled && qsx != null && (
            <button onClick={() => void tuneSplitToSpot(spot)}>
              {tr("spots.menu.tuneSplit", { f: qsx.toFixed(1) })}
            </button>
          )}
          {logPushEnabled && (
            <button className="primary" onClick={() => void prepareQso(spot)}>
              <LogIcon />
              {tr("spots.menu.prepQso")}
            </button>
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
    </div>,
    document.body,
  );
}

/** Antenna broadcasting a signal — used on the "Tune radio" button. */
export function TuneIcon() {
  return (
    <svg
      className="spot-pop-btn-icon"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    >
      <circle cx="8" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <path d="M8 12V7" />
      <path d="M5 9a4 4 0 0 1 6 0" />
      <path d="M3 7a7 7 0 0 1 10 0" />
    </svg>
  );
}

/** Paper with an outbound arrow — used on the "Prepare QSO" button (pushes to the logger). */
export function LogIcon() {
  return (
    <svg
      className="spot-pop-btn-icon"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.5" y="2.5" width="7.5" height="11" rx="1" />
      <path d="M6.5 8h6.5M10.5 5.5 13.5 8l-3 2.5" />
    </svg>
  );
}
