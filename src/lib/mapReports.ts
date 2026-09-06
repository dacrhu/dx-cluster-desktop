import { useMemo } from "react";
import { useCluster } from "@/store/useCluster";
import { baseCall, spotterLonLat, type LonLat } from "./grid";
import { useFrozenWhenInactive } from "./util";
import type { EnrichedSpot } from "./types";

/** Base callsigns of every configured connection profile ("who am I"). */
export function useMyCalls(): string[] {
  const connections = useCluster((s) => s.connections);
  return useMemo(() => {
    const set = new Set<string>();
    for (const c of Object.values(connections)) {
      if (c.profile.callsign) set.add(baseCall(c.profile.callsign));
    }
    return [...set];
  }, [connections]);
}

export interface MyReport {
  spot: EnrichedSpot;
  /** Signal report in dB from the comment (RBN style), if present. */
  snrDb: number | null;
  /** CW speed in WPM from the comment, if present. */
  wpm: number | null;
  /** Skimmer / spotter position, `[lon, lat]`. */
  lonLat: LonLat;
  /** How many raw reports collapsed into this one (same skimmer, same freq). */
  count: number;
  /** Number of distinct feeds that carried it (RBN feed / PSK Reporter / cluster). */
  feeds: number;
  /** Every raw report that collapsed here, newest first (incl. the representative). */
  members: EnrichedSpot[];
}

/**
 * Collapse reports of the same skimmer hearing me on the same frequency into a
 * single marker, regardless of which feed carried them — the RBN telnet feed,
 * the PSK Reporter feed and a cluster that also relays skimmer spots of us can
 * each produce their own copy, and each feed dedups only within itself. Keyed
 * like the backend's `synth_spot_key` (base DX call, base spotter, 0.1 kHz),
 * the freshest report wins (it drives the age fade); its SNR/WPM are kept, with
 * an older report's values filled in only where the freshest lacks them.
 */
export function collapseReports(raw: MyReport[]): MyReport[] {
  const groups = new Map<string, MyReport & { _feeds: Set<string> }>();
  for (const r of raw) {
    const key = `${baseCall(r.spot.dx_call).toUpperCase()}|${baseCall(
      r.spot.spotter_base,
    ).toUpperCase()}|${Math.round(r.spot.freq_khz * 10)}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { ...r, count: 1, _feeds: new Set([r.spot.node_id]), members: [r.spot] });
      continue;
    }
    g.count += 1;
    g._feeds.add(r.spot.node_id);
    g.members.push(r.spot);
    if (r.spot.received_at > g.spot.received_at) {
      g.spot = r.spot;
      g.lonLat = r.lonLat;
      g.snrDb = r.snrDb ?? g.snrDb;
      g.wpm = r.wpm ?? g.wpm;
    } else {
      g.snrDb = g.snrDb ?? r.snrDb;
      g.wpm = g.wpm ?? r.wpm;
    }
  }
  return [...groups.values()].map(({ _feeds, ...rest }) => ({
    ...rest,
    feeds: _feeds.size,
    members: [...rest.members].sort((a, b) => b.received_at - a.received_at),
  }));
}

/**
 * Reception reports of *my* callsign — every spot whose DX call is one of mine
 * (any spotter; skimmers included), positioned at the spotter. Derived live
 * from `store.spots`, so it honours the global age cap.
 *
 * `active` (default true) — while false the `spots` input is frozen, so this
 * scan (up to `MAX_SPOTS` rows, two regexes per match) isn't repeated on every
 * spot flush while the Map tab is hidden.
 */
export function useMyReports(active = true): MyReport[] {
  const liveSpots = useCluster((s) => s.spots);
  const spots = useFrozenWhenInactive(liveSpots, active);
  const maxAgeMin = useCluster((s) => s.spotMaxAgeMin);
  const ageTick = useCluster((s) => s.ageTick);
  const myCalls = useMyCalls();

  return useMemo(() => {
    void ageTick;
    if (!myCalls.length) return [];
    const cutoff = maxAgeMin > 0 ? Date.now() / 1000 - maxAgeMin * 60 : 0;
    const out: MyReport[] = [];
    for (const s of spots) {
      if (cutoff && s.received_at < cutoff) continue;
      if (!myCalls.includes(baseCall(s.dx_call))) continue;
      const pos = spotterLonLat(s);
      if (!pos) continue;
      const snr = /(-?\d+)\s*db/i.exec(s.comment);
      const wpm = /(\d+)\s*wpm/i.exec(s.comment);
      out.push({
        spot: s,
        snrDb: snr ? Number(snr[1]) : null,
        wpm: wpm ? Number(wpm[1]) : null,
        lonLat: pos,
        count: 1,
        feeds: 1,
        members: [s],
      });
    }
    return collapseReports(out);
  }, [spots, myCalls, maxAgeMin, ageTick]);
}
