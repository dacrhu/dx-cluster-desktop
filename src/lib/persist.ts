import { load, type Store } from "@tauri-apps/plugin-store";
import type { NodeProfile, SpotFilter } from "./types";

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
}

const DEFAULT_SETTINGS: AppSettings = {
  homeLocator: "",
  spotHistoryLimit: 500,
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

export async function loadFilters(): Promise<SpotFilter[]> {
  const s = await store();
  return (await s.get<SpotFilter[]>("filters")) ?? [];
}

export async function saveFilters(filters: SpotFilter[]): Promise<void> {
  const s = await store();
  await s.set("filters", filters);
}
