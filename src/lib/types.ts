// TypeScript mirrors of the `dxcluster-core` / `src-tauri` serde types.
// Keep in sync with:
//   crates/dxcluster-core/src/{connection,commands,band}.rs
//   src-tauri/src/enrich.rs

export type ConnState = "connecting" | "logging_in" | "online" | "disconnected";

export type Mode = "CW" | "SSB" | "FT" | "DIGI" | "FM" | "UNKNOWN";

export interface NodeProfile {
  id: string;
  host: string;
  port: number;
  callsign: string;
  password?: string | null;
  on_login: string[];
}

export interface CallInfo {
  dxcc_name: string;
  primary_prefix: string;
  continent: string;
  cq_zone: number;
  itu_zone: number;
  lat: number;
  lon: number;
  bearing_deg: number | null;
  distance_km: number | null;
}

export interface EnrichedSpot {
  id: number;
  node_id: string;
  received_at: number; // unix seconds
  spotter: string;
  spotter_base: string;
  freq_khz: number;
  dx_call: string;
  comment: string;
  time_hhmm: string;
  grid: string | null;
  band: string | null;
  mode: Mode;
  is_skimmer: boolean;
  dx: CallInfo | null;
  by: CallInfo | null; // spotter's DXCC info
}

export type FilterAction = "accept" | "reject";
export type SkimmerPref = "include" | "exclude" | "only";

export interface SpotFilter {
  action: FilterAction;
  bands: string[];
  dx_call_prefixes: string[];
  spotter_call_prefixes: string[];
  dx_dxcc: string[];
  spotter_dxcc: string[];
  dx_cq_zones: number[];
  spotter_cq_zones: number[];
  dx_continents: string[];
  modes: Mode[];
  skimmer: SkimmerPref;
}

export function emptyFilter(): SpotFilter {
  return {
    action: "accept",
    bands: [],
    dx_call_prefixes: [],
    spotter_call_prefixes: [],
    dx_dxcc: [],
    spotter_dxcc: [],
    dx_cq_zones: [],
    spotter_cq_zones: [],
    dx_continents: [],
    modes: [],
    skimmer: "include",
  };
}

export const ALL_BANDS = [
  "160m",
  "80m",
  "60m",
  "40m",
  "30m",
  "20m",
  "17m",
  "15m",
  "12m",
  "10m",
  "6m",
  "4m",
  "2m",
  "70cm",
];

export const ALL_MODES: Mode[] = ["CW", "SSB", "FT", "DIGI", "FM"];
export const ALL_CONTINENTS = ["EU", "NA", "SA", "AS", "AF", "OC", "AN"];
