import { memo, useEffect, useMemo, useState } from "react";
import { useCluster } from "@/store/useCluster";
import { useShallow } from "zustand/react/shallow";
import { patchSettings } from "@/lib/persist";
import { useVisibleSpots } from "@/lib/visibleSpots";
import { useSpotActions } from "@/lib/spotActions";
import { useMyReports } from "@/lib/mapReports";
import { locatorToLonLat } from "@/lib/grid";
import { useFrozenWhenInactive } from "@/lib/util";
import { WorldMap } from "@/components/WorldMap";
import { QuickFilters } from "@/components/QuickFilters";
import { QueryHelp } from "@/components/QueryHelp";
import { MapLayers } from "@/components/MapLayers";
import { useT } from "@/i18n";
import * as ipc from "@/lib/ipc";
import { type CtyEntity } from "@/lib/types";

const MAX_MARKERS = 600;
const NO_ENTITIES: CtyEntity[] = [];

export const MapPanel = memo(function MapPanel({
  onGoToFilters,
  onGoToPropagation,
  active,
}: {
  onGoToFilters: () => void;
  /** Jump to the Propagation tab — the conditions HUD is a shortcut to it. */
  onGoToPropagation: () => void;
  /** Whether the Map tab is the one currently shown — while false, the
   *  `WorldMap` (an SVG map re-computing several layers per spot) is fed a
   *  frozen snapshot instead of live data, so it doesn't redo that work in
   *  the background on every incoming spot. */
  active: boolean;
}) {
  const tr = useT();
  const { spotQuery, setSpotQuery } = useCluster(
    useShallow((s) => ({ spotQuery: s.spotQuery, setSpotQuery: s.setSpotQuery })),
  );
  const homeLocator = useCluster((s) => s.homeLocator);
  const projection = useCluster((s) => s.mapProjection);
  const setProjection = useCluster((s) => s.setMapProjection);
  const labels = useCluster((s) => s.mapLabels);

  const [reachOnly, setReachOnly] = useState(false);
  const [entities, setEntities] = useState<CtyEntity[]>([]);
  useEffect(() => {
    ipc
      .ctyEntities()
      .then(setEntities)
      .catch((e) => console.warn("cty entities failed to load", e));
  }, []);

  // `active` is threaded into these hooks: while the Map tab is hidden the
  // underlying `store.spots` scan is frozen, so a busy skimmer feed doesn't
  // keep re-filtering thousands of rows for a map nobody is looking at. The
  // memo-wrapped, SVG-heavy `WorldMap` then bails on stable props. Everything
  // catches up the instant the tab is shown again.
  const allSpots = useVisibleSpots(active);
  const spots = useMemo(
    () => (reachOnly ? [] : allSpots.slice(0, MAX_MARKERS)),
    [allSpots, reachOnly],
  );
  const reports = useMyReports(active);
  const actions = useSpotActions();
  const home = useMemo(() => locatorToLonLat(homeLocator), [homeLocator]);
  const shownEntities = labels ? entities : NO_ENTITIES;
  const frozenEntities = useFrozenWhenInactive(shownEntities, active);

  return (
    <div className="panel map-panel">
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
        <span className="seg-field">
          <span className="seg-label">{tr("map.projLabel")}</span>
          <span className="segmented" role="group" aria-label={tr("map.projLabel")}>
            {(["rect", "azimuthal"] as const).map((p) => (
              <button
                key={p}
                className={projection === p ? "active" : ""}
                aria-pressed={projection === p}
                title={p === "azimuthal" ? tr("map.projAzimuthalHint") : tr("map.projRectHint")}
                onClick={() => {
                  setProjection(p);
                  void patchSettings({ mapProjection: p });
                }}
              >
                {p === "azimuthal" ? tr("map.projAzimuthal") : tr("map.projRect")}
              </button>
            ))}
          </span>
        </span>
        <MapLayers
          reachOnly={reachOnly}
          setReachOnly={setReachOnly}
          onGoToFilters={onGoToFilters}
        />
        <span className="grow" />
        {reports.length > 0 && (
          <span className="muted map-count">{tr("map.reach", { n: reports.length })}</span>
        )}
      </div>

      {!home && <p className="muted">{tr("map.noQth")}</p>}

      <div className="bandmap-legend muted">
        {(["cw", "ssb", "digi", "fm"] as const).map((m) => (
          <span key={m} className="legend-item">
            <span className={`bm-swatch mode-dot mode-${m}`} />
            {m.toUpperCase()}
          </span>
        ))}
        <span className="legend-sep">·</span>
        <span className="legend-item">
          <span className="bm-swatch wm-report-swatch" />
          {tr("map.legendReach")}
        </span>
        <span className="legend-sep">·</span>
        {tr("bandmap.legendAge")}
      </div>

      <WorldMap
        spots={spots}
        reports={reports}
        actions={actions}
        home={home}
        entities={frozenEntities}
        onGoToPropagation={onGoToPropagation}
      />
    </div>
  );
});
