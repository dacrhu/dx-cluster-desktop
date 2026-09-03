import { useMemo } from "react";
import { useCluster } from "@/store/useCluster";
import { baseCall, spotterLonLat, type LonLat } from "./grid";
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
}

/**
 * Reception reports of *my* callsign — every spot whose DX call is one of mine
 * (any spotter; skimmers included), positioned at the spotter. Derived live
 * from `store.spots`, so it honours the global age cap.
 */
export function useMyReports(): MyReport[] {
  const spots = useCluster((s) => s.spots);
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
      });
    }
    return out;
  }, [spots, myCalls, maxAgeMin, ageTick]);
}
