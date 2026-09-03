import { useMemo } from "react";
import { useCluster } from "@/store/useCluster";
import { toggleIn } from "@/lib/util";
import { ALL_BANDS, ALL_MODES } from "@/lib/types";
import { useT } from "@/i18n";

/**
 * The shared quick-filter chips — band + mode inclusion — wired straight to the
 * store (`spotBands` / `spotModes`), so the Spots, Bandmap and Map panels all
 * carry the same selection, the way they already share the search box.
 * The band list is the bands currently seen in the feed (HF fallback when quiet)
 * plus any that stay selected; modes are the four fixed categories.
 */
export function QuickFilters() {
  const tr = useT();
  const spots = useCluster((s) => s.spots);
  const bands = useCluster((s) => s.spotBands);
  const setBands = useCluster((s) => s.setSpotBands);
  const modes = useCluster((s) => s.spotModes);
  const setModes = useCluster((s) => s.setSpotModes);

  const bandChoices = useMemo(() => {
    const present = new Set(spots.map((s) => s.band).filter(Boolean) as string[]);
    const list = ALL_BANDS.filter((b) => present.has(b) || bands.includes(b));
    return list.length ? list : ALL_BANDS.slice(0, 10);
  }, [spots, bands]);

  return (
    <>
      <div className="qf-group">
        <span className="seg-label">{tr("qf.band")}</span>
        <div className="band-buttons">
          {bandChoices.map((b) => (
            <button
              key={b}
              className={bands.includes(b) ? "chip active" : "chip"}
              onClick={() => setBands(toggleIn(bands, b))}
            >
              {b}
            </button>
          ))}
          {bands.length > 0 && (
            <button className="chip" onClick={() => setBands([])} title={tr("spots.clearFilter")}>
              ✕
            </button>
          )}
        </div>
      </div>
      <div className="qf-group">
        <span className="seg-label">{tr("qf.mode")}</span>
        <div className="mode-buttons">
          {ALL_MODES.map((m) => (
            <button
              key={m}
              className={modes.includes(m) ? "chip active" : "chip"}
              onClick={() => setModes(toggleIn(modes, m))}
            >
              {m}
            </button>
          ))}
          {modes.length > 0 && (
            <button className="chip" onClick={() => setModes([])} title={tr("spots.clearFilter")}>
              ✕
            </button>
          )}
        </div>
      </div>
    </>
  );
}
