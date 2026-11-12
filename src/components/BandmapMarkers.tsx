import { useEffect, useId, useRef, useState } from "react";
import { useCluster } from "@/store/useCluster";
import { patchSettings } from "@/lib/persist";
import { BANDMAP_BANDS, OPTIONAL_MARKER_KINDS, type CustomMarker } from "@/lib/bands";
import { useClampPopover } from "@/lib/util";
import { useT } from "@/i18n";

const kindName = (k: string) => (k === "freedv" ? "FreeDV" : k.toUpperCase());

/** "Markers ▾" popover for the Bandmap quickbar: toggle the optional operating-
 *  frequency markers (FT8, SSTV, …) and manage custom ones. SOS + IBP are fixed
 *  and listed here only for information. Modelled on `MapLayers`. */
export function BandmapMarkers() {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const titleId = useId();
  const { ref: popRef, style: popStyle } = useClampPopover(open);

  const enabled = useCluster((s) => s.bandmapMarkers);
  const setEnabled = useCluster((s) => s.setBandmapMarkers);
  const custom = useCluster((s) => s.customMarkers);
  const setCustom = useCluster((s) => s.setCustomMarkers);

  const [name, setName] = useState("");
  const [khz, setKhz] = useState("");
  const [color, setColor] = useState("#e08a00");

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

  const toggle = (k: string, on: boolean) => {
    const next = on ? [...enabled, k] : enabled.filter((x) => x !== k);
    setEnabled(next);
    void patchSettings({ bandmapMarkers: next });
  };
  const saveCustom = (next: CustomMarker[]) => {
    setCustom(next);
    void patchSettings({ customMarkers: next });
  };

  const khzNum = Number(khz.replace(",", "."));
  const khzValid = Number.isFinite(khzNum) && khzNum > 0;
  const inBand = khzValid && BANDMAP_BANDS.some((b) => khzNum >= b.lowKhz && khzNum <= b.highKhz);
  const add = () => {
    if (!khzValid) return;
    saveCustom([...custom, { id: crypto.randomUUID(), name: name.trim(), khz: khzNum, color }]);
    setName("");
    setKhz("");
  };

  const count = enabled.length + custom.length;

  return (
    <span className="ml" ref={wrap}>
      <button
        type="button"
        className={open ? "chip active" : "chip"}
        aria-expanded={open}
        title={tr("bandmap.markersHint")}
        onClick={() => setOpen((v) => !v)}
      >
        {tr("bandmap.markers")}
        {count > 0 ? ` (${count})` : ""} ▾
      </button>
      {open && (
        <div
          className="ml-pop"
          role="dialog"
          aria-labelledby={titleId}
          ref={popRef}
          style={popStyle}
        >
          <div className="qh-head">
            <strong id={titleId}>{tr("bandmap.markers")}</strong>
            <button type="button" className="chip" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          <p className="muted bm-markers-always">{tr("bandmap.markersAlways")}</p>
          <div className="ml-grid">
            {OPTIONAL_MARKER_KINDS.map((k) => (
              <label key={k} className="inline ml-row">
                <input
                  type="checkbox"
                  checked={enabled.includes(k)}
                  onChange={(e) => toggle(k, e.target.checked)}
                />
                <i className={`bm-swatch swatch-marker special-${k}`} />
                {kindName(k)}
              </label>
            ))}
          </div>

          <h4>{tr("bandmap.customTitle")}</h4>
          {custom.length === 0 && <p className="muted">{tr("bandmap.customNone")}</p>}
          <ul className="bm-custom-list">
            {custom.map((c) => (
              <li key={c.id}>
                <i className="bm-swatch swatch-marker" style={{ background: c.color }} />
                <span className="bm-custom-name">{c.name || tr("bandmap.customUnnamed")}</span>
                <span className="mono muted">{c.khz} kHz</span>
                <button
                  type="button"
                  className="chip"
                  title={tr("bandmap.customDelete")}
                  onClick={() => saveCustom(custom.filter((x) => x.id !== c.id))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className="bm-custom-add">
            <input
              placeholder={tr("bandmap.customName")}
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="mono"
              placeholder="kHz"
              inputMode="decimal"
              value={khz}
              onChange={(e) => setKhz(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              title={tr("bandmap.customColor")}
            />
            <button type="button" disabled={!khzValid} onClick={add}>
              {tr("bandmap.customAdd")}
            </button>
          </div>
          {khzValid && !inBand && <p className="muted">{tr("bandmap.customOutOfBand")}</p>}
        </div>
      )}
    </span>
  );
}
