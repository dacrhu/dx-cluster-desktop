import { useEffect, useId, useRef, useState } from "react";
import { useCluster } from "@/store/useCluster";
import { patchSettings } from "@/lib/persist";
import { useT } from "@/i18n";

/** "Layers ▾" popover for the Map quickbar — collapses the long run of map-layer
 *  and spot-source checkboxes into one button, grouped by purpose. Modelled on
 *  `QueryHelp`'s outside-click / Escape popover. */
export function MapLayers({
  reachOnly,
  setReachOnly,
  onGoToFilters,
}: {
  reachOnly: boolean;
  setReachOnly: (v: boolean) => void;
  onGoToFilters: () => void;
}) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const titleId = useId();

  const grayline = useCluster((s) => s.mapGrayline);
  const setGrayline = useCluster((s) => s.setMapGrayline);
  const arcs = useCluster((s) => s.mapArcs);
  const setArcs = useCluster((s) => s.setMapArcs);
  const labels = useCluster((s) => s.mapLabels);
  const setLabels = useCluster((s) => s.setMapLabels);
  const greyline = useCluster((s) => s.mapGreyline);
  const setGreyline = useCluster((s) => s.setMapGreyline);
  const auroraOn = useCluster((s) => s.mapAurora);
  const setAurora = useCluster((s) => s.setMapAurora);
  const condHud = useCluster((s) => s.mapCondHud);
  const setCondHud = useCluster((s) => s.setMapCondHud);
  const bandRoseOn = useCluster((s) => s.mapBandRose);
  const setBandRose = useCluster((s) => s.setMapBandRose);
  const mufOn = useCluster((s) => s.mapMuf);
  const setMuf = useCluster((s) => s.setMapMuf);
  const openingsOn = useCluster((s) => s.mapOpenings);
  const setOpenings = useCluster((s) => s.setMapOpenings);

  const spotShowSkimmer = useCluster((s) => s.spotShowSkimmer);
  const setSpotShowSkimmer = useCluster((s) => s.setSpotShowSkimmer);
  const wsjtxEnabled = useCluster((s) => s.wsjtxEnabled);
  const spotShowWsjtx = useCluster((s) => s.spotShowWsjtx);
  const setSpotShowWsjtx = useCluster((s) => s.setSpotShowWsjtx);
  const filtersEnabled = useCluster((s) => s.filtersEnabled);
  const setFiltersEnabled = useCluster((s) => s.setFiltersEnabled);

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

  /** A checkbox row; `settingsKey` set = also persist to settings.json. */
  const row = (
    checked: boolean,
    set: (v: boolean) => void,
    label: string,
    settingsKey?: string,
  ) => (
    <label className="inline ml-row">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          set(e.target.checked);
          if (settingsKey) void patchSettings({ [settingsKey]: e.target.checked });
        }}
      />
      {label}
    </label>
  );

  const activeCount =
    [grayline, arcs, labels, greyline, auroraOn, condHud, bandRoseOn, mufOn, openingsOn].filter(
      Boolean,
    ).length + (reachOnly ? 1 : 0);

  return (
    <span className="ml" ref={wrap}>
      <button
        type="button"
        className={open ? "chip active" : "chip"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {tr("map.layers")}
        {activeCount > 0 ? ` (${activeCount})` : ""} ▾
      </button>
      {open && (
        <div className="ml-pop" role="dialog" aria-labelledby={titleId}>
          <div className="qh-head">
            <strong id={titleId}>{tr("map.layers")}</strong>
            <button type="button" className="chip" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          <h4>{tr("map.grpPropagation")}</h4>
          <div className="ml-grid">
            {row(greyline, setGreyline, tr("map.greyline"), "mapGreyline")}
            {row(auroraOn, setAurora, tr("map.aurora"), "mapAurora")}
            {row(mufOn, setMuf, tr("map.muf"), "mapMuf")}
            {row(openingsOn, setOpenings, tr("map.openings"), "mapOpenings")}
            {row(bandRoseOn, setBandRose, tr("map.bandRose"), "mapBandRose")}
            {row(condHud, setCondHud, tr("map.condHud"), "mapCondHud")}
          </div>

          <h4>{tr("map.grpReference")}</h4>
          <div className="ml-grid">
            {row(grayline, setGrayline, tr("map.grayline"), "mapGrayline")}
            {row(labels, setLabels, tr("map.prefixes"), "mapLabels")}
            {row(arcs, setArcs, tr("map.arcs"), "mapArcs")}
          </div>

          <h4>{tr("map.grpSpots")}</h4>
          <div className="ml-grid">
            {row(spotShowSkimmer, setSpotShowSkimmer, tr("spots.skimmer"))}
            {wsjtxEnabled && row(spotShowWsjtx, setSpotShowWsjtx, tr("spots.wsjtx"))}
            {row(reachOnly, setReachOnly, tr("map.reachOnly"))}
            {row(filtersEnabled, setFiltersEnabled, tr("spots.savedFilters"))}
          </div>
          <button className="ml-edit-filters" onClick={onGoToFilters}>
            {tr("spots.editFilters")}
          </button>
        </div>
      )}
    </span>
  );
}
