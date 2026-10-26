import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useCluster } from "@/store/useCluster";
import { baseCall } from "./grid";
import type { StoredAnnounce } from "./types";

/** A persisted mute rule. `text` = a normalised-text fingerprint (any sender),
 *  `sender` = a base callsign (all SSIDs). */
export interface AnnMute {
  kind: "text" | "sender";
  key: string;
}

export interface AnnFilterCfg {
  hideNodeAds: boolean;
  collapseRepeats: boolean;
  muted: AnnMute[];
}

export interface AnnRow {
  /** The freshest announcement of the group. */
  a: StoredAnnounce;
  /** How many announcements this row stands for (≥ 1). */
  count: number;
  /** `received_at` of every member, newest first. */
  times: number[];
  /** Matched a mute rule / the node-ad heuristic (only listed when showing hidden). */
  spam: boolean;
}

export interface AnnFilterResult {
  rows: AnnRow[];
  /** How many announcements were dropped as spam. */
  hidden: number;
  /** Newest time (s) of a visible, first-seen message — drives the tab's
   *  activity dot, so spam and repeats don't keep it lit. 0 if none. */
  activityTs: number;
}

/** Normalise a message so periodic re-posts compare equal: lower-case, with
 *  the varying stamp (`26-Oct-2026`, `2100Z`, `(1831Z)`) and punctuation noise
 *  removed. */
export function fingerprint(text: string): string {
  return text
    .toLowerCase()
    .replace(/\d{1,2}-[a-z]{3}-\d{4}/g, " ")
    .replace(/\b\d{4}z\b/g, " ")
    .replace(/[^a-z0-9.:/@_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CLUSTER_WORD = /dx\s?-?spider|ar-?cluster|cc[ -]?cluster|dx\s?-?cluster|\bcluster\b/i;
const HOST_PORT = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)+:\d{2,5}\b/i;
const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/;
const HOST_OR_URL = /https?:\/\/|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b/i;

/** Heuristic: is this a cluster node advertising itself? */
export function looksLikeNodeAd(text: string): boolean {
  if (/telnet/i.test(text)) return true;
  if (HOST_PORT.test(text) || IPV4.test(text)) return true;
  return CLUSTER_WORD.test(text) && HOST_OR_URL.test(text);
}

export function annMuteKey(a: StoredAnnounce, kind: AnnMute["kind"]): string {
  return kind === "sender" ? baseCall(a.sender) : fingerprint(a.text);
}

function isMuted(a: StoredAnnounce, muted: AnnMute[]): boolean {
  if (!muted.length) return false;
  const sender = baseCall(a.sender);
  const fp = fingerprint(a.text);
  return muted.some((m) => (m.kind === "sender" ? m.key === sender : m.key === fp));
}

/** `list` is newest first. WX bulletins always pass untouched. */
export function filterAnnouncements(
  list: StoredAnnounce[],
  cfg: AnnFilterCfg,
  showHidden = false,
): AnnFilterResult {
  const rows: AnnRow[] = [];
  const groups = new Map<string, AnnRow>();
  let hidden = 0;
  for (const a of list) {
    const spam =
      !a.is_wx && (isMuted(a, cfg.muted) || (cfg.hideNodeAds && looksLikeNodeAd(a.text)));
    if (spam) {
      hidden++;
      if (!showHidden) continue;
    }
    if (cfg.collapseRepeats && !a.is_wx) {
      const key = `${baseCall(a.sender)}|${fingerprint(a.text)}`;
      const g = groups.get(key);
      if (g) {
        g.count++;
        g.times.push(a.received_at);
        continue;
      }
      const row: AnnRow = { a, count: 1, times: [a.received_at], spam };
      groups.set(key, row);
      rows.push(row);
    } else {
      rows.push({ a, count: 1, times: [a.received_at], spam });
    }
  }
  let activityTs = 0;
  for (const r of rows) {
    if (r.spam) continue;
    // The group's oldest member is when this text first showed up.
    activityTs = Math.max(activityTs, r.times[r.times.length - 1]);
  }
  return { rows, hidden, activityTs };
}

/** Shared by the panel and `App.tsx` (the tab's activity dot) so both always
 *  apply the same filter. */
export function useVisibleAnnouncements(showHidden = false): AnnFilterResult {
  const { announcements, hideNodeAds, collapseRepeats, muted } = useCluster(
    useShallow((s) => ({
      announcements: s.announcements,
      hideNodeAds: s.annHideNodeAds,
      collapseRepeats: s.annCollapseRepeats,
      muted: s.annMuted,
    })),
  );
  return useMemo(
    () => filterAnnouncements(announcements, { hideNodeAds, collapseRepeats, muted }, showHidden),
    [announcements, hideNodeAds, collapseRepeats, muted, showHidden],
  );
}
