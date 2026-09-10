import { Fragment, memo, useMemo } from "react";
import {
  cellKey,
  classifyTrend,
  type BandActivityCell,
  type BandActivityMatrix as Matrix,
  type Trend,
} from "@/lib/bandActivity";
import { useT } from "@/i18n";

/**
 * Band × DX-continent trend matrix. Each cell carries a 2-hour sparkline, a
 * volume-scaled glow and a rising/falling badge (15-min moving average vs. the
 * preceding 15 min). A "biggest movers" strip sits on top. Memoised, and fed a
 * pre-computed `Matrix` so a hidden tab does no work — same pattern as
 * `WorldMap` / `Bandmap`.
 */

const ARROW: Record<Trend, string> = { "-2": "▼▼", "-1": "▼", "0": "–", "1": "▲", "2": "▲▲" };

function trendClass(t: Trend): string {
  return t > 0 ? "up" : t < 0 ? "down" : "flat";
}

function glow(total: number, max: number): string | undefined {
  if (!total) return undefined;
  const p = Math.round(5 + 32 * (Math.log1p(total) / Math.log1p(Math.max(max, 1))));
  return `color-mix(in srgb, var(--accent) ${p}%, transparent)`;
}

/** Filled-area sparkline, 0..1 normalised to the cell's own peak. */
function Spark({ buckets }: { buckets: number[] }) {
  const max = Math.max(1, ...buckets);
  const n = buckets.length;
  const W = 48;
  const H = 16;
  const pts = buckets.map((v, i) => {
    const x = n <= 1 ? 0 : (i / (n - 1)) * W;
    const y = H - 1 - (v / max) * (H - 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `M0,${H} ${pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} L${W},${H} Z`;
  return (
    <svg className="ba-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <path className="ba-spark-area" d={area} />
      <path className="ba-spark-line" d={line} />
    </svg>
  );
}

function deltaText(c: BandActivityCell, newLabel: string): string {
  if (c.deltaPct == null) return c.trend > 0 ? newLabel : "";
  const r = Math.round(c.deltaPct);
  return `${r > 0 ? "+" : ""}${r}%`;
}

export const BandActivityMatrix = memo(function BandActivityMatrix({
  matrix,
  onPick,
}: {
  matrix: Matrix;
  onPick: (band: string, continent: string) => void;
}) {
  const tr = useT();
  const { bands, continents, cells, movers } = matrix;

  const maxTotal = useMemo(() => {
    let m = 0;
    for (const c of cells.values()) if (c.total > m) m = c.total;
    return m;
  }, [cells]);

  const colStats = useMemo(() => {
    const out = new Map<string, { total: number; trend: Trend }>();
    for (const cont of continents) {
      let recent = 0;
      let prev = 0;
      let total = 0;
      for (const band of bands) {
        const c = cells.get(cellKey(band, cont));
        if (!c) continue;
        recent += c.recent;
        prev += c.prev;
        total += c.total;
      }
      out.set(cont, { total, trend: classifyTrend(recent, prev).trend });
    }
    return out;
  }, [bands, continents, cells]);

  if (cells.size === 0) {
    return <p className="muted ba-empty">{tr("activity.noData")}</p>;
  }

  const moverItem = (c: BandActivityCell) => (
    <button
      key={cellKey(c.band, c.continent)}
      className={`ba-mover ${trendClass(c.trend)}`}
      onClick={() => onPick(c.band, c.continent)}
      title={tr("activity.cellTitle", {
        band: c.band,
        cont: c.continent,
        recent: c.recent,
        prev: c.prev,
        age: c.lastAgeMin == null ? "–" : tr("activity.ageMin", { n: Math.round(c.lastAgeMin) }),
      })}
    >
      <span className="ba-mover-path">
        {c.band} <span className="ba-arrow-to">→</span> {c.continent}
      </span>
      <span className="ba-mover-delta">
        {ARROW[c.trend]} {deltaText(c, tr("activity.new"))}
      </span>
    </button>
  );

  return (
    <div className="band-activity">
      <div className="ba-movers">
        {!movers.rising.length && !movers.falling.length ? (
          <span className="muted ba-movers-none">{tr("activity.steady")}</span>
        ) : (
          <>
            <div className="ba-movers-col">
              <span className="ba-movers-label up">▲ {tr("activity.rising")}</span>
              {movers.rising.length ? (
                movers.rising.map(moverItem)
              ) : (
                <span className="muted ba-movers-none">{tr("activity.moversNone")}</span>
              )}
            </div>
            <div className="ba-movers-col">
              <span className="ba-movers-label down">▼ {tr("activity.falling")}</span>
              {movers.falling.length ? (
                movers.falling.map(moverItem)
              ) : (
                <span className="muted ba-movers-none">{tr("activity.moversNone")}</span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="ba-grid-scroll">
        <div
          className="ba-grid"
          style={{
            gridTemplateColumns: `max-content repeat(${continents.length}, minmax(74px, 1fr))`,
          }}
        >
          <div className="ba-corner" />
          {continents.map((cont) => {
            const cs = colStats.get(cont)!;
            return (
              <div key={cont} className="ba-colhead">
                <span className="ba-colhead-code">{cont}</span>
                <span className={`ba-colhead-trend ${trendClass(cs.trend)}`}>
                  {ARROW[cs.trend]}
                </span>
                <span className="ba-colhead-total muted">
                  {tr("activity.colTotal", { n: cs.total })}
                </span>
              </div>
            );
          })}

          {bands.map((band) => (
            <Fragment key={band}>
              <div className="ba-bandhead">{band}</div>
              {continents.map((cont) => {
                const c = cells.get(cellKey(band, cont));
                if (!c) {
                  return (
                    <div key={cont} className="ba-cell empty" aria-hidden>
                      ·
                    </div>
                  );
                }
                return (
                  <button
                    key={cont}
                    className={`ba-cell ${trendClass(c.trend)}`}
                    style={{ background: glow(c.total, maxTotal) }}
                    onClick={() => onPick(band, cont)}
                    title={tr("activity.cellTitle", {
                      band,
                      cont,
                      recent: c.recent,
                      prev: c.prev,
                      age:
                        c.lastAgeMin == null
                          ? "–"
                          : tr("activity.ageMin", { n: Math.round(c.lastAgeMin) }),
                    })}
                  >
                    <Spark buckets={c.buckets} />
                    <span className="ba-badge">
                      <span className="ba-arrow">{ARROW[c.trend]}</span>
                      <span className="ba-delta">{deltaText(c, tr("activity.new"))}</span>
                    </span>
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
});
