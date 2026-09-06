import { load, type Store } from "@tauri-apps/plugin-store";
import type { AlertHit, AlertRule } from "./alerts";
import type { AlertSound } from "./notify";
import type { LogFormat, NodeProfile, SpotFilter } from "./types";

// Persisted settings live in a single JSON store file managed by
// tauri-plugin-store (in the app config dir).

let storePromise: Promise<Store> | null = null;

function store(): Promise<Store> {
  if (!storePromise) storePromise = load("settings.json", { autoSave: true });
  return storePromise;
}

export interface AppSettings {
  homeLocator: string;
  spotHistoryLimit: number;
  chatGroups: string[];
  alertRules: AlertRule[];
  alertsEnabled: boolean;
  alertsSound: boolean;
  alertSoundStyle: AlertSound;
  ctyAutoUpdate: boolean;
  /** Weekly auto-update of the cluster node preset list. */
  presetsAutoUpdate: boolean;
  lang: "system" | "en" | "hu" | "de";
  /** Global age cap (minutes) for spot lists + alert hits; 0 = show all.
   *  `alertHitTtlMin` is the pre-1.x name, still read on load. */
  spotMaxAgeMin: number;
  alertHitTtlMin?: number;
  /** Bandmap vertical zoom factor. */
  bandmapZoom: number;
  /** Map panel. */
  mapProjection: "azimuthal" | "rect";
  mapGrayline: boolean;
  mapArcs: boolean;
  mapLabels: boolean;
  mapGreyline: boolean;
  mapAurora: boolean;
  mapCondHud: boolean;
  mapBandRose: boolean;
  mapMuf: boolean;
  mapOpenings: boolean;
  /** PSK Reporter "who hears me" feed (digital modes). Off unless opted in. */
  pskrEnabled: boolean;
  /** Callsign(s) to watch on PSK Reporter; comma/space separated. Empty = use
   *  the connection profiles' callsigns. */
  pskrCallsigns: string;
  /** WSJT-X local UDP feed ("what my radio hears"). Off unless opted in. */
  wsjtxEnabled: boolean;
  /** WSJT-X UDP listen address (`host:port`). */
  wsjtxBind: string;
  /** Show WSJT-X-sourced spots in the spot views. */
  spotShowWsjtx: boolean;
  /** Auto-poll the mailbox while online and flag new mail (tab dot + toast). */
  mailWatchEnabled: boolean;

  // --- CAT (rig control) ---
  /** Drive the radio over Hamlib `rigctld`. Off unless opted in. */
  catEnabled: boolean;
  /** "network" = connect to a running rigctld; "serial" = spawn our own. */
  catTransport: "network" | "serial";
  catHost: string;
  catPort: number;
  /** Hamlib rig model number (serial mode). */
  catModelId: number;
  /** Serial device path (serial mode). */
  catDevice: string;
  catBaud: number;
  /** Poll the VFO and show it in the top bar. */
  catPoll: boolean;
  /** "Follow radio": scroll/highlight the spot nearest the rig's frequency. */
  catFollow: boolean;
  /** Which mode a digital-mode spot switches the rig to: "none" = leave it. */
  catDigiMode: "none" | "usb" | "data";

  // --- logging-program push ("prepare a QSO") ---
  /** Push clicked spots to the local logger's entry window. Off unless opted in. */
  logPushEnabled: boolean;
  logHost: string;
  logPort: number;
  /** WSJT-X Status datagram, or a bare partial-ADIF record. */
  logFormat: LogFormat;
  /** After a push, bring the logger window forward (best-effort, per-OS). */
  raiseLoggerEnabled: boolean;
  /** The logger window's title (a substring is enough). */
  raiseLoggerTitle: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  homeLocator: "",
  spotHistoryLimit: 500,
  chatGroups: [],
  alertRules: [],
  alertsEnabled: true,
  alertsSound: true,
  alertSoundStyle: "chime",
  ctyAutoUpdate: true,
  presetsAutoUpdate: true,
  lang: "system",
  spotMaxAgeMin: 0,
  bandmapZoom: 1,
  mapProjection: "rect",
  mapGrayline: true,
  mapArcs: false,
  mapLabels: true,
  mapGreyline: false,
  mapAurora: false,
  mapCondHud: true,
  mapBandRose: false,
  mapMuf: false,
  mapOpenings: false,
  pskrEnabled: false,
  pskrCallsigns: "",
  wsjtxEnabled: false,
  wsjtxBind: "127.0.0.1:2237",
  spotShowWsjtx: true,
  mailWatchEnabled: true,
  catEnabled: false,
  catTransport: "network",
  catHost: "127.0.0.1",
  catPort: 4532,
  catModelId: 0,
  catDevice: "",
  catBaud: 38400,
  catPoll: true,
  catFollow: false,
  catDigiMode: "data",
  logPushEnabled: false,
  logHost: "127.0.0.1",
  logPort: 2237,
  logFormat: "wsjtx",
  raiseLoggerEnabled: false,
  raiseLoggerTitle: "",
};

export async function loadProfiles(): Promise<NodeProfile[]> {
  const s = await store();
  return (await s.get<NodeProfile[]>("profiles")) ?? [];
}

export async function saveProfiles(profiles: NodeProfile[]): Promise<void> {
  const s = await store();
  await s.set("profiles", profiles);
}

export async function loadSettings(): Promise<AppSettings> {
  const s = await store();
  return { ...DEFAULT_SETTINGS, ...((await s.get<Partial<AppSettings>>("settings")) ?? {}) };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const s = await store();
  await s.set("settings", settings);
}

export async function patchSettings(patch: Partial<AppSettings>): Promise<void> {
  await saveSettings({ ...(await loadSettings()), ...patch });
}

/** Alert hits are kept under their own key (not in `settings`) — they change
 *  often and we don't want a load+merge of the whole settings blob per hit. */
export async function loadAlertHits(): Promise<AlertHit[]> {
  const s = await store();
  return (await s.get<AlertHit[]>("alertHits")) ?? [];
}

export async function saveAlertHits(hits: AlertHit[]): Promise<void> {
  const s = await store();
  await s.set("alertHits", hits);
}

export async function loadFilters(): Promise<SpotFilter[]> {
  const s = await store();
  const raw = (await s.get<SpotFilter[]>("filters")) ?? [];
  // Backfill fields added after a filter was first saved.
  return raw.map((f) => ({
    ...f,
    id: f.id ?? crypto.randomUUID(),
    enabled: f.enabled ?? true,
  }));
}

export async function saveFilters(filters: SpotFilter[]): Promise<void> {
  const s = await store();
  await s.set("filters", filters);
}
