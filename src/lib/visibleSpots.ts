import { useMemo } from "react";
import { useCluster } from "@/store/useCluster";
import { compileQuery, type SpotPredicate } from "./query";
import { spotPasses } from "./filter";
import { useFrozenWhenInactive } from "./util";
import type { EnrichedSpot, Mode, SpotFilter } from "./types";

interface FilterInputs {
  pred: SpotPredicate;
  bands: string[];
  modes: Mode[];
  showSkimmer: boolean;
  showWsjtx: boolean;
  filters: SpotFilter[];
  filtersEnabled: boolean;
  /** Global age cap in minutes; 0 = off. */
  maxAgeMin: number;
}

/** The shared spot pipeline — skimmer / WSJT-X toggles, quick-filter band + mode
 *  chips, the search query, the saved node filters and (optionally) the global
 *  age cap. Pure, so both hooks below share exactly one implementation. */
function applySpotFilters(spots: EnrichedSpot[], o: FilterInputs): EnrichedSpot[] {
  const cutoff = o.maxAgeMin > 0 ? Date.now() / 1000 - o.maxAgeMin * 60 : 0;
  return spots.filter((s) => {
    if (cutoff && s.received_at < cutoff) return false;
    if (!o.showSkimmer && s.is_skimmer) return false;
    if (!o.showWsjtx && s.node_id === "wsjtx") return false;
    if (o.bands.length && !(s.band && o.bands.includes(s.band))) return false;
    if (o.modes.length && !o.modes.includes(s.mode)) return false;
    if (!o.pred(s)) return false;
    if (o.filtersEnabled && o.filters.length && !spotPasses(s, o.filters)) return false;
    return true;
  });
}

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
    return applySpotFilters(spots, {
      pred,
      bands,
      modes,
      showSkimmer,
      showWsjtx,
      filters,
      filtersEnabled,
      maxAgeMin,
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

/**
 * Same pipeline as `useVisibleSpots`, but **without** the global age cap — the
 * Band Activity panel needs the full 2-hour history for its trend windows and
 * sparklines regardless of what the top-bar "max age" is set to. The quick
 * filters, search and node filters still apply, so the panel stays in step with
 * the shared band / mode chips.
 */
export function useTrendSpots(active = true): EnrichedSpot[] {
  const liveSpots = useCluster((s) => s.spots);
  const spots = useFrozenWhenInactive(liveSpots, active);
  const filters = useCluster((s) => s.filters);
  const filtersEnabled = useCluster((s) => s.filtersEnabled);
  const query = useCluster((s) => s.spotQuery);
  const bands = useCluster((s) => s.spotBands);
  const modes = useCluster((s) => s.spotModes);
  const showSkimmer = useCluster((s) => s.spotShowSkimmer);
  const showWsjtx = useCluster((s) => s.spotShowWsjtx);
  const ageTick = useCluster((s) => s.ageTick);
  const pred = useMemo(() => compileQuery(query), [query]);

  return useMemo(() => {
    void ageTick;
    return applySpotFilters(spots, {
      pred,
      bands,
      modes,
      showSkimmer,
      showWsjtx,
      filters,
      filtersEnabled,
      maxAgeMin: 0,
    });
  }, [spots, bands, modes, pred, showSkimmer, showWsjtx, filters, filtersEnabled, ageTick]);
}
