import { create } from "zustand";
import type { AlertHit, AlertRule } from "@/lib/alerts";
import type { AlertSound } from "@/lib/notify";
import type { LangPref } from "@/i18n";
import type { CtyStatus, LogFormat, PresetsStatus, RigVfo } from "@/lib/types";
import type {
  ConnState,
  EnrichedSpot,
  Mode,
  NodeProfile,
  SpotFilter,
  StoredAnnounce,
  StoredChat,
  StoredTalk,
  StoredWcy,
  StoredWwv,
} from "@/lib/types";

const MAX_SPOTS = 5000;
const MAX_RAW_LINES = 2000;
const MAX_ANN = 500;
const MAX_GEOMAG = 200;
const MAX_TALK = 1000;
const MAX_CHAT = 2000;
const MAX_ALERT_HITS = 100;

export interface Connection {
  profile: NodeProfile;
  state: ConnState;
  lastError?: string;
}

interface RawEntry {
  dir: "in" | "out";
  text: string;
  t: number;
}

interface ClusterStore {
  connections: Record<string, Connection>;
  spots: EnrichedSpot[]; // newest first
  raw: Record<string, RawEntry[]>;
  announcements: StoredAnnounce[]; // newest first
  wwv: StoredWwv[]; // newest first
  wcy: StoredWcy[]; // newest first
  talk: StoredTalk[]; // newest first
  chat: StoredChat[]; // newest first
  chatGroups: string[]; // groups the user wants joined
  alerts: AlertRule[];
  alertsEnabled: boolean;
  alertsSound: boolean;
  alertSoundStyle: AlertSound;
  /** Log of spots that fired an alert (newest first), survives table scroll. */
  alertHits: AlertHit[];
  /** Global age cap in minutes for spot lists (Spots, Bandmap, alert hits);
   *  0 = show everything. Lives in the top bar. */
  spotMaxAgeMin: number;
  /** Bumped on a timer so age-based views refresh while the feed is quiet. */
  ageTick: number;
  /** A search string the Spots panel should adopt (e.g. from an alert-hit click). */
  pendingSpotSearch: string | null;
  /** A callsign the Talk panel should open (from a spot's context menu). */
  pendingTalk: string | null;
  ctyStatus: CtyStatus | null;
  ctyAutoUpdate: boolean;
  presetsStatus: PresetsStatus | null;
  presetsAutoUpdate: boolean;
  filters: SpotFilter[];
  filtersEnabled: boolean;
  /** Shared spot search query (Spots panel + Bandmap use the same one). */
  spotQuery: string;
  /** Shared quick-filter chips — band + mode inclusion, empty = all. Used by the
   *  Spots, Bandmap and Map panels alike (like `spotQuery`, session-only). */
  spotBands: string[];
  spotModes: Mode[];
  /** Show skimmer/RBN spots (shared by Spots panel + Bandmap). */
  spotShowSkimmer: boolean;
  /** Bandmap vertical zoom factor (1 = fit the viewport). */
  bandmapZoom: number;
  /** Map projection: azimuthal-equidistant from the QTH, or flat world. */
  mapProjection: "azimuthal" | "rect";
  /** Map: draw the day/night grayline overlay. */
  mapGrayline: boolean;
  /** Map: draw great-circle arcs from the QTH to each spot. */
  mapArcs: boolean;
  /** Map: faint DXCC prefix labels on the countries. */
  mapLabels: boolean;
  /** Map: highlight spots/paths sitting in the sunrise/sunset grey-line band. */
  mapGreyline: boolean;
  /** Map: draw the K-index auroral-oval caps around the geomagnetic poles. */
  mapAurora: boolean;
  /** Map: solar / geomagnetic HUD card (SFI / A / K / SSN from WWV/WCY). */
  mapCondHud: boolean;
  /** Map: QTH-centred "where is the activity" band rose. */
  mapBandRose: boolean;
  /** Map: model MUF dot-field from the cluster's sunspot number. */
  mapMuf: boolean;
  /** Map: empirical band-openings heat map from the whole spot stream. */
  mapOpenings: boolean;
  /** PSK Reporter "who hears me" feed: opted in? */
  pskrEnabled: boolean;
  /** Callsign(s) to watch on PSK Reporter (comma/space separated); "" = derive
   *  from the connection profiles. */
  pskrCallsigns: string;
  /** PSK Reporter feed lifecycle: "off" | "connecting" | "online" | "error: …". */
  pskrStatus: string;
  /** WSJT-X local UDP feed: opted in? */
  wsjtxEnabled: boolean;
  /** WSJT-X UDP listen address (`host:port`). */
  wsjtxBind: string;
  /** WSJT-X feed lifecycle: "off" | "listening" | "receiving" | "error: …". */
  wsjtxStatus: string;
  /** Show WSJT-X-sourced spots (`node_id === "wsjtx"`) in the spot views. */
  spotShowWsjtx: boolean;

  // --- CAT (rig control) ---
  catEnabled: boolean;
  catTransport: "network" | "serial";
  catHost: string;
  catPort: number;
  catModelId: number;
  catDevice: string;
  catBaud: number;
  catPoll: boolean;
  catFollow: boolean;
  /** CAT session lifecycle: "off" | "connecting" | "connected" | "disconnected" | "error: …". */
  rigStatus: string;
  /** Latest VFO poll from the rig, or null. */
  rigVfo: RigVfo | null;
  /** Frequency (kHz) the spot views should follow, from `rigVfo` when `catFollow`. */
  followFreqKhz: number | null;

  // --- logging-program push ---
  logPushEnabled: boolean;
  logHost: string;
  logPort: number;
  logFormat: LogFormat;
  raiseLoggerEnabled: boolean;
  raiseLoggerTitle: string;

  homeLocator: string;
  lang: LangPref;
  /** OS UI locale (e.g. "hu-HU"), resolved once at startup for `lang = system`. */
  sysLocale: string | null;
  /** Wall-clock ms each tab was last viewed, for the "new activity" dot. */
  seen: Record<string, number>;
  /** ms timestamp of the newest spot passing the Spots panel's current filter. */
  spotsMatchTs: number;

  upsertProfile: (p: NodeProfile) => void;
  removeProfile: (id: string) => void;
  setConnState: (id: string, state: ConnState) => void;
  setConnError: (id: string, message: string) => void;

  addSpot: (s: EnrichedSpot) => void;
  /** Insert a batch in one `set()` — used to coalesce a burst of spot events
   *  (e.g. a busy RBN feed) into a single re-render instead of one per spot.
   *  `list` is oldest-first, matching arrival order. */
  addSpots: (list: EnrichedSpot[]) => void;
  loadSpots: (s: EnrichedSpot[]) => void;
  clearSpots: () => void;

  addRaw: (id: string, entry: RawEntry) => void;

  addAnnounce: (a: StoredAnnounce) => void;
  loadAnnouncements: (a: StoredAnnounce[]) => void;
  addWwv: (w: StoredWwv) => void;
  loadWwv: (w: StoredWwv[]) => void;
  addWcy: (w: StoredWcy) => void;
  loadWcy: (w: StoredWcy[]) => void;
  addTalk: (t: StoredTalk) => void;
  loadTalk: (t: StoredTalk[]) => void;
  addChat: (c: StoredChat) => void;
  loadChat: (c: StoredChat[]) => void;
  setChatGroups: (g: string[]) => void;
  setAlerts: (a: AlertRule[]) => void;
  setAlertsEnabled: (on: boolean) => void;
  setAlertsSound: (on: boolean) => void;
  setAlertSoundStyle: (s: AlertSound) => void;
  addAlertHit: (h: AlertHit) => void;
  loadAlertHits: (h: AlertHit[]) => void;
  clearAlertHits: () => void;
  setSpotMaxAgeMin: (n: number) => void;
  bumpAgeTick: () => void;
  /** Drop alert hits older than `spotMaxAgeMin`; returns true if anything changed. */
  pruneAlertHits: () => boolean;
  setPendingSpotSearch: (q: string | null) => void;
  setPendingTalk: (call: string | null) => void;
  setCtyStatus: (s: CtyStatus | null) => void;
  setCtyAutoUpdate: (on: boolean) => void;
  setPresetsStatus: (s: PresetsStatus | null) => void;
  setPresetsAutoUpdate: (on: boolean) => void;

  setFilters: (f: SpotFilter[]) => void;
  setFiltersEnabled: (on: boolean) => void;
  setSpotQuery: (q: string) => void;
  setSpotBands: (b: string[]) => void;
  setSpotModes: (m: Mode[]) => void;
  setSpotShowSkimmer: (on: boolean) => void;
  setBandmapZoom: (z: number) => void;
  setMapProjection: (p: "azimuthal" | "rect") => void;
  setMapGrayline: (on: boolean) => void;
  setMapArcs: (on: boolean) => void;
  setMapLabels: (on: boolean) => void;
  setMapGreyline: (on: boolean) => void;
  setMapAurora: (on: boolean) => void;
  setMapCondHud: (on: boolean) => void;
  setMapBandRose: (on: boolean) => void;
  setMapMuf: (on: boolean) => void;
  setMapOpenings: (on: boolean) => void;
  setPskrEnabled: (on: boolean) => void;
  setPskrCallsigns: (calls: string) => void;
  setPskrStatus: (status: string) => void;
  setWsjtxEnabled: (on: boolean) => void;
  setWsjtxBind: (bind: string) => void;
  setWsjtxStatus: (status: string) => void;
  setSpotShowWsjtx: (on: boolean) => void;
  setCatEnabled: (on: boolean) => void;
  setCatTransport: (t: "network" | "serial") => void;
  setCatHost: (h: string) => void;
  setCatPort: (p: number) => void;
  setCatModelId: (id: number) => void;
  setCatDevice: (d: string) => void;
  setCatBaud: (b: number) => void;
  setCatPoll: (on: boolean) => void;
  setCatFollow: (on: boolean) => void;
  setRigStatus: (status: string) => void;
  setRigVfo: (v: RigVfo | null) => void;
  setFollowFreqKhz: (khz: number | null) => void;
  setLogPushEnabled: (on: boolean) => void;
  setLogHost: (h: string) => void;
  setLogPort: (p: number) => void;
  setLogFormat: (f: LogFormat) => void;
  setRaiseLoggerEnabled: (on: boolean) => void;
  setRaiseLoggerTitle: (title: string) => void;
  setHomeLocator: (loc: string) => void;
  setLang: (l: LangPref) => void;
  setSysLocale: (l: string | null) => void;
  markSeen: (tab: string) => void;
  markAllSeen: (tabs: string[]) => void;
  setSpotsMatchTs: (ts: number) => void;
}

export const useCluster = create<ClusterStore>((set) => ({
  connections: {},
  spots: [],
  raw: {},
  announcements: [],
  wwv: [],
  wcy: [],
  talk: [],
  chat: [],
  chatGroups: [],
  alerts: [],
  alertsEnabled: true,
  alertsSound: true,
  alertSoundStyle: "chime",
  alertHits: [],
  spotMaxAgeMin: 0,
  ageTick: 0,
  pendingSpotSearch: null,
  pendingTalk: null,
  ctyStatus: null,
  ctyAutoUpdate: true,
  presetsStatus: null,
  presetsAutoUpdate: true,
  filters: [],
  filtersEnabled: true,
  spotQuery: "",
  spotBands: [],
  spotModes: [],
  spotShowSkimmer: true,
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
  pskrStatus: "off",
  wsjtxEnabled: false,
  wsjtxBind: "127.0.0.1:2237",
  wsjtxStatus: "off",
  spotShowWsjtx: true,
  catEnabled: false,
  catTransport: "network",
  catHost: "127.0.0.1",
  catPort: 4532,
  catModelId: 0,
  catDevice: "",
  catBaud: 38400,
  catPoll: true,
  catFollow: false,
  rigStatus: "off",
  rigVfo: null,
  followFreqKhz: null,
  logPushEnabled: false,
  logHost: "127.0.0.1",
  logPort: 2237,
  logFormat: "wsjtx",
  raiseLoggerEnabled: false,
  raiseLoggerTitle: "",
  homeLocator: "",
  lang: "system",
  sysLocale: null,
  seen: {},
  spotsMatchTs: 0,

  upsertProfile: (p) =>
    set((st) => ({
      connections: {
        ...st.connections,
        [p.id]: { profile: p, state: st.connections[p.id]?.state ?? "disconnected" },
      },
    })),

  removeProfile: (id) =>
    set((st) => {
      const connections = { ...st.connections };
      delete connections[id];
      return { connections };
    }),

  setConnState: (id, state) =>
    set((st) => {
      const existing = st.connections[id];
      if (!existing) return {};
      return { connections: { ...st.connections, [id]: { ...existing, state } } };
    }),

  setConnError: (id, message) =>
    set((st) => {
      const existing = st.connections[id];
      if (!existing) return {};
      return {
        connections: { ...st.connections, [id]: { ...existing, lastError: message } },
      };
    }),

  addSpot: (s) =>
    set((st) => ({
      spots: [s, ...st.spots].slice(0, MAX_SPOTS),
    })),

  addSpots: (list) =>
    set((st) => ({
      spots: [...list].reverse().concat(st.spots).slice(0, MAX_SPOTS),
    })),

  loadSpots: (list) =>
    set(() => ({
      // incoming is oldest-first from `spots_since`; store newest-first
      spots: [...list].reverse().slice(0, MAX_SPOTS),
    })),

  clearSpots: () => set({ spots: [] }),

  addRaw: (id, entry) =>
    set((st) => {
      const prev = st.raw[id] ?? [];
      return { raw: { ...st.raw, [id]: [...prev, entry].slice(-MAX_RAW_LINES) } };
    }),

  addAnnounce: (a) => set((st) => ({ announcements: [a, ...st.announcements].slice(0, MAX_ANN) })),
  loadAnnouncements: (announcements) => set({ announcements: announcements.slice(0, MAX_ANN) }),
  addWwv: (w) => set((st) => ({ wwv: [w, ...st.wwv].slice(0, MAX_GEOMAG) })),
  loadWwv: (wwv) => set({ wwv: wwv.slice(0, MAX_GEOMAG) }),
  addWcy: (w) => set((st) => ({ wcy: [w, ...st.wcy].slice(0, MAX_GEOMAG) })),
  loadWcy: (wcy) => set({ wcy: wcy.slice(0, MAX_GEOMAG) }),
  addTalk: (t) => set((st) => ({ talk: [t, ...st.talk].slice(0, MAX_TALK) })),
  loadTalk: (talk) => set({ talk: talk.slice(0, MAX_TALK) }),
  addChat: (c) => set((st) => ({ chat: [c, ...st.chat].slice(0, MAX_CHAT) })),
  loadChat: (chat) => set({ chat: chat.slice(0, MAX_CHAT) }),
  setChatGroups: (chatGroups) => set({ chatGroups }),
  setAlerts: (alerts) => set({ alerts }),
  setAlertsEnabled: (alertsEnabled) => set({ alertsEnabled }),
  setAlertsSound: (alertsSound) => set({ alertsSound }),
  setAlertSoundStyle: (alertSoundStyle) => set({ alertSoundStyle }),
  addAlertHit: (h) =>
    set((st) =>
      st.alertHits.some((x) => x.key === h.key)
        ? {}
        : { alertHits: [h, ...st.alertHits].slice(0, MAX_ALERT_HITS) },
    ),
  loadAlertHits: (alertHits) => set({ alertHits: alertHits.slice(0, MAX_ALERT_HITS) }),
  clearAlertHits: () => set({ alertHits: [] }),
  setSpotMaxAgeMin: (spotMaxAgeMin) =>
    set({ spotMaxAgeMin: Math.max(0, Math.floor(spotMaxAgeMin || 0)) }),
  bumpAgeTick: () => set((st) => ({ ageTick: st.ageTick + 1 })),
  pruneAlertHits: () => {
    const { spotMaxAgeMin, alertHits } = useCluster.getState();
    if (spotMaxAgeMin <= 0) return false;
    const cutoff = Date.now() / 1000 - spotMaxAgeMin * 60;
    const kept = alertHits.filter((h) => h.spot.received_at >= cutoff);
    if (kept.length === alertHits.length) return false;
    set({ alertHits: kept });
    return true;
  },
  setPendingSpotSearch: (pendingSpotSearch) => set({ pendingSpotSearch }),
  setPendingTalk: (pendingTalk) => set({ pendingTalk }),
  setCtyStatus: (ctyStatus) => set({ ctyStatus }),
  setCtyAutoUpdate: (ctyAutoUpdate) => set({ ctyAutoUpdate }),
  setPresetsStatus: (presetsStatus) => set({ presetsStatus }),
  setPresetsAutoUpdate: (presetsAutoUpdate) => set({ presetsAutoUpdate }),

  setFilters: (filters) => set({ filters }),
  setFiltersEnabled: (filtersEnabled) => set({ filtersEnabled }),
  setSpotQuery: (spotQuery) => set({ spotQuery }),
  setSpotBands: (spotBands) => set({ spotBands }),
  setSpotModes: (spotModes) => set({ spotModes }),
  setSpotShowSkimmer: (spotShowSkimmer) => set({ spotShowSkimmer }),
  setBandmapZoom: (bandmapZoom) => set({ bandmapZoom: Math.min(5, Math.max(1, bandmapZoom)) }),
  setMapProjection: (mapProjection) => set({ mapProjection }),
  setMapGrayline: (mapGrayline) => set({ mapGrayline }),
  setMapArcs: (mapArcs) => set({ mapArcs }),
  setMapLabels: (mapLabels) => set({ mapLabels }),
  setMapGreyline: (mapGreyline) => set({ mapGreyline }),
  setMapAurora: (mapAurora) => set({ mapAurora }),
  setMapCondHud: (mapCondHud) => set({ mapCondHud }),
  setMapBandRose: (mapBandRose) => set({ mapBandRose }),
  setMapMuf: (mapMuf) => set({ mapMuf }),
  setMapOpenings: (mapOpenings) => set({ mapOpenings }),
  setPskrEnabled: (pskrEnabled) => set({ pskrEnabled }),
  setPskrCallsigns: (pskrCallsigns) => set({ pskrCallsigns }),
  setPskrStatus: (pskrStatus) => set({ pskrStatus }),
  setWsjtxEnabled: (wsjtxEnabled) => set({ wsjtxEnabled }),
  setWsjtxBind: (wsjtxBind) => set({ wsjtxBind }),
  setWsjtxStatus: (wsjtxStatus) => set({ wsjtxStatus }),
  setSpotShowWsjtx: (spotShowWsjtx) => set({ spotShowWsjtx }),
  setCatEnabled: (catEnabled) => set({ catEnabled }),
  setCatTransport: (catTransport) => set({ catTransport }),
  setCatHost: (catHost) => set({ catHost }),
  setCatPort: (catPort) => set({ catPort }),
  setCatModelId: (catModelId) => set({ catModelId }),
  setCatDevice: (catDevice) => set({ catDevice }),
  setCatBaud: (catBaud) => set({ catBaud }),
  setCatPoll: (catPoll) => set({ catPoll }),
  setCatFollow: (catFollow) => set({ catFollow, followFreqKhz: null }),
  setRigStatus: (rigStatus) => set({ rigStatus }),
  setRigVfo: (rigVfo) => set({ rigVfo }),
  setFollowFreqKhz: (followFreqKhz) => set({ followFreqKhz }),
  setLogPushEnabled: (logPushEnabled) => set({ logPushEnabled }),
  setLogHost: (logHost) => set({ logHost }),
  setLogPort: (logPort) => set({ logPort }),
  setLogFormat: (logFormat) => set({ logFormat }),
  setRaiseLoggerEnabled: (raiseLoggerEnabled) => set({ raiseLoggerEnabled }),
  setRaiseLoggerTitle: (raiseLoggerTitle) => set({ raiseLoggerTitle }),
  setHomeLocator: (homeLocator) => set({ homeLocator }),
  setLang: (lang) => set({ lang }),
  setSysLocale: (sysLocale) => set({ sysLocale }),
  markSeen: (tab) => set((st) => ({ seen: { ...st.seen, [tab]: Date.now() } })),
  markAllSeen: (tabs) =>
    set((st) => {
      const now = Date.now();
      const seen = { ...st.seen };
      for (const t of tabs) seen[t] = now;
      return { seen };
    }),
  setSpotsMatchTs: (spotsMatchTs) =>
    set((st) => (spotsMatchTs !== st.spotsMatchTs ? { spotsMatchTs } : {})),
}));

/**
 * The id of an online connection to send commands to — a real cluster node in
 * preference to the command-less RBN feed. Falls back to any online connection.
 */
export const useOnlineId = (): string | undefined =>
  useCluster((s) => {
    const online = Object.values(s.connections).filter((c) => c.state === "online");
    return (
      online.find((c) => (c.profile.kind ?? "cluster") === "cluster")?.profile.id ??
      online[0]?.profile.id
    );
  });
