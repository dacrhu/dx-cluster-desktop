import { useEffect, useId, useRef, useState } from "react";
import { useCluster } from "@/store/useCluster";
import { patchSettings } from "@/lib/persist";
import { BANDMAP_BANDS } from "@/lib/bands";
import { useClampPopover } from "@/lib/util";
import { useT } from "@/i18n";

/** Band picker for the "band open from QTH" map layer — same chip + popover
 *  look as `MapLayers`, so switching band is one click away in the quickbar. */
export function PathOpenBand() {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const titleId = useId();
  const { ref: popRef, style: popStyle } = useClampPopover(open);
  const band = useCluster((s) => s.mapPathOpenBand);
  const setBand = useCluster((s) => s.setMapPathOpenBand);

  // The rig's band (CAT) — selecting the label keeps this from re-rendering on
  // every VFO tick. When it *changes*, the map follows once; a manual pick in
  // the popover afterwards sticks until the rig changes band again.
  const rigBand = useCluster((s) => {
    const khz = s.rigVfo ? s.rigVfo.freqHz / 1000 : null;
    return khz == null
      ? null
      : (BANDMAP_BANDS.find((b) => khz >= b.lowKhz && khz <= b.highKhz)?.label ?? null);
  });
  const lastRigBand = useRef<string | null>(null);
  useEffect(() => {
    if (rigBand === lastRigBand.current) return;
    const first = lastRigBand.current === null;
    lastRigBand.current = rigBand;
    // The first reading after connect only seeds the tracker (no jump on startup).
    if (first || !rigBand) return;
    setBand(rigBand);
    void patchSettings({ mapPathOpenBand: rigBand });
  }, [rigBand, setBand]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="ml" ref={wrap}>
      <button
        type="button"
        className={open ? "chip active" : "chip"}
        aria-expanded={open}
        title={tr("map.pathOpenHint")}
        onClick={() => setOpen((v) => !v)}
      >
        {tr("map.pathOpenBandLabel")}: {band} ▾
      </button>
      {open && (
        <div
          className="ml-pop path-band-pop"
          role="dialog"
          aria-labelledby={titleId}
          ref={popRef}
          style={popStyle}
        >
          <div className="qh-head">
            <strong id={titleId}>{tr("map.pathOpenBandLabel")}</strong>
            <button type="button" className="chip" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="band-buttons">
            {BANDMAP_BANDS.filter((b) => b.highKhz < 40000).map((b) => (
              <button
                key={b.label}
                type="button"
                className={b.label === band ? "chip active" : "chip"}
                onClick={() => {
                  setBand(b.label);
                  void patchSettings({ mapPathOpenBand: b.label });
                  setOpen(false);
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}
