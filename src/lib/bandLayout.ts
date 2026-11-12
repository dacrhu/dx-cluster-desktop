/** Layout helpers for the Bandmap's linear (proportional) scale. */

export interface PackItem {
  /** Top of the item, px. */
  y: number;
  /** Height of the item, px. */
  h: number;
}

export interface PackResult {
  /** Column index (0-based), or -1 when it didn't fit in `maxCols`. */
  col: number;
  /** Number of columns in this item's overlap cluster (for the width). */
  cols: number;
  /** Index of the overlap cluster the item belongs to. */
  cluster: number;
}

/**
 * Greedy column packing for items already sorted by `y`: an item goes into the
 * first column whose previous item has ended; overlapping items thus spread
 * sideways instead of covering each other. `cols` is the widest column count
 * of the contiguous overlap cluster the item belongs to, so isolated items
 * keep the full width. Items beyond `maxCols` get `col: -1`.
 */
export function packColumns(items: PackItem[], maxCols: number): PackResult[] {
  const out: PackResult[] = new Array(items.length);
  let colEnd: number[] = [];
  let cluster: number[] = [];
  let hidden: number[] = [];
  let clusterCols = 1;
  let clusterId = -1;
  let hasHidden = false;
  const flush = () => {
    // A cluster that overflowed gets one extra slot, used for the "+N" chip.
    const cols = hasHidden ? maxCols + 1 : clusterCols;
    for (const i of cluster) out[i].cols = cols;
    for (const i of hidden) out[i].cols = cols;
    hasHidden = false;
    cluster = [];
    hidden = [];
    clusterCols = 1;
    colEnd = [];
  };
  items.forEach((it, i) => {
    if ((cluster.length || hidden.length) && colEnd.every((e) => e <= it.y)) flush();
    if (!cluster.length && !hidden.length) clusterId++;
    let col = colEnd.findIndex((e) => e <= it.y);
    if (col === -1 && colEnd.length < maxCols) col = colEnd.length;
    if (col === -1) {
      out[i] = { col: -1, cols: 1, cluster: clusterId };
      hidden.push(i);
      hasHidden = true;
      return;
    }
    colEnd[col] = it.y + it.h;
    clusterCols = Math.max(clusterCols, col + 1);
    out[i] = { col, cols: 1, cluster: clusterId };
    cluster.push(i);
  });
  flush();
  return out;
}

const TICK_STEPS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

/** Smallest "nice" tick step (kHz) that keeps labels at least `minPx` apart. */
export function linearTickStep(pxPerKhz: number, minPx = 36): number {
  return TICK_STEPS.find((s) => s * pxPerKhz >= minPx) ?? TICK_STEPS[TICK_STEPS.length - 1];
}
