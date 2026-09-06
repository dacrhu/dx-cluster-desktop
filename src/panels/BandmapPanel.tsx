import { memo, useCallback, useMemo, useRef } from "react";
import { useCluster } from "@/store/useCluster";
import { useShallow } from "zustand/react/shallow";
import { patchSettings } from "@/lib/persist";
import { useVisibleSpots } from "@/lib/visibleSpots";
import { useSpotActions } from "@/lib/spotActions";
import { BANDMAP_BANDS } from "@/lib/bands";
import { Bandmap } from "@/components/Bandmap";
import { QuickFilters } from "@/components/QuickFilters";
import { QueryHelp } from "@/components/QueryHelp";
import { WsjtxToggle } from "@/components/WsjtxToggle";
import { useT } from "@/i18n";

export const BandmapPanel = memo(function BandmapPanel({
  onGoToFilters,
  active,
}: {
  onGoToFilters: () => void;
  /** Whether the Bandmap tab is the one currently shown — while false, the
   *  `Bandmap` (per-band lane layout, re-grouped per spot) is fed a frozen
   *  snapshot instead of live data, so it doesn't redo that work in the
   *  background on every incoming spot. */
  active: boolean;
}) {
  const tr = useT();
  const {
    spotQuery,
    setSpotQuery,
    spotShowSkimmer,
    setSpotShowSkimmer,
    filtersEnabled,
    setFiltersEnabled,
    zoom,
    setZoom,
  } = useCluster(
    useShallow((s) => ({
      spotQuery: s.spotQuery,
      setSpotQuery: s.setSpotQuery,
      spotShowSkimmer: s.spotShowSkimmer,
      setSpotShowSkimmer: s.setSpotShowSkimmer,
      filtersEnabled: s.filtersEnabled,
      setFiltersEnabled: s.setFiltersEnabled,
      zoom: s.bandmapZoom,
      setZoom: s.setBandmapZoom,
    })),
  );
  // `active` freezes the `store.spots` scan inside the hook while this tab is
  // hidden — the lane re-grouping below then stays put too.
  const spots = useVisibleSpots(active);
  const actions = useSpotActions();

  // Persist the zoom a beat after it settles (wheel / drag fire rapidly).
  const persistTimer = useRef<number | null>(null);
  const applyZoom = useCallback(
    (z: number) => {
      const clamped = Math.min(5, Math.max(1, Math.round(z * 100) / 100));
      setZoom(clamped);
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
      persistTimer.current = window.setTimeout(
        () => void patchSettings({ bandmapZoom: clamped }),
        400,
      );
    },
    [setZoom],
  );
  const zoomBy = useCallback(
    (factor: number) => applyZoom(useCluster.getState().bandmapZoom * factor),
    [applyZoom],
  );

  // Lanes = bands present in the (already quick-filtered) spots; HF fallback
  // when it's all quiet. The band selection itself now lives in `QuickFilters`.
  const shownBands = useMemo(() => {
    const s = new Set(spots.map((x) => x.band).filter(Boolean) as string[]);
    const present = BANDMAP_BANDS.filter((b) => s.has(b.label)).map((b) => b.label);
    return present.length ? present : BANDMAP_BANDS.slice(0, 10).map((b) => b.label);
  }, [spots]);

  return (
    <div className="panel bandmap-panel">
      <div className="quickbar">
        <QuickFilters />
        <input
          className="search mono"
          placeholder={tr("spots.searchPlaceholder")}
          value={spotQuery}
          onChange={(e) => setSpotQuery(e.target.value)}
          spellCheck={false}
        />
        {spotQuery && (
          <button className="chip" onClick={() => setSpotQuery("")} title={tr("spots.clearSearch")}>
            ✕
          </button>
        )}
        <QueryHelp />
        <div className="qf-toggles">
          <label className="inline">
            <input
              type="checkbox"
              checked={spotShowSkimmer}
              onChange={(e) => setSpotShowSkimmer(e.target.checked)}
            />
            {tr("spots.skimmer")}
          </label>
          <WsjtxToggle />
          <label className="inline">
            <input
              type="checkbox"
              checked={filtersEnabled}
              onChange={(e) => setFiltersEnabled(e.target.checked)}
            />
            {tr("spots.savedFilters")}
          </label>
          <button onClick={onGoToFilters}>{tr("spots.editFilters")}</button>
        </div>

        <label className="inline bandmap-zoom" title={tr("bandmap.zoomHint")}>
          {tr("bandmap.zoom")}
          <input
            type="range"
            min={1}
            max={5}
            step={0.25}
            value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
          />
          <button className="chip" onClick={() => applyZoom(1)} disabled={zoom === 1}>
            {tr("bandmap.fit")}
          </button>
        </label>
      </div>

      <div className="bandmap-legend muted" title={tr("bandmap.legendHint")}>
        {(["cw", "ssb", "digi", "fm"] as const).map((m) => (
          <span key={m} className="legend-item">
            <span className={`bm-swatch mode-dot mode-${m}`} />
            {m.toUpperCase()}
          </span>
        ))}
        <span className="legend-sep">·</span>
        {tr("bandmap.legendAge")}
        <span className="legend-sep">·</span>
        <span className="legend-item">
          <span className="bm-swatch swatch-alert" />
          {tr("bandmap.legendAlert")}
        </span>
        <span className="legend-sep">·</span>
        <span className="legend-item" title={tr("bandmap.sosLegend")}>
          <span className="bm-swatch swatch-sos" />
          SOS
        </span>
        <span className="legend-item" title={tr("bandmap.ibpLegend")}>
          <span className="bm-swatch swatch-ibp" />
          IBP
        </span>
      </div>

      <Bandmap spots={spots} actions={actions} bands={shownBands} zoom={zoom} onZoomBy={zoomBy} />
    </div>
  );
});
