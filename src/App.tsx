import { useCallback, useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import * as ipc from "@/lib/ipc";
import { useCluster, useSendTargets } from "@/store/useCluster";
import {
  loadProfiles,
  loadSettings,
  loadFilters,
  loadAlertHits,
  saveAlertHits,
  patchSettings,
} from "@/lib/persist";
import { alertMatches } from "@/lib/alerts";
import { modeLabel } from "@/lib/mode";
import { beep, notify, primeAudio, primeNotifications } from "@/lib/notify";
import { resolvePskrCalls } from "@/lib/pskr";
import { rigConfigFromStore } from "@/lib/engage";
import { setActiveLang, setSystemLocale, useT } from "@/i18n";
import type { EnrichedSpot, UpdateInfo } from "@/lib/types";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { UpdateBanner } from "@/components/UpdateBanner";
import { ConnectionPanel } from "@/panels/ConnectionPanel";
import { SpotsPanel } from "@/panels/SpotsPanel";
import { BandmapPanel } from "@/panels/BandmapPanel";
import { MapPanel } from "@/panels/MapPanel";
import { BandActivityPanel } from "@/panels/BandActivityPanel";
import { FiltersPanel } from "@/panels/FiltersPanel";
import { AnnouncementsPanel } from "@/panels/AnnouncementsPanel";
import { PropagationPanel } from "@/panels/PropagationPanel";
import { TalkPanel } from "@/panels/TalkPanel";
import { ChatPanel } from "@/panels/ChatPanel";
import { MailPanel } from "@/panels/MailPanel";
import { ToolsPanel } from "@/panels/ToolsPanel";
import { AlertsPanel } from "@/panels/AlertsPanel";
import { UsersPanel } from "@/panels/UsersPanel";
import { RawConsolePanel } from "@/panels/RawConsolePanel";
import { AboutPanel } from "@/panels/AboutPanel";

type TabId =
  | "connection"
  | "spots"
  | "bandmap"
  | "map"
  | "activity"
  | "filters"
  | "announcements"
  | "propagation"
  | "talk"
  | "chat"
  | "mail"
  | "tools"
  | "alerts"
  | "users"
  | "raw"
  | "about";

const ALERT_COOLDOWN_MS = 5 * 60_000;
const lastAlert = new Map<string, number>();
const SPOT_FLUSH_MS = 200;

/** Refresh age-based views, drop over-age alert hits, persist if changed. */
function ageTickAndPrune() {
  useCluster.getState().bumpAgeTick();
  if (useCluster.getState().pruneAlertHits()) void saveAlertHits(useCluster.getState().alertHits);
}

function checkAlerts(spot: EnrichedSpot) {
  const st = useCluster.getState();
  if (!st.alertsEnabled) return;
  for (const rule of st.alerts) {
    if (!alertMatches(spot, rule)) continue;
    const key = `${rule.id}:${spot.dx_call}`;
    const now = Date.now();
    if ((lastAlert.get(key) ?? 0) + ALERT_COOLDOWN_MS > now) continue;
    lastAlert.set(key, now);

    // One row per station appearance: skip if the same call at ~this frequency
    // already fired recently (another spotter, or a second matching rule).
    const dup = st.alertHits.some(
      (h) =>
        h.spot.dx_call === spot.dx_call &&
        Math.abs(h.spot.freq_khz - spot.freq_khz) < 1.5 &&
        now - h.at < ALERT_COOLDOWN_MS,
    );
    if (dup) return;

    const band = spot.band ? `${spot.band} ` : "";
    const ml = modeLabel(spot.mode, spot.comment);
    const mode = ml ? `${ml} ` : "";
    void notify(
      `${spot.dx_call}${rule.label ? ` · ${rule.label}` : ""}`,
      `${spot.freq_khz.toFixed(1)} kHz ${band}${mode}· ${spot.dx?.dxcc_name ?? ""}${
        spot.comment ? ` · ${spot.comment}` : ""
      }`,
    );
    if (st.alertsSound) beep(st.alertSoundStyle);
    st.addAlertHit({
      key: `${rule.id}:${spot.id}`,
      at: now,
      ruleId: rule.id,
      ruleLabel: rule.label,
      spot,
    });
    st.pruneAlertHits();
    void saveAlertHits(useCluster.getState().alertHits);
    return; // one notification per spot
  }
}

// Tabs grouped by purpose; rendered as framed clusters in the top bar.
const TAB_GROUPS: { id: string; tabs: TabId[] }[] = [
  { id: "setup", tabs: ["connection"] },
  { id: "spotting", tabs: ["spots", "bandmap", "map", "activity", "alerts", "filters"] },
  { id: "info", tabs: ["announcements", "propagation"] },
  { id: "comms", tabs: ["talk", "chat", "mail", "users"] },
  { id: "advanced", tabs: ["tools", "raw"] },
  { id: "help", tabs: ["about"] },
];
const TAB_IDS: TabId[] = TAB_GROUPS.flatMap((g) => g.tabs);

export function App() {
  const [tab, setTab] = useState<TabId>("connection");
  const [version, setVersion] = useState("");
  // Set once at startup when a newer GitHub release is found; the popup clears it.
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const store = useCluster();
  const sendTargets = useSendTargets();
  const tr = useT();
  const bootstrapped = useRef(false);
  // Spot events are coalesced into one store update per SPOT_FLUSH_MS instead
  // of one `set()` per spot — a busy RBN/skimmer feed can fire many spots a
  // second, and each `set()` re-renders every mounted panel (see
  // `useCluster`'s per-panel bare-hook subscriptions).
  const pendingSpots = useRef<EnrichedSpot[]>([]);
  const spotFlushTimer = useRef<number | null>(null);
  // Stable callback identities so the `memo`-wrapped panels below don't see a
  // "changed" prop (and re-render) on every App render — a plain inline arrow
  // here would defeat the memo.
  const goToFilters = useCallback(() => setTab("filters"), []);
  const goToSpots = useCallback(() => setTab("spots"), []);
  const goToPropagation = useCallback(() => setTab("propagation"), []);

  useEffect(() => setActiveLang(store.lang), [store.lang, store.sysLocale]);

  useEffect(() => {
    void getVersion()
      .then(setVersion)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const c = () => useCluster.getState();

    // The OS UI locale — navigator.language is unreliable in WebKitGTK, so ask
    // the backend. Feeds `language = system`.
    ipc
      .systemLocale()
      .then((loc) => {
        setSystemLocale(loc);
        c().setSysLocale(loc);
      })
      .catch((e) => console.warn("system_locale failed", e));

    primeNotifications();

    // Unlock the audio context on the first interaction so alert chimes fired
    // from event handlers (not user gestures) can play.
    const unlock = () => primeAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    // Refresh age-based views + drop over-age alert hits on a timer.
    const hitTimer = window.setInterval(ageTickAndPrune, 30_000);
    window.addEventListener("beforeunload", () => window.clearInterval(hitTimer));

    void ipc.onSpot((s) => {
      // Alerts (notification + alertHits log) still react per spot — matches
      // are rare, so this doesn't cost extra renders — but the spot itself
      // only lands in the store on the next flush.
      checkAlerts(s);
      pendingSpots.current.push(s);
      if (spotFlushTimer.current == null) {
        spotFlushTimer.current = window.setTimeout(() => {
          spotFlushTimer.current = null;
          const batch = pendingSpots.current;
          pendingSpots.current = [];
          if (batch.length) c().addSpots(batch);
        }, SPOT_FLUSH_MS);
      }
    });
    void ipc.onState((id, s) => {
      const wasOnline = c().connections[id]?.state === "online";
      c().setConnState(id, s);
      // On (re)connect, re-join the chat groups the user wants.
      if (s === "online" && !wasOnline) {
        for (const g of c().chatGroups) void ipc.chatMembership(id, g, true).catch(() => {});
      }
    });
    void ipc.onPskrState((s) => c().setPskrStatus(s));
    void ipc.onWsjtxState((s) => c().setWsjtxStatus(s));
    void ipc.onRigState((s) => c().setRigStatus(s));
    void ipc.onRigVfo((v) => {
      c().setRigVfo(v);
      if (c().catFollow) c().setFollowFreqKhz(v.freqHz / 1000);
    });
    void ipc.onLine((id, line) => c().addRaw(id, { dir: "in", text: line, t: Date.now() }));
    void ipc.onSent((id, line) => c().addRaw(id, { dir: "out", text: line, t: Date.now() }));
    void ipc.onError((id, message) => {
      c().setConnError(id, message);
      c().addRaw(id, { dir: "in", text: `! ${message}`, t: Date.now() });
    });
    void ipc.onClosed((id) => c().setConnState(id, "disconnected"));
    void ipc.onAnnounce((a) => c().addAnnounce(a));
    void ipc.onWwv((w) => c().addWwv(w));
    void ipc.onWcy((w) => c().addWcy(w));
    void ipc.onTalk((t) => c().addTalk(t));
    void ipc.onChat((ch) => c().addChat(ch));

    (async () => {
      const [profiles, settings, filters, alertHits] = await Promise.all([
        loadProfiles(),
        loadSettings(),
        loadFilters(),
        loadAlertHits(),
      ]);
      c().setSpotMaxAgeMin(settings.spotMaxAgeMin ?? settings.alertHitTtlMin ?? 0);
      c().loadAlertHits(alertHits);
      ageTickAndPrune();
      profiles.forEach((p) => c().upsertProfile(p));
      for (const p of profiles) {
        if (p.auto_connect) {
          c().setConnState(p.id, "connecting");
          void ipc.connectNode(p).catch((e) => {
            c().setConnState(p.id, "disconnected");
            c().setConnError(p.id, String(e));
          });
        }
      }
      c().setFilters(filters);
      c().setHomeLocator(settings.homeLocator);
      c().setChatGroups(settings.chatGroups ?? []);
      c().setAlerts(settings.alertRules ?? []);
      c().setAlertsEnabled(settings.alertsEnabled ?? true);
      c().setAlertsSound(settings.alertsSound ?? true);
      c().setAlertSoundStyle(settings.alertSoundStyle ?? "chime");
      c().setCtyAutoUpdate(settings.ctyAutoUpdate ?? true);
      c().setLang(settings.lang ?? "system");
      c().setBandmapZoom(settings.bandmapZoom ?? 1);
      c().setBandActivityFrom(settings.bandActivityFrom ?? "");
      c().setMapProjection(settings.mapProjection ?? "rect");
      c().setMapGrayline(settings.mapGrayline ?? true);
      c().setMapArcs(settings.mapArcs ?? false);
      c().setMapLabels(settings.mapLabels ?? true);
      c().setMapGreyline(settings.mapGreyline ?? false);
      c().setMapGreylineWidth(settings.mapGreylineWidth ?? 9);
      c().setMapAurora(settings.mapAurora ?? false);
      c().setMapCondHud(settings.mapCondHud ?? true);
      c().setMapBandRose(settings.mapBandRose ?? false);
      c().setMapMuf(settings.mapMuf ?? false);
      c().setMapOpenings(settings.mapOpenings ?? false);
      c().setMapOpeningsNearMeKm(settings.mapOpeningsNearMeKm ?? 20000);
      c().setPskrEnabled(settings.pskrEnabled ?? false);
      c().setPskrCallsigns(settings.pskrCallsigns ?? "");
      if (settings.pskrEnabled) {
        const calls = resolvePskrCalls(
          settings.pskrCallsigns ?? "",
          profiles.map((p) => p.callsign).filter(Boolean),
        );
        if (calls.length) {
          c().setPskrStatus("connecting");
          void ipc.pskrStart(calls).catch((e) => c().setPskrStatus(`error: ${e}`));
        }
      }
      c().setWsjtxEnabled(settings.wsjtxEnabled ?? false);
      c().setWsjtxBind(settings.wsjtxBind ?? "127.0.0.1:2237");
      c().setSpotShowWsjtx(settings.spotShowWsjtx ?? true);
      c().setMailWatchEnabled(settings.mailWatchEnabled ?? true);
      if (settings.wsjtxEnabled) {
        c().setWsjtxStatus("listening");
        void ipc
          .wsjtxStart(settings.wsjtxBind ?? "127.0.0.1:2237")
          .catch((e) => c().setWsjtxStatus(`error: ${e}`));
      }

      c().setCatEnabled(settings.catEnabled ?? false);
      c().setCatTransport(settings.catTransport ?? "network");
      c().setCatHost(settings.catHost ?? "127.0.0.1");
      c().setCatPort(settings.catPort ?? 4532);
      c().setCatModelId(settings.catModelId ?? 0);
      c().setCatDevice(settings.catDevice ?? "");
      c().setCatBaud(settings.catBaud ?? 38400);
      c().setCatPoll(settings.catPoll ?? true);
      c().setCatFollow(settings.catFollow ?? false);
      c().setCatDigiMode(settings.catDigiMode ?? "data");
      c().setLogPushEnabled(settings.logPushEnabled ?? false);
      c().setLogHost(settings.logHost ?? "127.0.0.1");
      c().setLogPort(settings.logPort ?? 2237);
      c().setLogFormat(settings.logFormat ?? "wsjtx");
      c().setRaiseLoggerEnabled(settings.raiseLoggerEnabled ?? false);
      c().setRaiseLoggerTitle(settings.raiseLoggerTitle ?? "");
      if (settings.catEnabled) {
        c().setRigStatus("connecting");
        void ipc.rigStart(rigConfigFromStore()).catch((e) => c().setRigStatus(`error: ${e}`));
      }
      ipc.ctyStatus().then((s) => c().setCtyStatus(s));
      if (settings.ctyAutoUpdate ?? true) {
        void ipc.maybeUpdateCty().then((s) => {
          c().setCtyStatus(s);
          if (s.updated) void ipc.recentSpots(settings.spotHistoryLimit).then(c().loadSpots);
        });
      }
      c().setPresetsAutoUpdate(settings.presetsAutoUpdate ?? true);
      ipc.presetsStatus().then((s) => c().setPresetsStatus(s));
      if (settings.presetsAutoUpdate ?? true) {
        void ipc.maybeUpdatePresets().then((s) => c().setPresetsStatus(s));
      }
      c().setUpdateCheckEnabled(settings.updateCheckEnabled ?? true);
      if (settings.updateCheckEnabled ?? true) {
        void ipc
          .checkUpdate()
          .then((info) => {
            c().setUpdateInfo(info);
            if (info.newer && info.latest && info.latest !== settings.updateSkippedVersion)
              setUpdate(info);
          })
          .catch(() => {
            /* offline / no releases yet / GitHub rate-limited — no popup */
          });
      }
      await ipc.setHomeLocator(settings.homeLocator || null);
      try {
        const [spots, ann, wwv, wcy, talk, chat] = await Promise.all([
          ipc.recentSpots(settings.spotHistoryLimit),
          ipc.recentAnnouncements(200),
          ipc.recentWwv(50),
          ipc.recentWcy(50),
          ipc.recentTalk(500),
          ipc.recentChat(500),
        ]);
        c().loadSpots(spots);
        c().loadAnnouncements(ann);
        c().loadWwv(wwv);
        c().loadWcy(wcy);
        c().loadTalk(talk);
        c().loadChat(chat);
      } catch {
        /* history db may be empty on first run */
      } finally {
        // Historical data isn't "new" — only activity after startup lights a dot.
        c().markAllSeen(TAB_IDS);
      }
    })();
  }, []);

  // Connection health, shown as a coloured dot on the Connection tab:
  // green = every configured profile is online, amber = some (or still
  // connecting), red = profiles exist but none are up, idle = no profiles.
  const conns = Object.values(store.connections);
  const onlineCount = conns.filter((x) => x.state === "online").length;
  const connectingCount = conns.filter(
    (x) => x.state === "connecting" || x.state === "logging_in",
  ).length;
  const connDot =
    conns.length === 0
      ? "idle"
      : onlineCount === conns.length
        ? "ok"
        : onlineCount > 0 || connectingCount > 0
          ? "partial"
          : "down";

  // Newest activity timestamp (ms) per tab, for the "unread" dot.
  const activity: Partial<Record<TabId, number>> = {
    spots: store.spotsMatchTs,
    announcements: (store.announcements[0]?.received_at ?? 0) * 1000,
    propagation: Math.max(
      (store.wwv[0]?.received_at ?? 0) * 1000,
      (store.wcy[0]?.received_at ?? 0) * 1000,
    ),
    talk: (store.talk[0]?.received_at ?? 0) * 1000,
    chat: (store.chat[0]?.received_at ?? 0) * 1000,
    alerts: store.alertHits[0]?.at ?? 0,
    mail: store.mailNewTs,
  };

  // Mark the active tab seen whenever it's shown or its activity advances.
  const activeTabActivity = activity[tab] ?? 0;
  useEffect(() => {
    useCluster.getState().markSeen(tab);
  }, [tab, activeTabActivity]);

  // "Talk to …" from a spot menu → jump to the Talk tab (TalkPanel adopts the call).
  useEffect(() => {
    if (store.pendingTalk) setTab("talk");
  }, [store.pendingTalk]);

  return (
    <div className="app">
      <header className="topbar">
        <strong>DX Cluster Desktop</strong>
        {version && (
          <button
            className="topbar-version"
            title={tr("tab.about")}
            onClick={() => setTab("about")}
          >
            v{version}
          </button>
        )}
        <nav className="tabs">
          {TAB_GROUPS.map((g) => (
            <div className="tab-group" key={g.id} title={tr(`group.${g.id}`)}>
              {g.tabs.map((id) => {
                const act = activity[id];
                const unread = id !== tab && act !== undefined && act > (store.seen[id] ?? 0);
                return (
                  <button
                    key={id}
                    className={id === tab ? "tab active" : "tab"}
                    onClick={() => setTab(id)}
                    title={
                      id === "connection"
                        ? tr(onlineCount > 0 ? "header.online" : "header.offline", {
                            n: onlineCount,
                          })
                        : undefined
                    }
                  >
                    {id === "connection" && (
                      <span className={`conn-status conn-${connDot}`} aria-hidden />
                    )}
                    {tr(`tab.${id}`)}
                    <span className="tab-dot" data-on={unread} aria-hidden />
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        {store.catEnabled &&
          (() => {
            const err = store.rigStatus.startsWith("error:");
            const ok = store.rigStatus === "connected";
            const label =
              ok && store.rigVfo
                ? `${(store.rigVfo.freqHz / 1000).toFixed(1)} ${store.rigVfo.mode}`
                : err
                  ? tr("rig.state.error")
                  : tr(`rig.state.${store.rigStatus}`);
            return (
              <button
                className={`topbar-cat${ok ? " ok" : ""}${err ? " err" : ""}`}
                title={err ? store.rigStatus : tr("rig.chipHint")}
                onClick={() => setTab("connection")}
              >
                <span className="topbar-cat-dot" aria-hidden />
                {label}
              </button>
            );
          })()}
        {sendTargets.length > 1 &&
          (() => {
            const active =
              sendTargets.find((c) => c.profile.id === store.sendTargetId) ?? sendTargets[0];
            return (
              <label className="topbar-target" title={tr("topbar.sendTargetHint")}>
                {tr("topbar.sendTarget")}
                <select
                  value={active.profile.id}
                  onChange={(e) => store.setSendTargetId(e.target.value || null)}
                >
                  {sendTargets.map((c) => (
                    <option key={c.profile.id} value={c.profile.id}>
                      {c.profile.id}
                    </option>
                  ))}
                </select>
              </label>
            );
          })()}
        <label className="topbar-age" title={tr("topbar.maxAgeHint")}>
          {tr("topbar.maxAge")}
          <input
            type="number"
            min={0}
            step={5}
            value={store.spotMaxAgeMin || ""}
            placeholder="∞"
            onChange={(e) => {
              const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
              store.setSpotMaxAgeMin(v);
              void patchSettings({ spotMaxAgeMin: v });
              ageTickAndPrune();
            }}
          />
          {tr("topbar.maxAgeUnit")}
        </label>
      </header>

      <main className="content">
        {/* All panels stay mounted so per-panel state (fetched user lists,
            open threads, …) survives tab switches. Each is wrapped in an
            ErrorBoundary so one panel's render error can't blank the app. */}
        <div hidden={tab !== "connection"}>
          <ErrorBoundary label={tr("tab.connection")}>
            <ConnectionPanel />
          </ErrorBoundary>
        </div>
        <div hidden={tab !== "spots"} className="panel-fill">
          <ErrorBoundary label={tr("tab.spots")}>
            <SpotsPanel onGoToFilters={goToFilters} />
          </ErrorBoundary>
        </div>
        <div hidden={tab !== "bandmap"} className="panel-fill">
          <ErrorBoundary label={tr("tab.bandmap")}>
            <BandmapPanel onGoToFilters={goToFilters} active={tab === "bandmap"} />
          </ErrorBoundary>
        </div>
        <div hidden={tab !== "map"} className="panel-fill">
          <ErrorBoundary label={tr("tab.map")}>
            <MapPanel
              onGoToFilters={goToFilters}
              onGoToPropagation={goToPropagation}
              active={tab === "map"}
            />
          </ErrorBoundary>
        </div>
        <div hidden={tab !== "activity"} className="panel-fill">
          <ErrorBoundary label={tr("tab.activity")}>
            <BandActivityPanel onGoToSpots={goToSpots} active={tab === "activity"} />
          </ErrorBoundary>
        </div>
        <div hidden={tab !== "filters"}>
          <ErrorBoundary label={tr("tab.filters")}>
            <FiltersPanel />
          </ErrorBoundary>
        </div>
        <div hidden={tab !== "announcements"}>
          <ErrorBoundary label={tr("tab.announcements")}>
            <AnnouncementsPanel />
          </ErrorBoundary>
        </div>
        <div hidden={tab !== "propagation"}>
          <ErrorBoundary label={tr("tab.propagation")}>
            <PropagationPanel />
          </ErrorBoundary>
        </div>
        <div hidden={tab !== "talk"} className="panel-fill">
          <ErrorBoundary label={tr("tab.talk")}>
            <TalkPanel />
          </ErrorBoundary>
        </div>
        <div hidden={tab !== "chat"} className="panel-fill">
          <ErrorBoundary label={tr("tab.chat")}>
            <ChatPanel />
          </ErrorBoundary>
        </div>
        <div hidden={tab !== "mail"}>
          <ErrorBoundary label={tr("tab.mail")}>
            <MailPanel />
          </ErrorBoundary>
        </div>
        <div hidden={tab !== "tools"}>
          <ErrorBoundary label={tr("tab.tools")}>
            <ToolsPanel />
          </ErrorBoundary>
        </div>
        <div hidden={tab !== "alerts"}>
          <ErrorBoundary label={tr("tab.alerts")}>
            <AlertsPanel onGoToSpots={goToSpots} />
          </ErrorBoundary>
        </div>
        <div hidden={tab !== "users"}>
          <ErrorBoundary label={tr("tab.users")}>
            <UsersPanel />
          </ErrorBoundary>
        </div>
        <div hidden={tab !== "raw"} className="panel-fill">
          <ErrorBoundary label={tr("tab.raw")}>
            <RawConsolePanel />
          </ErrorBoundary>
        </div>
        <div hidden={tab !== "about"} className="panel-fill">
          <ErrorBoundary label={tr("tab.about")}>
            <AboutPanel />
          </ErrorBoundary>
        </div>
      </main>

      {update && (
        <UpdateBanner
          info={update}
          onClose={() => setUpdate(null)}
          onSkip={() => {
            void patchSettings({ updateSkippedVersion: update.latest ?? "" });
            setUpdate(null);
          }}
        />
      )}
    </div>
  );
}
