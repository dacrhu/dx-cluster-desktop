import { useEffect, useRef, useState } from "react";
import * as ipc from "@/lib/ipc";
import { useCluster } from "@/store/useCluster";
import { loadProfiles, loadSettings, loadFilters } from "@/lib/persist";
import { ConnectionPanel } from "@/panels/ConnectionPanel";
import { SpotsPanel } from "@/panels/SpotsPanel";
import { FiltersPanel } from "@/panels/FiltersPanel";
import { RawConsolePanel } from "@/panels/RawConsolePanel";

type TabId = "connection" | "spots" | "filters" | "raw";

const TABS: { id: TabId; label: string }[] = [
  { id: "connection", label: "Kapcsolat" },
  { id: "spots", label: "Spotok" },
  { id: "filters", label: "Szűrők" },
  { id: "raw", label: "Nyers terminál" },
];

export function App() {
  const [tab, setTab] = useState<TabId>("connection");
  const store = useCluster();
  const bootstrapped = useRef(false);

  useEffect(() => {
    // Root component: listeners live for the app's lifetime. The ref guard keeps
    // React 18 StrictMode's double-invoke from registering them twice.
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    void ipc.onSpot((s) => useCluster.getState().addSpot(s));
    void ipc.onState((id, s) => useCluster.getState().setConnState(id, s));
    void ipc.onLine((id, line) =>
      useCluster.getState().addRaw(id, { dir: "in", text: line, t: Date.now() }),
    );
    void ipc.onSent((id, line) =>
      useCluster.getState().addRaw(id, { dir: "out", text: line, t: Date.now() }),
    );
    void ipc.onError((id, message) => {
      useCluster.getState().setConnError(id, message);
      useCluster.getState().addRaw(id, { dir: "in", text: `! ${message}`, t: Date.now() });
    });
    void ipc.onClosed((id) => useCluster.getState().setConnState(id, "disconnected"));

    (async () => {
      const [profiles, settings, filters] = await Promise.all([
        loadProfiles(),
        loadSettings(),
        loadFilters(),
      ]);
      profiles.forEach((p) => useCluster.getState().upsertProfile(p));
      useCluster.getState().setFilters(filters);
      useCluster.getState().setHomeLocator(settings.homeLocator);
      await ipc.setHomeLocator(settings.homeLocator || null);
      try {
        const recent = await ipc.recentSpots(settings.spotHistoryLimit);
        useCluster.getState().loadSpots(recent);
      } catch {
        /* history db may be empty on first run */
      }
    })();
  }, []);

  const onlineCount = Object.values(store.connections).filter((c) => c.state === "online").length;

  return (
    <div className="app">
      <header className="topbar">
        <strong>DX Cluster Desktop</strong>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={t.id === tab ? "tab active" : "tab"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === "spots" && store.spots.length > 0 ? ` (${store.spots.length})` : ""}
            </button>
          ))}
        </nav>
        <span className="status">
          {onlineCount > 0 ? `${onlineCount} kapcsolat él` : "nincs élő kapcsolat"}
        </span>
      </header>

      <main className="content">
        {tab === "connection" && <ConnectionPanel />}
        {tab === "spots" && <SpotsPanel onGoToFilters={() => setTab("filters")} />}
        {tab === "filters" && <FiltersPanel />}
        {tab === "raw" && <RawConsolePanel />}
      </main>
    </div>
  );
}
