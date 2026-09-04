// TypeScript mirrors of the `dxcluster-core` / `src-tauri` serde types.
// Keep in sync with:
//   crates/dxcluster-core/src/{connection,commands,band}.rs
//   src-tauri/src/enrich.rs

export type ConnState = "connecting" | "logging_in" | "online" | "disconnected";

export type Mode = "CW" | "SSB" | "DIGI" | "FM" | "UNKNOWN";

/** A normal cluster node (accepts commands) vs the RBN raw telnet feed. */
export type NodeKind = "cluster" | "rbn";

/** Command dialect for a `"cluster"`-kind node — which syntax the command
 *  builder generates for spot filters and `SH/DX` queries. Everything besides
 *  AR-Cluster (CC Cluster, DxNet, CLX, WinCluster, AK1A, …) defaults to the
 *  DXSpider-style AK1A syntax. */
export type NodeSoftware = "dx_spider" | "ar_cluster";

export interface NodeProfile {
  id: string;
  host: string;
  port: number;
  callsign: string;
  password?: string | null;
  on_login: string[];
  auto_connect?: boolean;
  kind?: NodeKind;
  software?: NodeSoftware;
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

export interface StoredAnnounce {
  id: number;
  node_id: string;
  received_at: number;
  sender: string;
  target: string; // "ALL", "LOCAL", a call, or "WX"
  text: string;
  is_wx: boolean;
}

export interface StoredWwv {
  id: number;
  node_id: string;
  received_at: number;
  sender: string;
  hour: number;
  sfi: number;
  a: number;
  k: number;
  forecast: string;
}

export interface StoredWcy {
  id: number;
  node_id: string;
  received_at: number;
  sender: string;
  hour: number;
  k: number;
  expk: number;
  a: number;
  r: number;
  sfi: number;
  sa: string;
  gmf: string;
  aurora: string;
}

export interface StoredTalk {
  id: number;
  node_id: string;
  received_at: number;
  outgoing: boolean;
  peer: string;
  text: string;
}

export interface StoredChat {
  id: number;
  node_id: string;
  received_at: number;
  outgoing: boolean;
  group: string;
  sender: string;
  text: string;
}

export interface StationInfo {
  call: string;
  fields: [string, string][];
}

export interface CtyStatus {
  entities: number;
  source: "downloaded" | "bundled" | "none";
  age_days: number | null;
  updated: boolean;
}

/** Status of the bundled/downloaded cluster node preset list. */
export interface PresetsStatus {
  count: number;
  source: "downloaded" | "bundled" | "none";
  age_days: number | null;
  version: string | null;
  updated: boolean;
}

/** A preset cluster node with country resolved from its callsign. */
export interface ClusterPreset {
  name: string;
  host: string;
  port: number;
  software: string;
  dxcc: string | null;
  continent: string | null;
  prefix: string | null;
}

/** One ionosonde station's latest measurement (kc2g / GIRO). */
export interface MufStation {
  lat: number;
  lon: number;
  /** MUF(3000 km), MHz. */
  mufd: number;
  fof2: number | null;
  /** Confidence score, 0..100. */
  cs: number;
  name: string;
}

/** Measured-MUF snapshot from the `muf_stations` command. */
export interface MufSnapshot {
  stations: MufStation[];
  /** Age of the data in seconds, or null if never fetched. */
  age_sec: number | null;
  source: "kc2g" | "none";
}

/** A DXCC entity from cty.dat — mirror of Rust `reference::Entity`. */
export interface CtyEntity {
  name: string;
  cq_zone: number;
  itu_zone: number;
  continent: string;
  lat: number;
  lon: number;
  primary_prefix: string;
}

export interface HistSpot {
  freq_khz: number;
  dx_call: string;
  date: string;
  time: string;
  comment: string;
  spotter: string;
  band: string | null;
  mode: Mode;
}

export type HistRow = HistSpot & { dxcc: string | null };

export interface MailHeader {
  msgno: number;
  read: boolean;
  private: boolean;
  size: number;
  to: string;
  from: string;
  date: string;
  time: string;
  subject: string;
}

export interface StoredMail {
  node_id: string;
  msgno: number;
  from: string;
  to: string;
  subject: string;
  posted: string;
  body: string;
  fetched_at: number;
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
  spotter_continents: string[];
  modes: Mode[];
  skimmer: SkimmerPref;
  /** Frontend-only: whether this rule may also be pushed to the node's own
   *  accept/reject list (vs. staying a purely local GUI filter). The Rust side
   *  ignores this field — it only gates the "apply to node" UI. */
  pushToNode: boolean;
  /** Frontend-only: stable id (for React keys / expanded state), optional
   *  label + per-rule on/off (like alert rules). */
  id?: string;
  label?: string;
  enabled?: boolean;
}

export function emptyFilter(): SpotFilter {
  return {
    id: crypto.randomUUID(),
    action: "accept",
    bands: [],
    dx_call_prefixes: [],
    spotter_call_prefixes: [],
    dx_dxcc: [],
    spotter_dxcc: [],
    dx_cq_zones: [],
    spotter_cq_zones: [],
    dx_continents: [],
    spotter_continents: [],
    modes: [],
    skimmer: "include",
    pushToNode: false,
    label: "",
    enabled: true,
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

export const ALL_MODES: Mode[] = ["CW", "SSB", "DIGI", "FM"];
export const ALL_CONTINENTS = ["EU", "NA", "SA", "AS", "AF", "OC", "AN"];

/** A right-click action on a spot row / bandmap marker. */
export interface SpotAction {
  label: string;
  run: (s: EnrichedSpot) => void;
}

// --- CAT (rig control) + logging-program push -------------------------------

/** How the CAT session reaches the rig — mirror of Rust `rigctl::RigTransport`. */
export type RigTransport =
  | { kind: "network"; host: string; port: number }
  | { kind: "serial"; model_id: number; device: string; baud: number; port: number };

/** Mirror of Rust `rigctl::RigConfig`. */
export interface RigConfig {
  transport: RigTransport;
  poll: boolean;
}

/** One entry from `rigctl -l` — mirror of Rust `rigctl::RigModel`. */
export interface RigModel {
  id: number;
  mfg: string;
  model: string;
  status: string;
}

/** A VFO reading from the `rig://vfo` event. */
export interface RigVfo {
  freqHz: number;
  mode: string;
}

/** Wire format for the "prepare a QSO" push — mirror of Rust `logpush::LogFormat`. */
export type LogFormat = "wsjtx" | "adif";
