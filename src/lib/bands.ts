// Band edges + rough CW / DIGI / PHONE sub-band boundaries for the Bandmap
// lanes. Boundaries follow the IARU Region-1 band plan closely enough to serve
// as a visual hint (spots carry no structured mode); upper edges use the widest
// common allocation so edge spots still land in a lane.

export interface BandmapBand {
  label: string;
  lowKhz: number;
  highKhz: number;
  /** CW segment upper edge. */
  cwToKhz: number;
  /** DIGI segment upper edge (equals `highKhz` on bands with no phone segment). */
  digiToKhz: number;
}

export const BANDMAP_BANDS: BandmapBand[] = [
  { label: "160m", lowKhz: 1800, highKhz: 2000, cwToKhz: 1838, digiToKhz: 1843 },
  { label: "80m", lowKhz: 3500, highKhz: 4000, cwToKhz: 3580, digiToKhz: 3620 },
  { label: "60m", lowKhz: 5250, highKhz: 5450, cwToKhz: 5250, digiToKhz: 5450 },
  { label: "40m", lowKhz: 7000, highKhz: 7300, cwToKhz: 7040, digiToKhz: 7090 },
  { label: "30m", lowKhz: 10100, highKhz: 10150, cwToKhz: 10130, digiToKhz: 10150 },
  { label: "20m", lowKhz: 14000, highKhz: 14350, cwToKhz: 14070, digiToKhz: 14099 },
  { label: "17m", lowKhz: 18068, highKhz: 18168, cwToKhz: 18095, digiToKhz: 18109 },
  { label: "15m", lowKhz: 21000, highKhz: 21450, cwToKhz: 21070, digiToKhz: 21150 },
  { label: "12m", lowKhz: 24890, highKhz: 24990, cwToKhz: 24915, digiToKhz: 24931 },
  { label: "10m", lowKhz: 28000, highKhz: 29700, cwToKhz: 28070, digiToKhz: 28190 },
  { label: "6m", lowKhz: 50000, highKhz: 54000, cwToKhz: 50100, digiToKhz: 50500 },
  { label: "2m", lowKhz: 144000, highKhz: 148000, cwToKhz: 144150, digiToKhz: 144500 },
];

export type IaruRegion = 1 | 2 | 3;

/**
 * Where each band actually ends per IARU region (the `BANDMAP_BANDS` limits are
 * the widest allocation of any region, so spots anywhere still land in a lane).
 * Only bands that differ from the widest range are listed; national allocations
 * vary a bit within a region, these are the usual IARU band-plan limits.
 */
const REGION_EDGES: Record<IaruRegion, Record<string, [number, number]>> = {
  1: {
    "160m": [1810, 2000],
    "80m": [3500, 3800],
    "60m": [5351.5, 5366.5],
    "40m": [7000, 7200],
    "6m": [50000, 52000],
    "2m": [144000, 146000],
  },
  2: { "60m": [5330, 5406] },
  3: { "80m": [3500, 3900], "40m": [7000, 7200] },
};

/** The band's start/end in the given IARU region (null region = widest range). */
export function regionEdges(b: BandmapBand, region: IaruRegion | null): [number, number] {
  const e = region ? REGION_EDGES[region][b.label] : undefined;
  return e ?? [b.lowKhz, b.highKhz];
}

/** Rough IARU region from a continent code (see `lonLatToContinent`). */
export function regionForContinent(cont: string | null): IaruRegion | null {
  switch (cont) {
    case "EU":
    case "AF":
      return 1;
    case "NA":
    case "SA":
      return 2;
    case "AS":
    case "OC":
      return 3;
    default:
      return null;
  }
}

export type SegMode = "CW" | "DIGI" | "SSB";

export interface BandSegment {
  mode: SegMode;
  fromKhz: number;
  toKhz: number;
}

/** The CW / DIGI / PHONE bands of a lane, for background shading. */
export function bandSegments(b: BandmapBand): BandSegment[] {
  const segs: BandSegment[] = [];
  if (b.cwToKhz > b.lowKhz) segs.push({ mode: "CW", fromKhz: b.lowKhz, toKhz: b.cwToKhz });
  if (b.digiToKhz > b.cwToKhz)
    segs.push({ mode: "DIGI", fromKhz: Math.max(b.cwToKhz, b.lowKhz), toKhz: b.digiToKhz });
  if (b.highKhz > b.digiToKhz) segs.push({ mode: "SSB", fromKhz: b.digiToKhz, toKhz: b.highKhz });
  return segs;
}

export type OptionalMarkerKind = "sstv" | "ft8" | "ft4" | "ft2" | "js8" | "rtty" | "freedv";
export type SpecialFreqKind = "sos" | "ibp" | OptionalMarkerKind | "custom";

export interface SpecialFreq {
  khz: number;
  /** Primary kind (drives colour + hint); several markers on one kHz merge into one row. */
  kind: SpecialFreqKind;
  /** Row text. Defaults to the upper-cased kind; merged / custom rows carry their own. */
  label?: string;
  /** Custom-marker colour (CSS colour). */
  color?: string;
}

/** A user-defined marker frequency (e.g. the one a local net uses). */
export interface CustomMarker {
  id: string;
  name: string;
  khz: number;
  color?: string;
}

// IARU Region 1 HF band-plan "global emergency" simplex frequencies: the
// de-facto calling/coordination points for disaster and emergency traffic.
// Not an official distress frequency (there is no such thing in the amateur
// bands) — a courtesy marker so operators think twice before parking on one.
const SOS_KHZ = [3760, 7110, 14300, 18160, 21360, 24960, 28360];

// NCDXF/IARU International Beacon Project: 18 beacons world-wide, round-robin
// every 10s in an endless 3-minute cycle, one transmitter at a time per
// frequency — a quick propagation check across bands.
const IBP_KHZ = [14100, 18110, 21150, 24930, 28200];

/**
 * Opt-in operating-frequency markers (dial / calling frequencies, kHz). Common
 * conventions, not allocations — a band-plan hint like SOS/IBP. The display
 * order here is the order in the Markers menu.
 */
export const OPTIONAL_MARKERS: Record<OptionalMarkerKind, number[]> = {
  ft8: [1840, 3573, 5357, 7074, 10136, 14074, 18100, 21074, 24915, 28074, 50313],
  ft4: [3575, 7047.5, 10140, 14080, 18104, 21140, 24919, 28180, 50318],
  // FT2 (IU8LMC): published calling freqs; 40m moved 7052 -> 7062.
  ft2: [1843, 3578, 5360, 7062, 10144, 14084, 18108, 21144, 24923, 28184],
  js8: [1842, 3578, 7078, 10130, 14078, 18104, 21078, 24922, 28078],
  rtty: [3590, 7040, 10140, 14083, 18105, 21083, 24920, 28083],
  sstv: [3730, 3845, 7033, 7165, 14230, 18160, 21340, 24975, 28680],
  freedv: [1997, 3625, 7177, 14236, 21313, 24931, 28330],
};
export const OPTIONAL_MARKER_KINDS = Object.keys(OPTIONAL_MARKERS) as OptionalMarkerKind[];

export const SPECIAL_FREQS: SpecialFreq[] = [
  ...SOS_KHZ.map((khz) => ({ khz, kind: "sos" as const })),
  ...IBP_KHZ.map((khz) => ({ khz, kind: "ibp" as const })),
];

const KIND_RANK: Record<SpecialFreqKind, number> = {
  sos: 0,
  ibp: 1,
  custom: 2,
  ft8: 3,
  ft4: 4,
  ft2: 5,
  js8: 6,
  rtty: 7,
  sstv: 8,
  freedv: 9,
};

const kindLabel = (k: SpecialFreqKind) => (k === "freedv" ? "FreeDV" : k.toUpperCase());

/**
 * The marker rows for one band's lane: SOS + IBP always, plus the enabled
 * optional kinds and the user's custom frequencies. Markers on the same kHz
 * merge into a single row (primary kind wins the colour, labels are joined),
 * so the Lane can key rows by frequency.
 */
export function specialFreqsInBand(
  b: BandmapBand,
  enabled: readonly string[] = [],
  custom: readonly CustomMarker[] = [],
): SpecialFreq[] {
  const all: SpecialFreq[] = [...SPECIAL_FREQS];
  for (const k of OPTIONAL_MARKER_KINDS) {
    if (enabled.includes(k)) for (const khz of OPTIONAL_MARKERS[k]) all.push({ khz, kind: k });
  }
  for (const c of custom) {
    all.push({ khz: c.khz, kind: "custom", label: c.name || undefined, color: c.color });
  }
  const byKhz = new Map<number, SpecialFreq[]>();
  for (const f of all) {
    if (f.khz < b.lowKhz || f.khz > b.highKhz) continue;
    const l = byKhz.get(f.khz);
    if (l) l.push(f);
    else byKhz.set(f.khz, [f]);
  }
  const out: SpecialFreq[] = [];
  for (const group of byKhz.values()) {
    group.sort((x, y) => KIND_RANK[x.kind] - KIND_RANK[y.kind]);
    const head = group[0];
    out.push(
      group.length === 1
        ? head
        : { ...head, label: group.map((g) => g.label ?? kindLabel(g.kind)).join(" · ") },
    );
  }
  return out.sort((x, y) => x.khz - y.khz);
}

/** Row text for a marker. */
export function specialLabel(f: SpecialFreq): string {
  return f.label ?? kindLabel(f.kind);
}

/** Nice tick spacing (kHz) for a lane spanning `spanKhz`. */
export function tickStepKhz(spanKhz: number): number {
  if (spanKhz <= 60) return 10;
  if (spanKhz <= 200) return 25;
  if (spanKhz <= 600) return 50;
  if (spanKhz <= 1200) return 100;
  return 250;
}
