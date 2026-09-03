import { useEffect, useMemo, useState } from "react";
import { useCluster } from "@/store/useCluster";
import { patchSettings } from "@/lib/persist";
import { useVisibleSpots } from "@/lib/visibleSpots";
import { useSpotActions } from "@/lib/spotActions";
import { useMyReports } from "@/lib/mapReports";
import { locatorToLonLat } from "@/lib/grid";
import { WorldMap } from "@/components/WorldMap";
import { QuickFilters } from "@/components/QuickFilters";
import { QueryHelp } from "@/components/QueryHelp";
import { MapLayers } from "@/components/MapLayers";
import { useT } from "@/i18n";
import * as ipc from "@/lib/ipc";
import { type CtyEntity } from "@/lib/types";

const MAX_MARKERS = 600;

export function MapPanel({ onGoToFilters }: { onGoToFilters: () => void }) {
  const tr = useT();
  const { spotQuery, setSpotQuery } = useCluster();
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

  const allSpots = useVisibleSpots();
  const spots = useMemo(
    () => (reachOnly ? [] : allSpots.slice(0, MAX_MARKERS)),
    [allSpots, reachOnly],
  );
  const reports = useMyReports();
  const actions = useSpotActions();
  const home = useMemo(() => locatorToLonLat(homeLocator), [homeLocator]);

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
        entities={labels ? entities : []}
      />
    </div>
  );
}
