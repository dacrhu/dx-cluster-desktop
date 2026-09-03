import { create } from "zustand";
import type { ConnState, EnrichedSpot, NodeProfile, SpotFilter } from "@/lib/types";

const MAX_SPOTS = 5000;
const MAX_RAW_LINES = 2000;

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
  filters: SpotFilter[];
  filtersEnabled: boolean;
  homeLocator: string;

  upsertProfile: (p: NodeProfile) => void;
  removeProfile: (id: string) => void;
  setConnState: (id: string, state: ConnState) => void;
  setConnError: (id: string, message: string) => void;

  addSpot: (s: EnrichedSpot) => void;
  loadSpots: (s: EnrichedSpot[]) => void;
  clearSpots: () => void;

  addRaw: (id: string, entry: RawEntry) => void;

  setFilters: (f: SpotFilter[]) => void;
  setFiltersEnabled: (on: boolean) => void;
  setHomeLocator: (loc: string) => void;
}

export const useCluster = create<ClusterStore>((set) => ({
  connections: {},
  spots: [],
  raw: {},
  filters: [],
  filtersEnabled: true,
  homeLocator: "",

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

  setFilters: (filters) => set({ filters }),
  setFiltersEnabled: (filtersEnabled) => set({ filtersEnabled }),
  setHomeLocator: (homeLocator) => set({ homeLocator }),
}));
