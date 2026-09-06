import { useMemo } from "react";
import { useCluster } from "@/store/useCluster";
import { compileQuery } from "./query";
import { spotPasses } from "./filter";
import { useFrozenWhenInactive } from "./util";
import type { EnrichedSpot } from "./types";

/**
 * The spot list after the shared pipeline — all inputs from the store, so the
 * Spots, Bandmap and Map panels show exactly the same set: skimmer / WSJT-X
 * toggles, the quick-filter band + mode chips (`spotBands` / `spotModes`,
 * empty = all), the search query and the saved node filters.
 *
 * `active` (default true) — pass the panel's tab-visible flag. While false the
 * `spots` input is frozen at its last value, so the filter below (a scan of up
 * to `MAX_SPOTS` rows, run again on every ~200 ms spot flush) doesn't re-run for
 * a tab nobody is looking at. Spots stays `active` unconditionally — its match
 * timestamp feeds the cross-tab "new activity" dot.
 */
export function useVisibleSpots(active = true): EnrichedSpot[] {
  const liveSpots = useCluster((s) => s.spots);
  const spots = useFrozenWhenInactive(liveSpots, active);
  const filters = useCluster((s) => s.filters);
  const filtersEnabled = useCluster((s) => s.filtersEnabled);
  const query = useCluster((s) => s.spotQuery);
  const bands = useCluster((s) => s.spotBands);
  const modes = useCluster((s) => s.spotModes);
  const showSkimmer = useCluster((s) => s.spotShowSkimmer);
  const showWsjtx = useCluster((s) => s.spotShowWsjtx);
  const maxAgeMin = useCluster((s) => s.spotMaxAgeMin);
  const ageTick = useCluster((s) => s.ageTick);
  const pred = useMemo(() => compileQuery(query), [query]);

  return useMemo(() => {
    void ageTick; // re-run on the periodic tick so stale spots drop when quiet
    const cutoff = maxAgeMin > 0 ? Date.now() / 1000 - maxAgeMin * 60 : 0;
    return spots.filter((s) => {
      if (cutoff && s.received_at < cutoff) return false;
      if (!showSkimmer && s.is_skimmer) return false;
      if (!showWsjtx && s.node_id === "wsjtx") return false;
      if (bands.length && !(s.band && bands.includes(s.band))) return false;
      if (modes.length && !modes.includes(s.mode)) return false;
      if (!pred(s)) return false;
      if (filtersEnabled && filters.length && !spotPasses(s, filters)) return false;
      return true;
    });
  }, [
    spots,
    bands,
    modes,
    pred,
    showSkimmer,
    showWsjtx,
    filters,
    filtersEnabled,
    maxAgeMin,
    ageTick,
  ]);
}
