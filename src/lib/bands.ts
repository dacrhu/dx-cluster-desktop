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

/** Nice tick spacing (kHz) for a lane spanning `spanKhz`. */
export function tickStepKhz(spanKhz: number): number {
  if (spanKhz <= 60) return 10;
  if (spanKhz <= 200) return 25;
  if (spanKhz <= 600) return 50;
  if (spanKhz <= 1200) return 100;
  return 250;
}
