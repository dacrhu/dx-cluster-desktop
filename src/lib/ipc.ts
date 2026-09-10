import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  CallInfo,
  ConnState,
  EnrichedSpot,
  NodeProfile,
  NodeSoftware,
  CtyEntity,
  CtyStatus,
  MufSnapshot,
  UpdateInfo,
  ClusterPreset,
  PresetsStatus,
  HistRow,
  LogFormat,
  MailHeader,
  RigConfig,
  RigModel,
  RigVfo,
  SpotFilter,
  StationInfo,
  StoredAnnounce,
  StoredChat,
  StoredMail,
  StoredTalk,
  StoredWcy,
  StoredWwv,
} from "./types";

/**
 * Typed wrappers around the Rust `#[tauri::command]` surface in
 * `src-tauri/src/lib.rs`.
 */

export const ping = () => invoke<string>("ping");

export const systemLocale = () => invoke<string | null>("system_locale");

export const setHomeLocator = (locator: string | null) =>
  invoke<void>("set_home_locator", { locator });

export const lookupCall = (call: string) => invoke<CallInfo | null>("lookup_call", { call });

export const ctyStatus = () => invoke<CtyStatus>("cty_status");
export const ctyEntities = () => invoke<CtyEntity[]>("cty_entities");
export const maybeUpdateCty = () => invoke<CtyStatus>("maybe_update_cty");
export const updateCty = () => invoke<CtyStatus>("update_cty");

/** Measured ionosonde MUF data (kc2g) for the map's MUF layer. */
export const mufStations = (force = false) => invoke<MufSnapshot>("muf_stations", { force });

/** Check GitHub for a newer release than the running build (startup popup). */
export const checkUpdate = () => invoke<UpdateInfo>("check_update");

export const clusterPresets = () => invoke<ClusterPreset[]>("cluster_presets");
export const presetsStatus = () => invoke<PresetsStatus>("presets_status");
export const maybeUpdatePresets = () => invoke<PresetsStatus>("maybe_update_presets");
export const updatePresets = () => invoke<PresetsStatus>("update_presets");

export const recentSpots = (limit: number) => invoke<EnrichedSpot[]>("recent_spots", { limit });

export const spotsSince = (since: number) => invoke<EnrichedSpot[]>("spots_since", { since });

/** Open an http(s) URL in the user's default browser. */
export const openExternal = (url: string) => invoke<void>("open_external", { url });

export type DocPage = {
  markdown: string;
  source: "github" | "bundled";
  url: string;
  /** Language actually served — may fall back to `"en"` for an untranslated page. */
  lang: "en" | "hu" | "de";
};

/** Fetch one user-manual Markdown page in `lang` (GitHub `main`, bundled
 *  fallback; a page missing in `lang` falls back to English). */
export const getDoc = (slug: string, lang: string) => invoke<DocPage>("get_doc", { slug, lang });

export const connectNode = (profile: NodeProfile) => invoke<void>("connect_node", { profile });

export const disconnectNode = (id: string) => invoke<void>("disconnect_node", { id });

export const pskrStart = (callsigns: string[]) => invoke<void>("pskr_start", { callsigns });

export const pskrStop = () => invoke<void>("pskr_stop", {});

export const wsjtxStart = (bind: string) => invoke<void>("wsjtx_start", { bind });

export const wsjtxStop = () => invoke<void>("wsjtx_stop", {});

// --- CAT (rig control) + logging-program push ------------------------------

export const rigModels = () => invoke<RigModel[]>("rig_models");

export const rigTest = (cfg: RigConfig) => invoke<number>("rig_test", { cfg });

export const rigStart = (cfg: RigConfig) => invoke<void>("rig_start", { cfg });

export const rigStop = () => invoke<void>("rig_stop", {});

export const rigSet = (freqKhz: number, mode?: string) =>
  invoke<void>("rig_set", { freqKhz, mode: mode ?? null });

export const rigSetSplit = (rxKhz: number, txKhz: number, mode?: string) =>
  invoke<void>("rig_set_split", { rxKhz, txKhz, mode: mode ?? null });

export const rigClearSplit = () => invoke<void>("rig_clear_split", {});

export interface QsoHint {
  call: string;
  freqHz: number;
  mode?: string;
  band?: string | null;
  grid?: string | null;
  comment?: string | null;
  myCall?: string | null;
  myGrid?: string | null;
}

export const logPrepare = (host: string, port: number, format: LogFormat, hint: QsoHint) =>
  invoke<void>("log_prepare", { host, port, format, hint });

export const raiseWindow = (title: string) => invoke<void>("raise_window", { title });

export const sendRaw = (id: string, line: string) => invoke<void>("send_raw", { id, line });

export const postSpot = (id: string, freqKhz: number, dxCall: string, comment: string) =>
  invoke<string>("post_spot", { id, freqKhz, dxCall, comment });

export const applySpotFilter = (
  id: string,
  filter: SpotFilter,
  toNode: boolean,
  software: NodeSoftware = "dx_spider",
) => invoke<string | null>("apply_spot_filter", { id, filter, toNode, software });

export const recentAnnouncements = (limit: number) =>
  invoke<StoredAnnounce[]>("recent_announcements", { limit });

export const importAnnounceHistory = (nodeId: string, lines: string[], limit: number) =>
  invoke<{ imported: number; announcements: StoredAnnounce[] }>("import_announce_history", {
    nodeId,
    lines,
    limit,
  });

export const recentWwv = (limit: number) => invoke<StoredWwv[]>("recent_wwv", { limit });

export const recentWcy = (limit: number) => invoke<StoredWcy[]>("recent_wcy", { limit });

export const postAnnounce = (id: string, text: string, full: boolean) =>
  invoke<string>("post_announce", { id, text, full });

export const postWx = (id: string, text: string) => invoke<string>("post_wx", { id, text });

export const recentTalk = (limit: number) => invoke<StoredTalk[]>("recent_talk", { limit });

export const sendTalk = (id: string, to: string, text: string) =>
  invoke<string>("send_talk", { id, to, text });

export const recentChat = (limit: number) => invoke<StoredChat[]>("recent_chat", { limit });

export const sendChat = (id: string, group: string, text: string) =>
  invoke<string>("send_chat", { id, group, text });

export const chatMembership = (id: string, group: string, join: boolean) =>
  invoke<string>("chat_membership", { id, group, join });

export const importChatHistory = (nodeId: string, lines: string[], limit: number) =>
  invoke<StoredChat[]>("import_chat_history", { nodeId, lines, limit });

export const setBuddy = (id: string, call: string, add: boolean) =>
  invoke<string>("set_buddy", { id, call, add });

export const parseUsers = (lines: string[]) => invoke<string[]>("parse_users", { lines });

export const parseStation = (lines: string[]) =>
  invoke<StationInfo | null>("parse_station", { lines });

export const parseDirectory = (lines: string[]) =>
  invoke<MailHeader[]>("parse_directory", { lines });

export const parseHistSpots = (lines: string[]) => invoke<HistRow[]>("parse_hist_spots", { lines });

/** Options for a `SH/DX` historical query (mirrors Rust `commands::DxQuery`). */
export interface DxQuery {
  count?: number;
  band?: string;
  call?: string;
  by?: string;
  hours?: number;
}

/** Build the `SH/DX` query string in the target node's dialect. */
export const shDxCommand = (query: DxQuery, software: NodeSoftware = "dx_spider") =>
  invoke<string>("sh_dx_command", { query, software });

export const searchLocalSpots = (opts: {
  dxPrefix?: string;
  band?: string;
  spotterPrefix?: string;
  sinceHours?: number;
  limit: number;
}) =>
  invoke<EnrichedSpot[]>("search_local_spots", {
    dxPrefix: opts.dxPrefix || null,
    band: opts.band || null,
    spotterPrefix: opts.spotterPrefix || null,
    sinceHours: opts.sinceHours ?? null,
    limit: opts.limit,
  });

export const readMail = (nodeId: string, lines: string[]) =>
  invoke<StoredMail | null>("read_mail", { nodeId, lines });

export const cachedMail = (nodeId: string, msgno: number) =>
  invoke<StoredMail | null>("cached_mail", { nodeId, msgno });

/** Message numbers already read (cached) in the app, to keep "read" flags
 *  stable when the node re-reports a message as unread on refresh. */
export const cachedMailIds = (nodeId: string) => invoke<number[]>("cached_mail_ids", { nodeId });

// --- events -----------------------------------------------------------------

type Pair<T> = [string, T];

export const onSpot = (cb: (s: EnrichedSpot) => void): Promise<UnlistenFn> =>
  listen<EnrichedSpot>("cluster://spot", (e) => cb(e.payload));

export const onState = (cb: (nodeId: string, s: ConnState) => void): Promise<UnlistenFn> =>
  listen<Pair<ConnState>>("cluster://state", (e) => cb(e.payload[0], e.payload[1]));

export const onLine = (cb: (nodeId: string, line: string) => void): Promise<UnlistenFn> =>
  listen<Pair<string>>("cluster://line", (e) => cb(e.payload[0], e.payload[1]));

export const onSent = (cb: (nodeId: string, line: string) => void): Promise<UnlistenFn> =>
  listen<Pair<string>>("cluster://sent", (e) => cb(e.payload[0], e.payload[1]));

export const onError = (cb: (nodeId: string, message: string) => void): Promise<UnlistenFn> =>
  listen<Pair<string>>("cluster://error", (e) => cb(e.payload[0], e.payload[1]));

export const onClosed = (cb: (nodeId: string) => void): Promise<UnlistenFn> =>
  listen<string>("cluster://closed", (e) => cb(e.payload));

/** PSK Reporter feed lifecycle: "off" | "connecting" | "online" | "error: …". */
export const onPskrState = (cb: (state: string) => void): Promise<UnlistenFn> =>
  listen<string>("pskr://state", (e) => cb(e.payload));

/** WSJT-X feed lifecycle: "off" | "listening" | "receiving" | "error: …". */
export const onWsjtxState = (cb: (state: string) => void): Promise<UnlistenFn> =>
  listen<string>("wsjtx://state", (e) => cb(e.payload));

/** CAT session lifecycle: "off" | "connecting" | "connected" | "disconnected" | "error: …". */
export const onRigState = (cb: (state: string) => void): Promise<UnlistenFn> =>
  listen<string>("rig://state", (e) => cb(e.payload));

/** CAT VFO poll: current rig frequency + mode. */
export const onRigVfo = (cb: (v: RigVfo) => void): Promise<UnlistenFn> =>
  listen<RigVfo>("rig://vfo", (e) => cb(e.payload));

export const onAnnounce = (cb: (a: StoredAnnounce) => void): Promise<UnlistenFn> =>
  listen<StoredAnnounce>("cluster://announce", (e) => cb(e.payload));

export const onWwv = (cb: (w: StoredWwv) => void): Promise<UnlistenFn> =>
  listen<StoredWwv>("cluster://wwv", (e) => cb(e.payload));

export const onWcy = (cb: (w: StoredWcy) => void): Promise<UnlistenFn> =>
  listen<StoredWcy>("cluster://wcy", (e) => cb(e.payload));

export const onTalk = (cb: (t: StoredTalk) => void): Promise<UnlistenFn> =>
  listen<StoredTalk>("cluster://talk", (e) => cb(e.payload));

export const onChat = (cb: (c: StoredChat) => void): Promise<UnlistenFn> =>
  listen<StoredChat>("cluster://chat", (e) => cb(e.payload));

const NODE_PROMPT_RE = /(^|\s)[\w-]+ de [\w-]+.*>\s*$|>\s?>?\s*$/i;

/**
 * Send a command and collect the response lines until the node's prompt
 * reappears (or a timeout). Used for `SHOW` queries — a full request/response
 * Query panel arrives in a later phase.
 */
export async function runQuery(id: string, command: string, timeoutMs = 4000): Promise<string[]> {
  const lines: string[] = [];
  const un = await listen<Pair<string>>("cluster://line", (e) => {
    if (e.payload[0] !== id) return;
    const line = e.payload[1];
    if (NODE_PROMPT_RE.test(line)) {
      finish();
      return;
    }
    lines.push(line);
  });
  let done = false;
  let resolveFn: (v: string[]) => void;
  const p = new Promise<string[]>((r) => (resolveFn = r));
  const timer = setTimeout(finish, timeoutMs);
  function finish() {
    if (done) return;
    done = true;
    clearTimeout(timer);
    un();
    resolveFn(lines);
  }
  await sendRaw(id, command);
  return p;
}

export interface MailDraft {
  to: string;
  subject: string;
  body: string;
  isPrivate: boolean;
  /** Set for a reply instead of `to` — sends `REPLY <msgno>`. */
  replyTo?: number;
}

/**
 * Orchestrate the interactive DXSpider compose sequence: open command, then
 * subject on the "Subject" prompt, then the body ending with `/EX`. Uses
 * generous fallback timers so it completes even if the prompt wording differs.
 * Returns the node's response lines.
 *
 * Documented DXSpider prompts (v1.5x): `Enter Subject (30 characters):` then
 * `Enter Message /EX to send or /ABORT to exit`. The regexes below match those
 * plus common variants; the blind fallback timer is long (8s) so a node still
 * flushing its login banner can't trip it into dumping the subject as a raw
 * command. Unverified: posting on a live net wasn't done.
 */
export async function sendMail(id: string, draft: MailDraft): Promise<string[]> {
  const open = draft.replyTo
    ? `reply ${draft.replyTo}`
    : draft.isPrivate
      ? `sp ${draft.to.trim().toUpperCase()}`
      : `sb ${draft.to.trim().toUpperCase()}`;

  const collected: string[] = [];
  let stage: "subject" | "body" | "done" = "subject";
  let done = false;
  let resolveFn: (v: string[]) => void;
  const p = new Promise<string[]>((r) => (resolveFn = r));

  let un: UnlistenFn | null = null;
  // Long blind fallback: the node may still be flushing its login banner when
  // `open` goes out, and firing `sendSubject()` early would push the subject
  // line as a raw cluster command. The regex path handles the normal case in
  // well under a second.
  let stageTimer = setTimeout(() => void sendSubject(), 8000);
  const overall = setTimeout(() => finish(), 30000);

  function finish() {
    if (done) return;
    done = true;
    clearTimeout(stageTimer);
    clearTimeout(overall);
    un?.();
    resolveFn(collected);
  }

  async function sendSubject() {
    if (stage !== "subject") return;
    stage = "body";
    clearTimeout(stageTimer);
    await sendRaw(id, draft.subject.trim() || "(no subject)");
    stageTimer = setTimeout(() => void sendBody(), 2500);
  }

  async function sendBody() {
    if (stage !== "body") return;
    stage = "done";
    clearTimeout(stageTimer);
    for (const line of draft.body.split("\n")) {
      // A body line that is itself an editor command (`/EX`, `/ABORT`, …) would
      // end or discard the message early — send it as literal text by padding.
      const safe = /^\s*\/(ex|abort)\b/i.test(line) ? ` ${line}` : line;
      await sendRaw(id, safe.length ? safe : " ");
    }
    await sendRaw(id, "/EX");
    stageTimer = setTimeout(() => finish(), 2500);
  }

  un = await listen<Pair<string>>("cluster://line", (e) => {
    if (e.payload[0] !== id) return;
    const l = e.payload[1];
    collected.push(l);
    if (stage === "subject" && /subject/i.test(l)) void sendSubject();
    else if (
      stage === "body" &&
      /(enter (your )?message|enter text|\/ex to send|\/abort to exit)/i.test(l)
    )
      void sendBody();
    else if (stage === "done" && /(queued|msg.*sent|not sent|aborted|no such)/i.test(l)) finish();
  });

  await sendRaw(id, open);
  return p;
}
