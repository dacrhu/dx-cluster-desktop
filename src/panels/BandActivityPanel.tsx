import { memo, useCallback, useMemo } from "react";
import { useCluster } from "@/store/useCluster";
import { useShallow } from "zustand/react/shallow";
import { patchSettings } from "@/lib/persist";
import { useTrendSpots } from "@/lib/visibleSpots";
import { bandActivityMatrix } from "@/lib/bandActivity";
import { lonLatToContinent } from "@/lib/continents";
import { locatorToLonLat } from "@/lib/grid";
import { BandActivityMatrix } from "@/components/BandActivityMatrix";
import { QuickFilters } from "@/components/QuickFilters";
import { QueryHelp } from "@/components/QueryHelp";
import { WsjtxToggle } from "@/components/WsjtxToggle";
import { useT } from "@/i18n";

/** Continents a spotter can realistically sit on — Antarctica omitted. */
const SCOPE_CONTINENTS = ["EU", "NA", "SA", "AS", "AF", "OC"];

/**
 * "Activity" tab — a band × DX-continent trend matrix. Reads the shared spot
 * pipeline (minus the global age cap, via `useTrendSpots`) so the QuickFilters
 * band / mode chips, search and skimmer toggle all apply, and freezes while the
 * tab is hidden through the `active` prop.
 */
export const BandActivityPanel = memo(function BandActivityPanel({
  onGoToSpots,
  active,
}: {
  onGoToSpots: () => void;
  active: boolean;
}) {
  const tr = useT();
  const {
    spotQuery,
    setSpotQuery,
    spotShowSkimmer,
    setSpotShowSkimmer,
    from,
    setFrom,
    homeLocator,
    setSpotBands,
  } = useCluster(
    useShallow((s) => ({
      spotQuery: s.spotQuery,
      setSpotQuery: s.setSpotQuery,
      spotShowSkimmer: s.spotShowSkimmer,
      setSpotShowSkimmer: s.setSpotShowSkimmer,
      from: s.bandActivityFrom,
      setFrom: s.setBandActivityFrom,
      homeLocator: s.homeLocator,
      setSpotBands: s.setSpotBands,
    })),
  );

  const spots = useTrendSpots(active);

  const homeCont = useMemo(() => lonLatToContinent(locatorToLonLat(homeLocator)), [homeLocator]);

  // Stored scope: "" = auto (QTH continent), "*" = anywhere, else a continent code.
  const resolvedFrom = from === "*" ? null : from || homeCont;

  const matrix = useMemo(() => bandActivityMatrix(spots, resolvedFrom), [spots, resolvedFrom]);

  const onPick = useCallback(
    (band: string, cont: string) => {
      setSpotBands([band]);
      setSpotQuery(`cont:${cont}${resolvedFrom ? ` bycont:${resolvedFrom}` : ""}`);
      onGoToSpots();
    },
    [setSpotBands, setSpotQuery, resolvedFrom, onGoToSpots],
  );

  const onScopeChange = useCallback(
    (v: string) => {
      const stored = v === "auto" ? "" : v;
      setFrom(stored);
      void patchSettings({ bandActivityFrom: stored });
    },
    [setFrom],
  );

  const noQth = resolvedFrom == null && from !== "*";

  return (
    <div className="panel band-activity-panel">
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
        <label className="inline" title={tr("activity.scopeHint")}>
          {tr("activity.scopeLabel")}
          <select
            value={from === "" ? "auto" : from}
            onChange={(e) => onScopeChange(e.target.value)}
          >
            <option value="auto">
              {homeCont
                ? tr("activity.scopeAuto", { cont: homeCont })
                : tr("activity.scopeAutoNone")}
            </option>
            {SCOPE_CONTINENTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="*">{tr("activity.scopeAnywhere")}</option>
          </select>
        </label>
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
        </div>
      </div>

      <div className="bandmap-legend muted">
        {tr("activity.window")}
        {noQth && (
          <>
            <span className="legend-sep">·</span>
            {tr("activity.noQthHint")}
          </>
        )}
      </div>

      <BandActivityMatrix matrix={matrix} onPick={onPick} />
    </div>
  );
});
