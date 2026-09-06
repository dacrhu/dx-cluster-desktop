import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import {
  geoAzimuthalEquidistant,
  geoCircle,
  geoDistance,
  geoEquirectangular,
  geoGraticule10,
  geoPath,
  type GeoProjection,
} from "d3-geo";
import { feature, mesh } from "topojson-client";
import worldUrl from "@/assets/countries-110m.json?url";
import { matchingAlert } from "@/lib/alerts";
import { modeClass, modeLabel } from "@/lib/mode";
import { spotLonLat, type LonLat } from "@/lib/grid";
import { antipode, inGreyline, subsolarPoint } from "@/lib/grayline";
import { auroraOvals } from "@/lib/aurora";
import { interpolateMuf, mufAt, mufBandLabels, mufContours, MUF_SCALE, sfiToSsn } from "@/lib/muf";
import { bandOpenings } from "@/lib/openings";
import { bandRose, ROSE_SECTORS } from "@/lib/bandRose";
import { fmtAge } from "@/lib/format";
import { prepareQso, tuneSplitToSpot, tuneToSpot } from "@/lib/engage";
import { qsxFromComment } from "@/lib/split";
import { useCluster } from "@/store/useCluster";
import { useT } from "@/i18n";
import * as ipc from "@/lib/ipc";
import type { MyReport } from "@/lib/mapReports";
import type { MufStation } from "@/lib/types";
import type { CtyEntity, EnrichedSpot, SpotAction } from "@/lib/types";

const GRATICULE = geoGraticule10();
const RANGE_RINGS_KM = [3000, 6000, 9000, 12000];
const KM_PER_DEG = 111.319;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeoAny = any;

interface WorldData {
  land: GeoAny;
  borders: GeoAny;
}
let worldCache: WorldData | null = null;
async function loadWorld(): Promise<WorldData> {
  if (worldCache) return worldCache;
  const topo = (await (await fetch(worldUrl)).json()) as GeoAny;
  worldCache = {
    land: feature(topo, topo.objects.land),
    borders: mesh(topo, topo.objects.countries, (a: GeoAny, b: GeoAny) => a !== b),
  };
  return worldCache;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function ageClass(unix: number): string {
  const min = (Date.now() / 1000 - unix) / 60;
  if (min < 10) return "";
  if (min < 30) return " age1";
  if (min < 90) return " age2";
  return " age3";
}

export const WorldMap = memo(function WorldMap({
  spots,
  reports,
  actions,
  home,
  entities,
}: {
  spots: EnrichedSpot[];
  reports: MyReport[];
  actions: SpotAction[];
  home: LonLat | null;
  /** DXCC entities to label faintly with their prefix; empty to hide labels. */
  entities: CtyEntity[];
}) {
  const tr = useT();
  const projectionKind = useCluster((s) => s.mapProjection);
  const grayline = useCluster((s) => s.mapGrayline);
  const arcs = useCluster((s) => s.mapArcs);
  const greyline = useCluster((s) => s.mapGreyline);
  const aurora = useCluster((s) => s.mapAurora);
  const condHud = useCluster((s) => s.mapCondHud);
  const showRose = useCluster((s) => s.mapBandRose);
  const showMuf = useCluster((s) => s.mapMuf);
  const showOpenings = useCluster((s) => s.mapOpenings);
  const catEnabled = useCluster((s) => s.catEnabled);
  const logPushEnabled = useCluster((s) => s.logPushEnabled);
  const wwv = useCluster((s) => s.wwv);
  const wcy = useCluster((s) => s.wcy);
  const rules = useCluster((s) => s.alerts);
  const alertsEnabled = useCluster((s) => s.alertsEnabled);
  const activeRules = alertsEnabled ? rules : [];

  const latestWwv = wwv[0];
  const latestWcy = wcy[0];
  const kIndex = latestWwv?.k ?? latestWcy?.k ?? 0;
  // Sunspot number for the MUF model: WCY R, else derived from WWV SFI, else a
  // mid-cycle assumption (no solar broadcast seen yet).
  const ssn = latestWcy?.r ?? (latestWwv ? Math.round(sfiToSsn(latestWwv.sfi)) : 90);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<[number, number]>([900, 520]);
  const [world, setWorld] = useState<WorldData | null>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [menu, setMenu] = useState<{ x: number; y: number; spot: EnrichedSpot } | null>(null);
  const [popup, setPopup] = useState<{ x: number; y: number; spot: EnrichedSpot } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);
  const [mufStations, setMufStations] = useState<MufStation[]>([]);
  const [mufMeta, setMufMeta] = useState<{ source: string; ageSec: number | null }>({
    source: "none",
    ageSec: null,
  });
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    loadWorld()
      .then(setWorld)
      .catch((e) => console.warn("world map data failed to load", e));
  }, []);

  // Measured ionosonde data (kc2g): fetch when the MUF layer is on, refresh
  // every 15 min. A failure leaves us on the pure model.
  useEffect(() => {
    if (!showMuf) return;
    let cancelled = false;
    const load = () =>
      ipc
        .mufStations()
        .then((snap) => {
          if (cancelled) return;
          setMufStations(snap.stations);
          setMufMeta({ source: snap.source, ageSec: snap.age_sec });
        })
        .catch((e) => console.warn("muf stations failed to load", e));
    load();
    const t = window.setInterval(load, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [showMuf]);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize([el.clientWidth || 0, el.clientHeight || 0]);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const timeDependent = grayline || greyline || showMuf;
  useEffect(() => {
    if (!timeDependent) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 120_000);
    return () => window.clearInterval(t);
  }, [timeDependent]);
  // reset pan/zoom when the projection or QTH changes
  const homeKey = home ? `${home[0]},${home[1]}` : "";
  useEffect(() => setView({ k: 1, x: 0, y: 0 }), [projectionKind, homeKey]);

  // Non-passive wheel listener so preventDefault works (React's onWheel is passive).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setView((v) => {
        const k = clamp(v.k * (e.deltaY < 0 ? 1.2 : 1 / 1.2), 0.7, 16);
        const s = k / v.k;
        return { k, x: mx - s * (mx - v.x), y: my - s * (my - v.y) };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const [w, h] = size;
  const ready = w > 40 && h > 40;

  const projection = useMemo<GeoProjection | null>(() => {
    if (!ready) return null;
    try {
      let p: GeoProjection;
      if (projectionKind === "rect") {
        p = geoEquirectangular();
      } else {
        p = geoAzimuthalEquidistant().clipAngle(179.9);
        p.rotate(home ? [-home[0], -home[1], 0] : [0, -30, 0]);
      }
      p.fitExtent(
        [
          [6, 6],
          [w - 6, h - 6],
        ],
        { type: "Sphere" } as GeoAny,
      );
      return p;
    } catch (e) {
      console.warn("map projection failed", e);
      return null;
    }
  }, [ready, projectionKind, home, w, h]);

  const rawPath = useMemo(() => (projection ? geoPath(projection) : null), [projection]);
  const path = (obj: GeoAny): string | undefined => {
    if (!rawPath) return undefined;
    try {
      return rawPath(obj) ?? undefined;
    } catch {
      return undefined;
    }
  };

  const azim = projectionKind === "azimuthal";
  const project = (ll: LonLat): [number, number] | null => {
    if (!projection) return null;
    if (azim && home && geoDistance(home, ll) > Math.PI * 0.995) return null;
    let xy: [number, number] | null;
    try {
      xy = projection(ll);
    } catch {
      return null;
    }
    if (!xy || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) return null;
    return [xy[0], xy[1]];
  };
  const arcPath = (a: LonLat, b: LonLat) =>
    path({ type: "LineString", coordinates: [a, b] } as GeoAny);

  const nightPath = useMemo(() => {
    void tick;
    if (!grayline || !rawPath) return undefined;
    return path(
      geoCircle()
        .center(antipode(subsolarPoint(new Date())))
        .radius(90)() as GeoAny,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grayline, rawPath, tick]);

  // Grey-line band: the annulus between "Sun 9° up" and "Sun 9° down" — i.e. two
  // geoCircles centred on the sub-solar point, the outer minus the inner.
  const greyBandPath = useMemo(() => {
    void tick;
    if (!greyline || !rawPath) return undefined;
    const c = subsolarPoint(new Date());
    // Outer + inner ring as two subpaths; `fill-rule: evenodd` carves the annulus.
    const outer = path(geoCircle().center(c).radius(99)() as GeoAny) ?? "";
    const inner = path(geoCircle().center(c).radius(81)() as GeoAny) ?? "";
    return outer && inner ? outer + inner : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greyline, rawPath, tick]);

  const auroraPaths = useMemo(() => {
    if (!aurora || !rawPath) return [];
    return auroraOvals(kIndex)
      .map((o) => path(geoCircle().center(o.center).radius(o.radius)() as GeoAny))
      .filter((d): d is string => !!d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aurora, rawPath, kIndex]);

  // MUF as filled contour bands. Sample the MUF field on a coarse screen-space
  // grid (invert the projection at each node), run marching squares
  // (`d3-contour`) and paint one filled polygon per band — **no SVG filter**
  // (WebKitGTK is far too slow at those), and the whole thing is `useMemo`'d so
  // a pan/zoom only moves the parent transform, never reconciles the polygons.
  // Sampled in base (un-zoomed) screen space, so the deps exclude `view`.
  const MUF_CELL = 10;
  const mufBandPath = useMemo(() => geoPath(), []);
  const mufBands = useMemo(() => {
    void tick;
    if (!showMuf || !projection || !ready) return null;
    const invert = projection.invert;
    if (!invert) return null;
    const now = new Date();
    const gw = Math.max(2, Math.ceil(w / MUF_CELL) + 1);
    const gh = Math.max(2, Math.ceil(h / MUF_CELL) + 1);
    const values = new Array<number>(gw * gh);
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const ll = invert([i * MUF_CELL, j * MUF_CELL]);
        let v = 0;
        if (ll && Number.isFinite(ll[0]) && Number.isFinite(ll[1])) {
          // azimuthal `invert` extrapolates beyond the disc — clamp those out
          if (!azim || !home || geoDistance(home, ll as LonLat) < Math.PI) {
            const model = mufAt(ll as LonLat, now, ssn);
            v = mufStations.length ? interpolateMuf(mufStations, ll as LonLat, model).muf : model;
          }
        }
        values[j * gw + i] = v;
      }
    }
    return {
      bands: mufContours(values, gw, gh, MUF_CELL),
      labels: mufBandLabels(values, gw, gh, MUF_CELL),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMuf, projection, ready, w, h, ssn, tick, mufStations, azim, home]);

  // Bands: view-independent (a pan/zoom only moves the parent transform). The
  // 0-MHz "closed" band covers the whole grid — skip it so the layer never
  // washes the entire map; below 7 MHz just reads as bare ocean.
  const mufBandsLayer = useMemo(() => {
    if (!mufBands) return null;
    const bands = mufBands.bands.filter((b) => b.value > 0);
    if (bands.length === 0) return null;
    const d = (b: (typeof bands)[number]) =>
      mufBandPath({ type: "MultiPolygon", coordinates: b.coordinates } as GeoAny) ?? "";
    return (
      <>
        {/* faint filled bands… */}
        <g className="wm-muf-fill">
          {bands.map((b) => (
            <path key={b.value} d={d(b)} fill={b.color} />
          ))}
        </g>
        {/* …crisp iso-lines on top so the layer reads without hiding the map */}
        <g className="wm-muf-line">
          {bands.map((b) => (
            <path key={b.value} d={d(b)} stroke={b.color} />
          ))}
        </g>
      </>
    );
  }, [mufBands, mufBandPath]);

  // Labels: the band's MHz value written inside each region; only the font size
  // tracks the zoom (cheap — a handful of <text> nodes).
  const mufLabelsLayer = useMemo(() => {
    if (!mufBands || mufBands.labels.length === 0) return null;
    return (
      <g className="wm-muf-labels">
        {mufBands.labels.map((l, i) => (
          <text key={i} x={l.x} y={l.y} fontSize={18 / view.k}>
            {l.value}
          </text>
        ))}
      </g>
    );
  }, [mufBands, view.k]);

  const mufLayer =
    mufBandsLayer || mufLabelsLayer ? (
      <g className="wm-muf" clipPath="url(#wm-sphere-clip)">
        {mufBandsLayer}
        {mufLabelsLayer}
      </g>
    ) : null;

  const openingArcs = useMemo(() => {
    if (!showOpenings) return [];
    const out: { d: string; mode: string; ageMin: number }[] = [];
    for (const o of bandOpenings(spots, 30)) {
      const d = arcPath(o.a, o.b);
      if (d) out.push({ d, mode: modeClass(o.mode), ageMin: o.ageMin });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOpenings, spots, projection, home]);

  const rose = useMemo(() => (showRose ? bandRose(spots) : []), [showRose, spots]);
  const isGrey = (s: EnrichedSpot): boolean => {
    if (!greyline) return false;
    const ll = spotLonLat(s);
    return ll ? inGreyline(ll, new Date()) : false;
  };

  /** Petal <path>s for the band rose, centred at (cx,cy) with a given reach.
   *  Each petal is a stack of mode-coloured segments (base → tip), sized by that
   *  mode's share of the sector — so a digi-heavy direction still shows its
   *  CW / SSB slice instead of the whole petal going violet. */
  const rosePetals = (cx: number, cy: number, reach: number, cls: string) => {
    const max = Math.max(1, ...rose.map((s) => s.count));
    return rose.map((sec) => {
      if (!sec.count) return null;
      const total = reach * (0.15 + 0.85 * (Math.log1p(sec.count) / Math.log1p(max)));
      const a0 = (sec.index / ROSE_SECTORS) * 2 * Math.PI - Math.PI / ROSE_SECTORS;
      const a1 = a0 + (2 * Math.PI) / ROSE_SECTORS;
      const pt = (r: number, a: number) =>
        `${(cx + Math.sin(a) * r).toFixed(1)} ${(cy - Math.cos(a) * r).toFixed(1)}`;
      const seg = (r0: number, r1: number) =>
        r0 < 0.5
          ? `M ${pt(0, a0)} L ${pt(r1, a0)} A ${r1} ${r1} 0 0 1 ${pt(r1, a1)} Z`
          : `M ${pt(r0, a0)} L ${pt(r1, a0)} A ${r1} ${r1} 0 0 1 ${pt(r1, a1)} ` +
            `L ${pt(r0, a1)} A ${r0} ${r0} 0 0 0 ${pt(r0, a0)} Z`;
      let r = 0;
      return (
        <g key={sec.index}>
          {sec.modes.map((m) => {
            const r0 = r;
            r += total * (m.count / sec.count);
            return <path key={m.mode} className={`${cls} ${modeClass(m.mode)}`} d={seg(r0, r)} />;
          })}
          <title>
            {`${sec.count} · ${sec.modes.map((m) => `${m.mode} ${m.count}`).join("  ")}` +
              (sec.bands.length ? ` · ${sec.bands.join(" ")}` : "")}
          </title>
        </g>
      );
    });
  };
  const roseAtQth = showRose && azim && !!home && rose.some((s) => s.count > 0);

  const spotMarks = useMemo(() => {
    const out: { s: EnrichedSpot; xy: [number, number] }[] = [];
    for (const s of spots) {
      const ll = spotLonLat(s);
      if (!ll) continue;
      const xy = project(ll);
      if (xy) out.push({ s, xy });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots, projection, home]);

  const reportMarks = useMemo(() => {
    const out: { r: MyReport; xy: [number, number] }[] = [];
    for (const r of reports) {
      const xy = project(r.lonLat);
      if (xy) out.push({ r, xy });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, projection, home]);

  // Faint DXCC prefix labels: greedily drop any that land too close (in screen
  // px) to one already placed, so the world view stays readable — zooming in
  // shrinks the exclusion radius in projected space, so more labels appear.
  const labelMarks = useMemo(() => {
    if (!projection || entities.length === 0) return [];
    const minD = 32 / view.k;
    const placed: [number, number][] = [];
    const out: { prefix: string; xy: [number, number] }[] = [];
    for (const e of entities) {
      const xy = project([e.lon, e.lat]);
      if (!xy) continue;
      if (placed.some(([px, py]) => Math.hypot(px - xy[0], py - xy[1]) < minD)) continue;
      placed.push(xy);
      out.push({ prefix: e.primary_prefix, xy });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, projection, home, view.k]);

  const homeXY = home ? project(home) : null;

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX - view.x, y: e.clientY - view.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    setView((v) => ({ ...v, x: e.clientX - d.x, y: e.clientY - d.y }));
  }
  function onPointerUp() {
    drag.current = null;
  }

  // Left-click a spot → a tidy fact card; right-click → straight to the menu.
  function pickSpot(e: MouseEvent, s: EnrichedSpot) {
    e.preventDefault();
    e.stopPropagation();
    setPopup({ x: e.clientX, y: e.clientY, spot: s });
    setMenu(null);
  }
  function openMenu(e: MouseEvent, s: EnrichedSpot) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, spot: s });
    setPopup(null);
  }

  // Dismiss the popup on an outside click or Escape.
  useEffect(() => {
    if (!popup) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (!popupRef.current?.contains(e.target as Node)) setPopup(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopup(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [popup]);

  const R = 5.5 / view.k;
  const g = `translate(${view.x} ${view.y}) scale(${view.k})`;

  return (
    <div className="worldmap" ref={wrapRef}>
      <svg
        ref={svgRef}
        width={Math.max(0, w)}
        height={Math.max(0, h)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={() => setMenu(null)}
      >
        {showMuf && ready && rawPath && (
          <defs>
            {/* Base (pre-transform) coords — the referencing <g.wm-muf> already
                sits inside <g transform={g}>, so userSpaceOnUse lines them up. */}
            <clipPath id="wm-sphere-clip">
              <path d={path({ type: "Sphere" } as GeoAny)} />
            </clipPath>
          </defs>
        )}
        {ready && rawPath && (
          <g transform={g}>
            <path className="wm-sphere" d={path({ type: "Sphere" } as GeoAny)} />
            <path className="wm-graticule" d={path(GRATICULE)} />
            {world && <path className="wm-land" d={path(world.land)} />}
            {world && <path className="wm-borders" d={path(world.borders)} />}

            {nightPath && <path className="wm-night" d={nightPath} />}
            {greyBandPath && <path className="wm-greyband" d={greyBandPath} />}

            {mufLayer}

            {roseAtQth && homeXY && (
              <g className="wm-rose-bloom">
                {rosePetals(homeXY[0], homeXY[1], Math.min(w, h) * 0.34, "wm-rose-bloom-petal")}
              </g>
            )}

            {auroraPaths.map((d, i) => (
              <path key={`aur${i}`} className="wm-aurora" d={d} />
            ))}

            {openingArcs.map((o, i) => (
              <path
                key={`op${i}`}
                className={`wm-opening ${o.mode}`}
                d={o.d}
                style={{ opacity: o.ageMin < 10 ? 0.28 : o.ageMin < 20 ? 0.18 : 0.1 }}
              />
            ))}

            {azim &&
              home &&
              homeXY &&
              RANGE_RINGS_KM.map((km) => (
                <path
                  key={km}
                  className="wm-ring"
                  d={path(
                    geoCircle()
                      .center(home)
                      .radius(km / KM_PER_DEG)() as GeoAny,
                  )}
                />
              ))}

            {arcs &&
              home &&
              spotMarks.map(({ s }) => {
                const ll = spotLonLat(s)!;
                return <path key={`a${s.id}`} className="wm-arc" d={arcPath(home, ll)} />;
              })}

            {home &&
              reportMarks.map(({ r }) => (
                <path key={`ra${r.spot.id}`} className="wm-arc rbn" d={arcPath(home, r.lonLat)} />
              ))}

            {spotMarks.map(({ s, xy }) => {
              const hit = activeRules.length && matchingAlert(s, activeRules);
              const cls = `wm-spot ${modeClass(s.mode)}${s.is_skimmer ? " skimmer" : ""}${
                hit ? " alert" : ""
              }${isGrey(s) ? " grey" : ""}${ageClass(s.received_at)}`;
              return (
                <circle
                  key={s.id}
                  className={cls}
                  cx={xy[0]}
                  cy={xy[1]}
                  r={R * (s.is_skimmer ? 0.72 : 1)}
                  onClick={(e) => pickSpot(e, s)}
                  onContextMenu={(e) => openMenu(e, s)}
                >
                  <title>{s.dx_call}</title>
                </circle>
              );
            })}

            {reportMarks.map(({ r, xy }) => {
              const d = R * 1.5;
              return (
                <path
                  key={`r${r.spot.id}`}
                  className="wm-report"
                  transform={`translate(${xy[0]} ${xy[1]})`}
                  d={`M0 ${-d} L${d} 0 L0 ${d} L${-d} 0 Z`}
                  onClick={(e) => pickSpot(e, r.spot)}
                  onContextMenu={(e) => openMenu(e, r.spot)}
                >
                  <title>{r.count > 1 ? `${r.spot.spotter} ×${r.count}` : r.spot.spotter}</title>
                </path>
              );
            })}

            {labelMarks.map(({ prefix, xy }) => (
              <text
                key={`${prefix}@${xy[0].toFixed(0)},${xy[1].toFixed(0)}`}
                className="wm-country-label"
                x={xy[0]}
                y={xy[1]}
                fontSize={9 / view.k}
              >
                {prefix}
              </text>
            ))}

            {homeXY && (
              <path
                className="wm-home"
                transform={`translate(${homeXY[0]} ${homeXY[1]}) scale(${1.3 / view.k})`}
                d="M0,-7 L2,-2 L7,-2 L3,1.5 L4.5,7 L0,3.5 L-4.5,7 L-3,1.5 L-7,-2 L-2,-2 Z"
              />
            )}
          </g>
        )}

        {showRose && !roseAtQth && rose.some((s) => s.count > 0) && (
          <g className="wm-rose" transform={`translate(64 ${Math.max(64, h - 64)})`}>
            <circle className="wm-rose-ring" r={46} />
            <circle className="wm-rose-ring" r={23} />
            <text className="wm-rose-n" y={-50}>
              N
            </text>
            {rosePetals(0, 0, 46, "wm-rose-petal")}
          </g>
        )}
      </svg>

      {showMuf && (
        <div className="wm-muf-legend" title={tr("map.mufLegendHint")}>
          <span className="wm-muf-legend-title">
            {tr("map.mufLegend")} ·{" "}
            {mufMeta.source === "kc2g"
              ? `kc2g · ${mufStations.length}`
              : `${tr("map.mufModel")} · SSN ${ssn}`}
          </span>
          {MUF_SCALE.map(({ color, label }) => (
            <span key={label} className="wm-muf-legend-step">
              <i
                style={{
                  background: `color-mix(in srgb, ${color} 18%, transparent)`,
                  borderColor: color,
                }}
              />
              {label}
            </span>
          ))}
        </div>
      )}

      {condHud && (latestWwv || latestWcy) && (
        <div className={`wm-hud k${Math.min(9, Math.round(kIndex))}`}>
          {latestWwv && (
            <>
              <span>
                SFI <b>{latestWwv.sfi}</b>
              </span>
              <span>
                A <b>{latestWwv.a}</b>
              </span>
            </>
          )}
          <span>
            K <b>{kIndex}</b>
          </span>
          <span>
            SSN <b>{ssn}</b>
          </span>
        </div>
      )}

      {popup &&
        (() => {
          const s = popup.spot;
          const rep = reports.find((r) => r.spot.id === s.id);
          const repComments = rep ? rep.members.filter((m) => m.comment) : [];
          const qsx = catEnabled && s.comment ? qsxFromComment(s.comment, s.freq_khz) : null;
          const rows: [string, string][] = [];
          rows.push([tr("col.khz"), `${s.freq_khz.toFixed(1)}${s.band ? `  ·  ${s.band}` : ""}`]);
          rows.push([tr("col.mode"), modeLabel(s.mode, s.comment)]);
          if (qsx != null) {
            const d = qsx - s.freq_khz;
            rows.push([
              tr("col.split"),
              `${qsx.toFixed(1)}  ·  ${d > 0 ? "+" : ""}${d.toFixed(1)}`,
            ]);
          }
          if (s.dx)
            rows.push([
              tr("col.dxcc"),
              `${s.dx.dxcc_name}  ·  ${s.dx.continent}  ·  CQ ${s.dx.cq_zone}`,
            ]);
          rows.push([
            rep ? tr("map.heardBy") : tr("col.spotter"),
            `${s.by ? `${s.spotter}  ·  ${s.by.dxcc_name}` : s.spotter}${
              rep && rep.count > 1
                ? `  ·  ×${rep.count}${rep.feeds > 1 ? ` (${rep.feeds} ${tr("map.reportFeeds")})` : ""}`
                : ""
            }`,
          ]);
          if (rep && (rep.snrDb != null || rep.wpm != null))
            rows.push([
              "SNR",
              `${rep.snrDb != null ? `${rep.snrDb} dB` : ""}${
                rep.wpm != null ? `  ·  ${rep.wpm} WPM` : ""
              }`.trim(),
            ]);
          if (s.dx?.bearing_deg != null)
            rows.push([
              tr("col.beam"),
              `${Math.round(s.dx.bearing_deg)}°${
                s.dx.distance_km != null ? `  ·  ${Math.round(s.dx.distance_km)} km` : ""
              }`,
            ]);
          rows.push([tr("col.age"), `${fmtAge(s.received_at)}  ·  ${s.time_hhmm} UTC`]);
          const px = Math.max(8, Math.min(popup.x + 12, window.innerWidth - 276));
          const py = Math.max(8, Math.min(popup.y + 8, window.innerHeight - 240));
          return (
            <div className="wm-popup" ref={popupRef} style={{ left: px, top: py }}>
              <div className="wm-popup-head">
                <span className={`wm-popup-call ${modeClass(s.mode)}`}>{s.dx_call}</span>
                <button
                  className="wm-popup-x"
                  onClick={() => setPopup(null)}
                  title={tr("map.spotClose")}
                  aria-label={tr("map.spotClose")}
                >
                  ×
                </button>
              </div>
              <dl className="wm-popup-rows">
                {rows.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              {repComments.length > 1 ? (
                <ul className="wm-popup-reports">
                  {repComments.map((m) => (
                    <li key={m.id}>
                      <span className="wm-popup-report-age">{fmtAge(m.received_at)}</span>
                      {m.comment}
                    </li>
                  ))}
                </ul>
              ) : (
                s.comment && <p className="wm-popup-comment">{s.comment}</p>
              )}
              {(catEnabled || logPushEnabled) && (
                <div className="wm-popup-engage">
                  {catEnabled && (
                    <button onClick={() => void tuneToSpot(s)}>{tr("spots.menu.tuneRadio")}</button>
                  )}
                  {catEnabled && qsx != null && (
                    <button onClick={() => void tuneSplitToSpot(s)}>
                      {tr("spots.menu.tuneSplit", { f: qsx.toFixed(1) })}
                    </button>
                  )}
                  {logPushEnabled && (
                    <button onClick={() => void prepareQso(s)}>{tr("spots.menu.prepQso")}</button>
                  )}
                </div>
              )}
              {actions.length > 0 && (
                <button
                  className="wm-popup-actions"
                  onClick={() => {
                    setMenu({ x: popup.x, y: popup.y, spot: s });
                    setPopup(null);
                  }}
                >
                  {tr("map.spotActions")} ▾
                </button>
              )}
            </div>
          );
        })()}

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
