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
import { matchingAlert, type AlertRule } from "@/lib/alerts";
import { modeClass, modeLabel } from "@/lib/mode";
import {
  BANDMAP_BANDS,
  bandSegments,
  specialFreqsInBand,
  tickStepKhz,
  type BandmapBand,
  type SpecialFreq,
  type SpecialFreqKind,
} from "@/lib/bands";
import { useCluster } from "@/store/useCluster";
import { useT } from "@/i18n";
import * as ipc from "@/lib/ipc";
import { SpotPopover } from "@/components/SpotPopover";
import type { EnrichedSpot, SpotAction } from "@/lib/types";

function ageClass(unix: number): string {
  const min = (Date.now() / 1000 - unix) / 60;
  if (min < 5) return "";
  if (min < 15) return " age1";
  if (min < 45) return " age2";
  return " age3";
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
}) {
  const tr = useT();
  const bodyRef = useRef<HTMLDivElement>(null);
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
  const rowH = n > 0 ? Math.max(14 * s, Math.min(34 * s, (availH / n) * zoom)) : 34 * s;
  const specials = useMemo(() => specialFreqsInBand(band), [band]);
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
    ].sort((a, b) => a.freqKhz - b.freqKhz);
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
  const laneH = n === 0 ? availH : Math.max(availH, contentH);

  const span = band.highKhz - band.lowKhz;
  // The frequency axis is non-linear once there's at least one spot: it walks
  // the same row layout as above (spot rows *and* SOS/IBP marker rows, so a
  // marker's height is accounted for too), and it stretches to follow the
  // actual density. An empty lane falls back to a plain proportional scale
  // (also used to place the SOS/IBP markers there).
  const yOf =
    n === 0
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
  const specialY = (khz: number) => (n === 0 ? yOf(khz) : (specialTop.get(khz) ?? yOf(khz)));

  // The station the radio is sitting on (VFO within ~0.5 kHz), if any.
  const nearKey = useMemo(() => {
    if (radioKhz == null) return null;
    let best: string | null = null;
    let bestD = 0.5;
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

  function onScroll() {
    if (programmatic.current) {
      programmatic.current = false;
      return;
    }
    if (active) onManualScroll();
  }

  const emptyTicks: number[] = [];
  if (n === 0) {
    const step = tickStepKhz(span);
    for (let f = Math.ceil(band.lowKhz / step) * step; f < band.highKhz; f += step)
      emptyTicks.push(f);
  }

  // Where in this band to send the radio when its header is clicked: the
  // middle spot if the lane has any, else a nudge up from the band edge.
  const bandTargetKhz = n > 0 ? groups[Math.floor(n / 2)].rep.freq_khz : band.lowKhz + 20;
  const headerClickable = onBandSelect != null && !active;

  return (
    <div className={`bandmap-lane${active ? " radio-active" : ""}${dimmed ? " dimmed" : ""}`}>
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
        <span className="muted">{n}</span>
      </div>
      <div className="bandmap-lane-body" ref={bodyRef} onScroll={onScroll}>
        <div className="bandmap-scale" style={{ height: laneH }}>
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
              className="bandmap-row"
              style={{ top: specialY(f.khz), height: specialRowH }}
            >
              <span className="bandmap-rowfreq mono">{f.khz.toFixed(1)}</span>
              <button
                className={`bandmap-spot bandmap-spot-special special-${f.kind}`}
                title={tr(`bandmap.${f.kind}Hint`, { freq: (f.khz / 1000).toFixed(3) })}
                onClick={(e) => onSpecialSelect(e, f)}
                onContextMenu={(e) => e.preventDefault()}
              >
                {f.kind.toUpperCase()}
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
              <div key={key} className="bandmap-row" style={{ top: rowTop[i], height: rowH }}>
                <span className="bandmap-rowfreq mono">{rep.freq_khz.toFixed(1)}</span>
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
  freqKhz,
  kind,
  x,
  y,
  catEnabled,
  onClose,
}: {
  freqKhz: number;
  kind: SpecialFreqKind;
  x: number;
  y: number;
  catEnabled: boolean;
  onClose: () => void;
}) {
  const tr = useT();
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

  return (
    <div className="spot-pop special-pop" ref={ref} style={{ left: pos.left, top: pos.top }}>
      <div className="spot-pop-head">
        <span className={`spot-pop-call special-${kind}`}>{kind.toUpperCase()}</span>
        <button className="spot-pop-x" onClick={onClose} aria-label={tr("common.close")}>
          ×
        </button>
      </div>
      <p className="spot-pop-comment">
        {tr(`bandmap.${kind}Hint`, { freq: (freqKhz / 1000).toFixed(3) })}
      </p>
      {catEnabled && (
        <div className="spot-pop-engage">
          <button
            onClick={() => {
              void ipc.rigSet(freqKhz).catch((e) => console.warn("rigSet", e));
              onClose();
            }}
          >
            {tr("spots.menu.tuneRadio")}
          </button>
        </div>
      )}
    </div>
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
    freqKhz: number;
    kind: SpecialFreqKind;
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

  // The active lane tracks the VFO by default; a manual scroll pauses that and
  // freezes the spot set so nothing shifts under the reader. A new band (or the
  // ⌖ button) resumes tracking.
  const [follow, setFollow] = useState(true);
  const [frozen, setFrozen] = useState<EnrichedSpot[] | null>(null);
  useEffect(() => {
    setFollow(true);
    setFrozen(null);
  }, [activeBand]);
  const shown = frozen ?? spots;

  return (
    <div
      className="bandmap"
      ref={wrapRef}
      style={{ "--bm-scale": fontScale } as CSSProperties}
      onClick={() => setMenu(null)}
    >
      {lanes.map((b) => (
        <Lane
          key={b.label}
          band={b}
          spots={shown}
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
            setSpecialPop({ x: e.clientX, y: e.clientY, freqKhz: f.khz, kind: f.kind });
          }}
          radioKhz={radioKhz}
          active={b.label === activeBand}
          dimmed={activeBand != null && b.label !== activeBand}
          follow={follow}
          onManualScroll={() => {
            if (follow) {
              setFollow(false);
              setFrozen(spots);
            }
          }}
          onRecenter={() => {
            setFollow(true);
            setFrozen(null);
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
          freqKhz={specialPop.freqKhz}
          kind={specialPop.kind}
          x={specialPop.x}
          y={specialPop.y}
          catEnabled={catEnabled}
          onClose={() => setSpecialPop(null)}
        />
      )}
      {menu && (
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
        </ul>
      )}
    </div>
  );
});
