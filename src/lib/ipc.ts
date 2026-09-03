import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ConnState, EnrichedSpot, NodeProfile, SpotFilter, CallInfo } from "./types";

/**
 * Typed wrappers around the Rust `#[tauri::command]` surface in
 * `src-tauri/src/lib.rs`.
 */

export const ping = () => invoke<string>("ping");

export const setHomeLocator = (locator: string | null) =>
  invoke<void>("set_home_locator", { locator });

export const lookupCall = (call: string) => invoke<CallInfo | null>("lookup_call", { call });

export const recentSpots = (limit: number) => invoke<EnrichedSpot[]>("recent_spots", { limit });

export const spotsSince = (since: number) => invoke<EnrichedSpot[]>("spots_since", { since });

export const connectNode = (profile: NodeProfile) => invoke<void>("connect_node", { profile });

export const disconnectNode = (id: string) => invoke<void>("disconnect_node", { id });

export const sendRaw = (id: string, line: string) => invoke<void>("send_raw", { id, line });

export const postSpot = (id: string, freqKhz: number, dxCall: string, comment: string) =>
  invoke<string>("post_spot", { id, freqKhz, dxCall, comment });

export const applySpotFilter = (id: string, filter: SpotFilter, toNode: boolean) =>
  invoke<string | null>("apply_spot_filter", { id, filter, toNode });

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
