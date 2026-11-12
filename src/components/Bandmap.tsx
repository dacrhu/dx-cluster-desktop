import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { linearTickStep, packColumns } from "@/lib/bandLayout";
import { matchingAlert, type AlertRule } from "@/lib/alerts";
import { modeClass, modeLabel } from "@/lib/mode";
import {
  BANDMAP_BANDS,
  bandSegments,
  regionEdges,
  regionForContinent,
  type IaruRegion,
  specialFreqsInBand,
  specialLabel,
  tickStepKhz,
  type BandmapBand,
  type SpecialFreq,
} from "@/lib/bands";
import { useCluster } from "@/store/useCluster";
import { locatorToLonLat } from "@/lib/grid";
import { lonLatToContinent } from "@/lib/continents";
import { useT } from "@/i18n";
import * as ipc from "@/lib/ipc";
import { createPortal } from "react-dom";
import { SpotPopover, TuneIcon } from "@/components/SpotPopover";
import type { EnrichedSpot, SpotAction } from "@/lib/types";

function ageClass(unix: number): string {
  const min = (Date.now() / 1000 - unix) / 60;
  if (min < 5) return "";
  if (min < 15) return " age1";
  if (min < 45) return " age2";
  return " age3";
}

function markerHint(tr: ReturnType<typeof useT>, f: SpecialFreq): string {
  const freq = (f.khz / 1000).toFixed(3);
  return f.kind === "sos" || f.kind === "ibp"
    ? tr(`bandmap.${f.kind}Hint`, { freq })
    : tr("bandmap.markerHint", { name: specialLabel(f), freq });
}

function Lane({
  band,
  spots,
  rules,
  availH,
  zoom,
  onPick,
  onSelect,
  onSpecialSelect,
  radioKhz,
  active,
  dimmed,
  follow,
  onManualScroll,
  onRecenter,
  onBandSelect,
  outside,
  region,
}: {
  band: BandmapBand;
  spots: EnrichedSpot[];
  rules: AlertRule[];
  availH: number;
  zoom: number;
  onPick: (e: MouseEvent, s: EnrichedSpot) => void;
  onSelect: (e: MouseEvent, s: EnrichedSpot) => void;
  onSpecialSelect: (e: MouseEvent, f: SpecialFreq) => void;
  radioKhz: number | null;
  active: boolean;
  dimmed: boolean;
  follow: boolean;
  onManualScroll: () => void;
  onRecenter: () => void;
  /** QSY the rig to this band (null = CAT off, header not clickable). */
  onBandSelect: ((freqKhz: number) => void) | null;
  /** The VFO is just past this lane's low ("below") or high ("above") edge. */
  outside: "below" | "above" | null;
  /** IARU region whose band limits to mark (null = unknown → full range). */
  region: IaruRegion | null;
}) {
  const tr = useT();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<{ x: number; y: number; items: EnrichedSpot[] } | null>(null);
  const programmatic = useRef(false);

  // One row per station, frequency-ordered: spots of the same call within the
  // same ~0.5 kHz bucket (many skimmers report the same signal) collapse into
  // one marker with a "×N" badge. Representative = the freshest spot.
  const groups = useMemo(() => {
    const m = new Map<string, EnrichedSpot[]>();
    for (const sp of spots) {
      if (sp.freq_khz < band.lowKhz || sp.freq_khz > band.highKhz) continue;
      const key = `${sp.dx_call.toUpperCase()}|${Math.round(sp.freq_khz * 2)}`;
      const g = m.get(key);
      if (g) g.push(sp);
      else m.set(key, [sp]);
    }
    return [...m.entries()]
      .map(([key, list]) => ({
        key,
        list,
        count: list.length,
        rep: list.reduce((a, b) => (b.received_at > a.received_at ? b : a)),
      }))
      .sort((a, c) => a.rep.freq_khz - c.rep.freq_khz || c.rep.received_at - a.rep.received_at);
  }, [spots, band]);
  const n = groups.length;
  const s = Math.min(zoom, 2);
  const linear = useCluster((st) => st.bandmapLinear);
  const span = band.highKhz - band.lowKhz;
  // Linear mode: a fixed, proportional px/kHz (never less than ~10 px/kHz so a
  // narrow band like 20 m CW is still readable), scaled by the zoom.
  const pxPerKhz = Math.max(availH / span, 10) * zoom;
  const rowH = linear
    ? 16 * s
    : n > 0
      ? Math.max(14 * s, Math.min(34 * s, (availH / n) * zoom))
      : 34 * s;
  const enabledMarkers = useCluster((st) => st.bandmapMarkers);
  const customMarkers = useCluster((st) => st.customMarkers);
  const specials = useMemo(
    () => specialFreqsInBand(band, enabledMarkers, customMarkers),
    [band, enabledMarkers, customMarkers],
  );
  // SOS/IBP markers render as their own half-height row, just like a spot
  // row. When there are real spots they're merged into one frequency-ordered
  // list together with the spot groups — rather than positioned by a
  // floating per-kHz line — so each item always gets its own slot: two fixed
  // marker frequencies past the last spot can otherwise both quantize onto
  // the same "after the last row" offset and land on top of each other.
  const specialRowH = Math.max(10 * s, rowH / 2);
  const { rowsSorted, rowTop, specialTop, contentH } = useMemo(() => {
    const rows = [
      ...groups.map((g, idx) => ({ freqKhz: g.rep.freq_khz, h: rowH, kind: "spot" as const, idx })),
      ...specials.map((f) => ({ freqKhz: f.khz, h: specialRowH, kind: "special" as const, f })),
    ].sort(
      // A marker is a header for the spots above its frequency: on an exact tie
      // (a spot right on the dial freq) the marker row comes first.
      (a, b) =>
        a.freqKhz - b.freqKhz || (a.kind === "special" ? -1 : 0) - (b.kind === "special" ? -1 : 0),
    );
    const rowTop: number[] = new Array(groups.length);
    const specialTop = new Map<number, number>();
    let y = 0;
    for (const r of rows) {
      if (r.kind === "spot") rowTop[r.idx] = y;
      else specialTop.set(r.f.khz, y);
      y += r.h;
    }
    return { rowsSorted: rows, rowTop, specialTop, contentH: y };
  }, [groups, specials, rowH, specialRowH]);
  const laneH = linear ? span * pxPerKhz : n === 0 ? availH : Math.max(availH, contentH);
  const proportional = linear || n === 0;
  // The frequency axis is non-linear once there's at least one spot: it walks
  // the same row layout as above (spot rows *and* SOS/IBP marker rows, so a
  // marker's height is accounted for too), and it stretches to follow the
  // actual density. An empty lane falls back to a plain proportional scale
  // (also used to place the SOS/IBP markers there).
  const yOf = proportional
    ? (khz: number) => ((khz - band.lowKhz) / span) * laneH
    : (khz: number) => {
        let y = 0;
        for (const r of rowsSorted) {
          if (r.freqKhz >= khz) break;
          y += r.h;
        }
        return y;
      };
  // A row's own top is a plain lookup — exact and O(1), unlike the O(n) walk
  // above needed for an arbitrary boundary (segment edges, the radio cursor).
  const specialY = (khz: number) =>
    linear
      ? Math.max(0, yOf(khz) - specialRowH / 2)
      : n === 0
        ? yOf(khz)
        : (specialTop.get(khz) ?? yOf(khz));

  // Linear mode: spots sit at their true frequency; those that would overlap
  // are spread over side-by-side columns (max 3, the rest collapse into a clickable +N chip).
  const linearPos = useMemo(() => {
    if (!linear) return null;
    const tops = groups.map((g) =>
      Math.max(0, ((g.rep.freq_khz - band.lowKhz) / span) * laneH - rowH / 2),
    );
    const cols = packColumns(
      tops.map((y) => ({ y, h: rowH })),
      3,
    );
    // Overflowed clusters: one "+N" chip spanning the cluster, listing every station.
    const chips = new Map<number, { top: number; bottom: number; cols: number; idx: number[] }>();
    cols.forEach((c, i) => {
      let ch = chips.get(c.cluster);
      if (!ch)
        chips.set(
          c.cluster,
          (ch = { top: tops[i], bottom: tops[i] + rowH, cols: c.cols, idx: [] }),
        );
      ch.bottom = Math.max(ch.bottom, tops[i] + rowH);
      ch.idx.push(i);
    });
    const overflow = [...chips.values()].filter((c) => c.idx.some((i) => cols[i].col < 0));
    return { tops, cols, hidden: cols.filter((c) => c.col < 0).length, overflow };
  }, [linear, groups, band, span, laneH, rowH]);

  // The station the radio is sitting on (VFO exactly on its frequency, ±0.05 kHz), if any.
  const nearKey = useMemo(() => {
    if (radioKhz == null) return null;
    let best: string | null = null;
    let bestD = 0.05;
    for (const g of groups) {
      const d = Math.abs(g.rep.freq_khz - radioKhz);
      if (d <= bestD) {
        bestD = d;
        best = g.key;
      }
    }
    return best;
  }, [radioKhz, groups]);

  // Keep the VFO cursor centred in the active lane while following — on VFO
  // moves *and* on spot inserts (which change row positions). Manual scrolling
  // clears `follow` (see `onScroll`), so this never fights the user.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || !active || !follow || radioKhz == null) return;
    const target = yOf(radioKhz) - el.clientHeight / 2;
    const want = Math.max(0, Math.min(target, el.scrollHeight - el.clientHeight));
    if (Math.abs(el.scrollTop - want) > 1) {
      programmatic.current = true;
      el.scrollTop = want;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radioKhz, active, follow, n, rowH, laneH]);

  // Scroll anchor: the station row at the top of the viewport and how far the
  // viewport is scrolled into it. New spots are inserted live (no frozen
  // snapshot), so after every layout change the scroll offset is re-derived
  // from this row's new position — what you're reading stays put while new
  // stations still appear around it.
  const anchor = useRef<{ key: string; offset: number } | null>(null);
  function captureAnchor(el: HTMLDivElement) {
    if (el.scrollTop <= 1 || groups.length === 0) {
      anchor.current = null;
      return;
    }
    let idx = 0;
    for (let i = 0; i < groups.length; i++) {
      if (rowTop[i] <= el.scrollTop) idx = i;
      else break;
    }
    anchor.current = { key: groups[idx].key, offset: el.scrollTop - rowTop[idx] };
  }
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    // The VFO-follow effect above owns the scroll position of a tracked lane.
    if (active && follow && radioKhz != null) return;
    if (linear) return; // positions are frequency-true, nothing shifts on new spots
    const a = anchor.current;
    if (a) {
      const idx = groups.findIndex((g) => g.key === a.key);
      if (idx >= 0) {
        const want = Math.max(
          0,
          Math.min(rowTop[idx] + a.offset, el.scrollHeight - el.clientHeight),
        );
        if (Math.abs(el.scrollTop - want) > 1) {
          programmatic.current = true;
          el.scrollTop = want;
        }
      }
    }
    captureAnchor(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, rowTop, laneH, linear]);

  function onScroll() {
    if (programmatic.current) {
      programmatic.current = false;
      return;
    }
    if (bodyRef.current) captureAnchor(bodyRef.current);
    if (active) onManualScroll();
  }

  const [edgeLow, edgeHigh] = regionEdges(band, region);
  const edgeLowY = edgeLow > band.lowKhz ? yOf(edgeLow) : 0;
  const edgeHighY = edgeHigh < band.highKhz ? yOf(edgeHigh) : laneH;

  const emptyTicks: number[] = [];
  if (proportional) {
    const step = linear ? linearTickStep(pxPerKhz) : tickStepKhz(span);
    for (let f = Math.ceil(band.lowKhz / step) * step; f < band.highKhz; f += step)
      emptyTicks.push(f);
  }

  // Where in this band to send the radio when its header is clicked: the
  // middle spot if the lane has any, else a nudge up from the band edge.
  const bandTargetKhz = n > 0 ? groups[Math.floor(n / 2)].rep.freq_khz : band.lowKhz + 20;
  const headerClickable = onBandSelect != null && !active;

  return (
    <div
      className={`bandmap-lane${active ? " radio-active" : ""}${dimmed ? " dimmed" : ""}${
        outside ? " out-of-band" : ""
      }`}
    >
      <div
        className={`bandmap-lane-head${headerClickable ? " qsy" : ""}`}
        title={headerClickable ? tr("bandmap.qsyBand", { band: band.label }) : undefined}
        onClick={headerClickable ? () => onBandSelect(bandTargetKhz) : undefined}
      >
        <strong>{band.label}</strong>
        {active && !follow && (
          <button
            className="bandmap-recenter"
            title={tr("bandmap.recenter")}
            onClick={(e) => {
              e.stopPropagation();
              onRecenter();
            }}
          >
            ⌖
          </button>
        )}
        <span
          className="muted"
          title={
            linearPos?.hidden ? tr("bandmap.linearHidden", { n: linearPos.hidden }) : undefined
          }
        >
          {n}
          {linearPos?.hidden ? ` (+${linearPos.hidden})` : ""}
        </span>
      </div>
      {list &&
        createPortal(
          <>
            <div className="bandmap-list-backdrop" onClick={() => setList(null)} />
            <ul
              className="context-menu bandmap-cluster-list"
              style={{
                left: Math.min(list.x, window.innerWidth - 240),
                top: Math.min(list.y, window.innerHeight - 320),
              }}
            >
              {list.items.map((sp) => (
                <li
                  key={sp.id}
                  onClick={(e) => {
                    setList(null);
                    onSelect(e, sp);
                  }}
                >
                  <span className="mono">{sp.freq_khz.toFixed(1)}</span> {sp.dx_call}{" "}
                  <span className="muted">{modeLabel(sp.mode, sp.comment)}</span>
                </li>
              ))}
            </ul>
          </>,
          document.body,
        )}
      {outside && <div className="bandmap-oob-flag">⚠ {tr("bandmap.outOfBand")}</div>}
      <div className="bandmap-lane-body" ref={bodyRef} onScroll={onScroll}>
        <div className="bandmap-scale" style={{ height: laneH }}>
          {edgeLowY > 0 && <div className="bandmap-outside" style={{ top: 0, height: edgeLowY }} />}
          {edgeHighY < laneH && (
            <div className="bandmap-outside" style={{ top: edgeHighY, bottom: 0 }} />
          )}
          <div
            className={`bandmap-edge edge-low${outside === "below" ? " hot" : ""}`}
            style={{ top: edgeLowY }}
            title={tr("bandmap.bandStart", { freq: (edgeLow / 1000).toFixed(3) })}
          >
            <span>▲ {(edgeLow / 1000).toFixed(3)}</span>
          </div>
          <div
            className={`bandmap-edge edge-high${outside === "above" ? " hot" : ""}`}
            style={{ top: edgeHighY }}
            title={tr("bandmap.bandEnd", { freq: (edgeHigh / 1000).toFixed(3) })}
          >
            <span>▼ {(edgeHigh / 1000).toFixed(3)}</span>
          </div>
          {bandSegments(band).map((seg) => {
            const top = yOf(seg.fromKhz);
            return (
              <div
                key={seg.mode + seg.fromKhz}
                className={`bandmap-seg seg-${seg.mode.toLowerCase()}`}
                style={{ top, height: Math.max(0, yOf(seg.toKhz) - top) }}
              />
            );
          })}
          {emptyTicks.map((f) => {
            const mhz = f / 1000;
            const label = Number.isInteger(mhz) ? String(mhz) : mhz.toFixed(3).replace(/0+$/, "");
            return (
              <div key={f} className="bandmap-tick" style={{ top: yOf(f) }}>
                <span>{label}</span>
              </div>
            );
          })}
          {specials.map((f) => (
            <div
              key={`${f.kind}-${f.khz}`}
              className={`bandmap-row${linear ? " linear" : ""}`}
              style={
                linear
                  ? { top: specialY(f.khz), height: specialRowH, left: "var(--bm-lg)" }
                  : { top: specialY(f.khz), height: specialRowH }
              }
            >
              {!linear && <span className="bandmap-rowfreq mono">{f.khz.toFixed(1)}</span>}
              <button
                className={`bandmap-spot bandmap-spot-special special-${f.kind}`}
                style={f.color ? ({ "--marker-color": f.color } as CSSProperties) : undefined}
                title={markerHint(tr, f)}
                onClick={(e) => onSpecialSelect(e, f)}
                onContextMenu={(e) => e.preventDefault()}
              >
                {specialLabel(f)}
              </button>
            </div>
          ))}
          {groups.map(({ key, list, count, rep }, i) => {
            const hit = rules.length > 0 && list.some((s) => matchingAlert(s, rules));
            const spotters = [...new Set(list.map((s) => s.spotter))];
            const info = [
              `${rep.freq_khz.toFixed(1)} kHz`,
              rep.dx_call,
              rep.dx?.dxcc_name,
              modeLabel(rep.mode, rep.comment) || null,
              count > 1 ? `${count}× ${spotters.slice(0, 8).join(", ")}` : rep.spotter,
              rep.comment || null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <div
                key={key}
                className={`bandmap-row${key === nearKey ? " radio-near" : ""}${
                  linear ? " linear" : ""
                }`}
                style={
                  linearPos
                    ? linearPos.cols[i].col < 0
                      ? { display: "none" }
                      : {
                          top: linearPos.tops[i],
                          height: rowH,
                          left: `calc(var(--bm-lg) + (100% - var(--bm-lg) - 6px) * ${linearPos.cols[i].col} / ${linearPos.cols[i].cols})`,
                          width: `calc((100% - var(--bm-lg) - 6px) / ${linearPos.cols[i].cols})`,
                          right: "auto",
                        }
                    : { top: rowTop[i], height: rowH }
                }
              >
                {!linear && <span className="bandmap-rowfreq mono">{rep.freq_khz.toFixed(1)}</span>}
                <button
                  className={`bandmap-spot${hit ? " alert-hit" : ""}${
                    rep.is_skimmer ? " skimmer" : ""
                  }${key === nearKey ? " radio-near" : ""}${ageClass(rep.received_at)}`}
                  title={info}
                  onClick={(e) => onSelect(e, rep)}
                  onContextMenu={(e) => onPick(e, rep)}
                >
                  <i className={`mode-dot ${modeClass(rep.mode)}`} />
                  <span className="bandmap-spot-call mono">{rep.dx_call}</span>
                  {count > 1 && <span className="bandmap-spot-n">{count}</span>}
                </button>
              </div>
            );
          })}
          {linearPos?.overflow.map((c) => (
            <div
              key={`chip-${c.idx[0]}`}
              className="bandmap-row linear"
              style={{
                top: c.top,
                height: Math.max(rowH, c.bottom - c.top),
                left: `calc(var(--bm-lg) + (100% - var(--bm-lg) - 6px) * ${c.cols - 1} / ${c.cols})`,
                width: `calc((100% - var(--bm-lg) - 6px) / ${c.cols})`,
                right: "auto",
              }}
            >
              <button
                className="bandmap-spot bandmap-chip"
                title={tr("bandmap.clusterHint", { n: c.idx.length })}
                onClick={(e) => {
                  e.stopPropagation();
                  setList({ x: e.clientX, y: e.clientY, items: c.idx.map((i) => groups[i].rep) });
                }}
              >
                +{c.idx.filter((i) => linearPos.cols[i].col < 0).length}
              </button>
            </div>
          ))}
          {radioKhz != null && radioKhz >= band.lowKhz && radioKhz <= band.highKhz && (
            <div className="bandmap-radio-cursor" style={{ top: yOf(radioKhz) }} />
          )}
          {n === 0 && <span className="bandmap-empty muted">{tr("bandmap.quiet")}</span>}
        </div>
      </div>
    </div>
  );
}

/**
 * The small fact card shown when a SOS/IBP marker row is left-clicked —
 * unlike `SpotPopover` it isn't a real spot, so it carries no dx/spotter
 * facts and no context-menu actions, just the frequency + a "Tune radio"
 * button (hidden when CAT is off, like `SpotPopover`'s own).
 */
function SpecialPopover({
  marker,
  x,
  y,
  catEnabled,
  onClose,
}: {
  marker: SpecialFreq;
  x: number;
  y: number;
  catEnabled: boolean;
  onClose: () => void;
}) {
  const tr = useT();
  const { khz: freqKhz, kind } = marker;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: globalThis.MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const [pos, setPos] = useState({ left: x + 8, top: y + 8 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x + 8, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(y + 8, window.innerHeight - height - 8)),
    });
  }, [x, y]);

  // Portaled into <body> for the same reason as `SpotPopover` — it must
  // paint above every lane regardless of any lane's own stacking context
  // (see the comment on `SpotPopover`).
  return createPortal(
    <div className="spot-pop special-pop" ref={ref} style={{ left: pos.left, top: pos.top }}>
      <div className="spot-pop-head">
        <span
          className={`spot-pop-call special-${kind}`}
          style={marker.color ? ({ "--marker-color": marker.color } as CSSProperties) : undefined}
        >
          {specialLabel(marker)}
        </span>
        <button className="spot-pop-x" onClick={onClose} aria-label={tr("common.close")}>
          ×
        </button>
      </div>
      <p className="spot-pop-comment">{markerHint(tr, marker)}</p>
      {catEnabled && (
        <div className="spot-pop-engage">
          <button
            className="primary"
            onClick={() => {
              void ipc.rigSet(freqKhz).catch((e) => console.warn("rigSet", e));
              onClose();
            }}
          >
            <TuneIcon />
            {tr("spots.menu.tuneRadio")}
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}

export const Bandmap = memo(function Bandmap({
  spots,
  actions,
  bands = BANDMAP_BANDS.map((b) => b.label),
  zoom = 1,
  onZoomBy,
}: {
  spots: EnrichedSpot[];
  actions: SpotAction[];
  bands?: string[];
  zoom?: number;
  onZoomBy?: (factor: number) => void;
}) {
  const tr = useT();
  const rules = useCluster((s) => s.alerts);
  const alertsEnabled = useCluster((s) => s.alertsEnabled);
  const activeRules = alertsEnabled ? rules : [];
  // The radio's live VFO (whenever CAT is connected) drives the lane cursor,
  // the "active band" highlight, and the on-frequency spot marker.
  const radioKhz = useCluster((s) => (s.catEnabled && s.rigVfo ? s.rigVfo.freqHz / 1000 : null));
  const catEnabled = useCluster((s) => s.catEnabled);
  const [menu, setMenu] = useState<{ x: number; y: number; spot: EnrichedSpot } | null>(null);
  const [pop, setPop] = useState<{ x: number; y: number; spot: EnrichedSpot } | null>(null);
  const [specialPop, setSpecialPop] = useState<{
    x: number;
    y: number;
    marker: SpecialFreq;
  } | null>(null);

  // Track the available height so quiet lanes fill the viewport at zoom 1.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [availH, setAvailH] = useState(700);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setAvailH(Math.max(360, el.clientHeight - 34));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ctrl + wheel zoom (non-passive so preventDefault works).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !onZoomBy) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      onZoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onZoomBy]);

  const lanes = BANDMAP_BANDS.filter((b) => bands.includes(b.label));
  const fontScale = Math.min(zoom, 2);
  const activeBand =
    radioKhz != null
      ? (lanes.find((b) => radioKhz >= b.lowKhz && radioKhz <= b.highKhz)?.label ?? null)
      : null;

  // VFO outside every amateur band (CAT wandered off): flag it loudly, and mark
  // the nearest band's edge it fell off.
  const regionSetting = useCluster((st) => st.iaruRegion);
  const homeLocator = useCluster((st) => st.homeLocator);
  const region: IaruRegion | null = useMemo(() => {
    if (regionSetting === "1" || regionSetting === "2" || regionSetting === "3")
      return Number(regionSetting) as IaruRegion;
    return regionForContinent(lonLatToContinent(locatorToLonLat(homeLocator)));
  }, [regionSetting, homeLocator]);
  const oob = useMemo(() => {
    if (radioKhz == null) return null;
    let best: { label: string; side: "below" | "above"; d: number } | null = null;
    for (const b of BANDMAP_BANDS) {
      const [lo, hi] = regionEdges(b, region);
      if (radioKhz >= lo && radioKhz <= hi) return null;
      const below = radioKhz < lo;
      const d = below ? lo - radioKhz : radioKhz - hi;
      if (!best || d < best.d) best = { label: b.label, side: below ? "below" : "above", d };
    }
    if (!best) return null;
    // Only blame a band if the VFO is reasonably close to it.
    const nb = BANDMAP_BANDS.find((b) => b.label === best!.label)!;
    const [lo, hi] = regionEdges(nb, region);
    return best.d <= Math.max(150, (hi - lo) * 0.5) ? best : { ...best, label: "" };
  }, [radioKhz, region]);

  // The active lane tracks the VFO by default; a manual scroll pauses that (the
  // lane keeps its scroll anchor, see `Lane`, while spots keep arriving live).
  // A new band (or the ⌖ button) resumes tracking.
  const [follow, setFollow] = useState(true);
  useEffect(() => {
    setFollow(true);
  }, [activeBand]);
  // A deliberate change to the shared quick-filter resumes VFO tracking.
  const filterSig = useCluster(
    (s) =>
      `${s.spotQuery} ${s.spotBands.join(",")} ${s.spotModes.join(",")} ${s.spotShowSkimmer} ${s.spotShowWsjtx} ${s.filtersEnabled} ${s.spotMaxAgeMin}`,
  );
  const savedFilters = useCluster((s) => s.filters);
  useEffect(() => {
    setFollow(true);
  }, [filterSig, savedFilters]);

  return (
    <div
      className="bandmap"
      ref={wrapRef}
      style={{ "--bm-scale": fontScale } as CSSProperties}
      onClick={() => setMenu(null)}
    >
      {oob && radioKhz != null && (
        <div className="bandmap-oob-banner" role="alert">
          ⚠ {tr("bandmap.oobBanner", { freq: (radioKhz / 1000).toFixed(3) })}
        </div>
      )}
      {lanes.map((b) => (
        <Lane
          key={b.label}
          band={b}
          spots={spots}
          rules={activeRules}
          availH={availH}
          zoom={zoom}
          onPick={(e, s) => {
            e.preventDefault();
            setPop(null);
            setMenu({ x: e.clientX, y: e.clientY, spot: s });
          }}
          onSelect={(e, s) => {
            setMenu(null);
            setPop({ x: e.clientX, y: e.clientY, spot: s });
          }}
          onSpecialSelect={(e, f) => {
            setMenu(null);
            setPop(null);
            setSpecialPop({ x: e.clientX, y: e.clientY, marker: f });
          }}
          radioKhz={radioKhz}
          active={b.label === activeBand}
          dimmed={activeBand != null && b.label !== activeBand}
          follow={follow}
          outside={oob && oob.label === b.label ? oob.side : null}
          region={region}
          onManualScroll={() => {
            if (follow) setFollow(false);
          }}
          onRecenter={() => {
            setFollow(true);
          }}
          onBandSelect={
            radioKhz != null
              ? (freqKhz) => void ipc.rigSet(freqKhz).catch((e) => console.warn("rigSet", e))
              : null
          }
        />
      ))}
      {pop && (
        <SpotPopover
          spot={pop.spot}
          x={pop.x}
          y={pop.y}
          actions={actions}
          onClose={() => setPop(null)}
        />
      )}
      {specialPop && (
        <SpecialPopover
          marker={specialPop.marker}
          x={specialPop.x}
          y={specialPop.y}
          catEnabled={catEnabled}
          onClose={() => setSpecialPop(null)}
        />
      )}
      {menu &&
        createPortal(
          <ul className="context-menu" style={{ left: menu.x, top: menu.y }}>
            {actions.map((a) => (
              <li
                key={a.label}
                onClick={() => {
                  a.run(menu.spot);
                  setMenu(null);
                }}
              >
                {a.label}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
});
