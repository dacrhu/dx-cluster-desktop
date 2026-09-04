import { useMemo } from "react";
import { useCluster } from "@/store/useCluster";
import { useT } from "@/i18n";
import type { SpotAction } from "@/lib/types";

/**
 * The context-menu actions shared by the Spots table, the Bandmap and the Map.
 * They drive the shared `spotQuery`, or hand a callsign to the Talk panel via
 * `store.pendingTalk` (App.tsx switches to the Talk tab). The Spots panel appends
 * its own "prepare a post" action.
 *
 * Memoized: Bandmap/WorldMap take this as a prop and are `memo`-wrapped, so a
 * fresh array here on every render would defeat that regardless of whether
 * `spots` itself changed.
 */
export function useSpotActions(): SpotAction[] {
  const tr = useT();
  const lang = useCluster((s) => s.lang); // tr()'s output depends on this too
  const setSpotQuery = useCluster((s) => s.setSpotQuery);
  const setPendingTalk = useCluster((s) => s.setPendingTalk);

  const addTerm = (term: string) => {
    const cur = useCluster.getState().spotQuery.trim();
    setSpotQuery(cur ? `${cur} ${term}` : term);
  };

  return useMemo(
    () => [
      { label: tr("spots.menu.onlyCall"), run: (s) => setSpotQuery(`dx:${s.dx_call}`) },
      {
        label: tr("spots.menu.addDxcc"),
        run: (s) => s.dx && addTerm(`dxcc:${s.dx.primary_prefix}`),
      },
      { label: tr("spots.menu.addBand"), run: (s) => s.band && addTerm(`band:${s.band}`) },
      { label: tr("spots.menu.excludeSpotter"), run: (s) => addTerm(`-by:${s.spotter_base}`) },
      { label: tr("spots.menu.talkDx"), run: (s) => setPendingTalk(s.dx_call) },
      { label: tr("spots.menu.talkSpotter"), run: (s) => setPendingTalk(s.spotter_base) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tr` is a stable ref; `lang` stands in for its output changing
    [tr, lang, setSpotQuery, setPendingTalk],
  );
}
