import { memo, useEffect, useMemo, useState } from "react";
import { useCluster } from "@/store/useCluster";
import { useShallow } from "zustand/react/shallow";
import { saveProfiles, patchSettings } from "@/lib/persist";
import { LANGUAGES, resolveLang, useT } from "@/i18n";
import { resolvePskrCalls } from "@/lib/pskr";
import { rigConfigFromStore, testLogPush } from "@/lib/engage";
import * as ipc from "@/lib/ipc";
import type { ClusterPreset, ConnState, LogFormat, NodeProfile, RigModel } from "@/lib/types";

const BAUD_RATES = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

const BLANK: NodeProfile = {
  id: "",
  host: "",
  port: 7300,
  callsign: "",
  password: null,
  on_login: [],
  auto_connect: false,
  kind: "cluster",
};

export const ConnectionPanel = memo(function ConnectionPanel() {
  const tr = useT();
  const stateLabel = (s: ConnState) => tr(`conn.state.${s}`);
  const {
    connections,
    upsertProfile,
    removeProfile,
    homeLocator,
    setHomeLocator,
    lang,
    setLang,
    sysLocale,
    ctyStatus,
    ctyAutoUpdate,
    setCtyAutoUpdate,
    setCtyStatus,
    pskrEnabled,
    pskrCallsigns,
    pskrStatus,
    setPskrEnabled,
    setPskrCallsigns,
    setPskrStatus,
    wsjtxEnabled,
    wsjtxBind,
    wsjtxStatus,
    setWsjtxEnabled,
    setWsjtxBind,
    setWsjtxStatus,
    catEnabled,
    catTransport,
    catHost,
    catPort,
    catModelId,
    catDevice,
    catBaud,
    catPoll,
    catFollow,
    catDigiMode,
    rigStatus,
    rigVfo,
    setCatEnabled,
    setCatTransport,
    setCatHost,
    setCatPort,
    setCatModelId,
    setCatDevice,
    setCatBaud,
    setCatPoll,
    setCatFollow,
    setCatDigiMode,
    setRigStatus,
    logPushEnabled,
    logHost,
    logPort,
    logFormat,
    raiseLoggerEnabled,
    raiseLoggerTitle,
    setLogPushEnabled,
    setLogHost,
    setLogPort,
    setLogFormat,
    setRaiseLoggerEnabled,
    setRaiseLoggerTitle,
    presetsStatus,
    presetsAutoUpdate,
    setPresetsStatus,
    setPresetsAutoUpdate,
  } = useCluster(
    useShallow((s) => ({
      connections: s.connections,
      upsertProfile: s.upsertProfile,
      removeProfile: s.removeProfile,
      homeLocator: s.homeLocator,
      setHomeLocator: s.setHomeLocator,
      lang: s.lang,
      setLang: s.setLang,
      sysLocale: s.sysLocale,
      ctyStatus: s.ctyStatus,
      ctyAutoUpdate: s.ctyAutoUpdate,
      setCtyAutoUpdate: s.setCtyAutoUpdate,
      setCtyStatus: s.setCtyStatus,
      pskrEnabled: s.pskrEnabled,
      pskrCallsigns: s.pskrCallsigns,
      pskrStatus: s.pskrStatus,
      setPskrEnabled: s.setPskrEnabled,
      setPskrCallsigns: s.setPskrCallsigns,
      setPskrStatus: s.setPskrStatus,
      wsjtxEnabled: s.wsjtxEnabled,
      wsjtxBind: s.wsjtxBind,
      wsjtxStatus: s.wsjtxStatus,
      setWsjtxEnabled: s.setWsjtxEnabled,
      setWsjtxBind: s.setWsjtxBind,
      setWsjtxStatus: s.setWsjtxStatus,
      catEnabled: s.catEnabled,
      catTransport: s.catTransport,
      catHost: s.catHost,
      catPort: s.catPort,
      catModelId: s.catModelId,
      catDevice: s.catDevice,
      catBaud: s.catBaud,
      catPoll: s.catPoll,
      catFollow: s.catFollow,
      catDigiMode: s.catDigiMode,
      rigStatus: s.rigStatus,
      rigVfo: s.rigVfo,
      setCatEnabled: s.setCatEnabled,
      setCatTransport: s.setCatTransport,
      setCatHost: s.setCatHost,
      setCatPort: s.setCatPort,
      setCatModelId: s.setCatModelId,
      setCatDevice: s.setCatDevice,
      setCatBaud: s.setCatBaud,
      setCatPoll: s.setCatPoll,
      setCatFollow: s.setCatFollow,
      setCatDigiMode: s.setCatDigiMode,
      setRigStatus: s.setRigStatus,
      logPushEnabled: s.logPushEnabled,
      logHost: s.logHost,
      logPort: s.logPort,
      logFormat: s.logFormat,
      raiseLoggerEnabled: s.raiseLoggerEnabled,
      raiseLoggerTitle: s.raiseLoggerTitle,
      setLogPushEnabled: s.setLogPushEnabled,
      setLogHost: s.setLogHost,
      setLogPort: s.setLogPort,
      setLogFormat: s.setLogFormat,
      setRaiseLoggerEnabled: s.setRaiseLoggerEnabled,
      setRaiseLoggerTitle: s.setRaiseLoggerTitle,
      presetsStatus: s.presetsStatus,
      presetsAutoUpdate: s.presetsAutoUpdate,
      setPresetsStatus: s.setPresetsStatus,
      setPresetsAutoUpdate: s.setPresetsAutoUpdate,
    })),
  );
  const [view, setView] = useState<"conn" | "settings">("conn");
  const [draft, setDraft] = useState<NodeProfile | null>(null);
  const [newDraft, setNewDraft] = useState(false);
  const [ctyBusy, setCtyBusy] = useState(false);
  const [presetsBusy, setPresetsBusy] = useState(false);
  const [locDraft, setLocDraft] = useState<string | null>(null);
  const [pskrDraft, setPskrDraft] = useState<string | null>(null);
  const [wsjtxDraft, setWsjtxDraft] = useState<string | null>(null);
  const [catHostDraft, setCatHostDraft] = useState<string | null>(null);
  const [catDeviceDraft, setCatDeviceDraft] = useState<string | null>(null);
  const [logHostDraft, setLogHostDraft] = useState<string | null>(null);
  const [raiseCmdDraft, setRaiseCmdDraft] = useState<string | null>(null);
  const [rigModels, setRigModels] = useState<RigModel[]>([]);
  const [rigTestMsg, setRigTestMsg] = useState("");
  const [logTestMsg, setLogTestMsg] = useState("");
  const [presets, setPresets] = useState<ClusterPreset[]>([]);
  const [presetCountry, setPresetCountry] = useState("");

  const profiles = Object.values(connections).map((c) => c.profile);
  const profileCalls = profiles.map((p) => p.callsign).filter(Boolean);

  async function applyPskr(enabled: boolean, callsigns: string) {
    if (enabled) {
      const calls = resolvePskrCalls(callsigns, profileCalls);
      if (!calls.length) {
        setPskrStatus("off");
        return;
      }
      setPskrStatus("connecting");
      await ipc.pskrStart(calls).catch((e) => setPskrStatus(`error: ${e}`));
    } else {
      await ipc.pskrStop().catch(() => {});
    }
  }

  async function togglePskr(on: boolean) {
    setPskrEnabled(on);
    await patchSettings({ pskrEnabled: on });
    await applyPskr(on, pskrCallsigns);
  }

  async function savePskrCalls(v: string) {
    setPskrCallsigns(v);
    setPskrDraft(null);
    await patchSettings({ pskrCallsigns: v });
    if (pskrEnabled) await applyPskr(true, v);
  }

  function pskrStatusLabel() {
    if (pskrStatus.startsWith("error:"))
      return tr("conn.pskrError", { msg: pskrStatus.slice(6).trim() });
    if (pskrStatus === "online") return tr("conn.pskrOnline");
    if (pskrStatus === "connecting") return tr("conn.pskrConnecting");
    return tr("conn.pskrOff");
  }

  async function toggleWsjtx(on: boolean) {
    setWsjtxEnabled(on);
    await patchSettings({ wsjtxEnabled: on });
    if (on) {
      setWsjtxStatus("listening");
      await ipc.wsjtxStart(wsjtxBind).catch((e) => setWsjtxStatus(`error: ${e}`));
    } else {
      await ipc.wsjtxStop().catch(() => {});
    }
  }

  async function saveWsjtxBind(v: string) {
    const bind = v.trim() || "127.0.0.1:2237";
    setWsjtxBind(bind);
    setWsjtxDraft(null);
    await patchSettings({ wsjtxBind: bind });
    if (wsjtxEnabled) {
      setWsjtxStatus("listening");
      await ipc.wsjtxStart(bind).catch((e) => setWsjtxStatus(`error: ${e}`));
    }
  }

  function wsjtxStatusLabel() {
    if (wsjtxStatus.startsWith("error:"))
      return tr("conn.wsjtxError", { msg: wsjtxStatus.slice(6).trim() });
    if (wsjtxStatus === "receiving") return tr("conn.wsjtxReceiving");
    if (wsjtxStatus === "listening") return tr("conn.wsjtxListening");
    return tr("conn.wsjtxOff");
  }

  // --- CAT (rig control) ---
  useEffect(() => {
    if (catTransport === "serial" && rigModels.length === 0)
      void ipc
        .rigModels()
        .then(setRigModels)
        .catch(() => {});
  }, [catTransport, rigModels.length]);

  async function applyRig(on: boolean) {
    if (on) {
      setRigStatus("connecting");
      await ipc.rigStart(rigConfigFromStore()).catch((e) => setRigStatus(`error: ${e}`));
    } else {
      await ipc.rigStop().catch(() => {});
    }
  }

  async function toggleCat(on: boolean) {
    setCatEnabled(on);
    await patchSettings({ catEnabled: on });
    await applyRig(on);
  }

  /** Persist a CAT settings patch, then restart the session if it's running. */
  async function patchCat(patch: Parameters<typeof patchSettings>[0]) {
    await patchSettings(patch);
    if (catEnabled) await applyRig(true);
  }

  async function testRig() {
    setRigTestMsg(tr("conn.catTesting"));
    try {
      const hz = await ipc.rigTest(rigConfigFromStore());
      setRigTestMsg(tr("conn.catTestOk", { f: (hz / 1000).toFixed(1) }));
    } catch (e) {
      setRigTestMsg(tr("conn.catError", { msg: String(e) }));
    }
  }

  function rigStatusLabel() {
    if (rigStatus.startsWith("error:"))
      return tr("conn.catError", { msg: rigStatus.slice(6).trim() });
    if (rigStatus === "connected")
      return rigVfo
        ? `${(rigVfo.freqHz / 1000).toFixed(1)} kHz · ${rigVfo.mode}`
        : tr("rig.state.connected");
    return tr(`rig.state.${rigStatus}`);
  }

  // --- logging-program push ---
  async function toggleLogPush(on: boolean) {
    setLogPushEnabled(on);
    await patchSettings({ logPushEnabled: on });
  }

  async function runTestLogPush() {
    try {
      await testLogPush();
      setLogTestMsg(tr("conn.logTestOk"));
    } catch (e) {
      setLogTestMsg(tr("conn.catError", { msg: String(e) }));
    }
  }

  async function saveLocator(v: string) {
    setHomeLocator(v);
    await ipc.setHomeLocator(v || null);
    await patchSettings({ homeLocator: v });
    setLocDraft(null);
  }

  async function refreshCty() {
    setCtyBusy(true);
    try {
      setCtyStatus(await ipc.updateCty());
    } finally {
      setCtyBusy(false);
    }
  }

  async function refreshPresets() {
    setPresetsBusy(true);
    try {
      setPresetsStatus(await ipc.updatePresets());
      setPresets(await ipc.clusterPresets());
    } finally {
      setPresetsBusy(false);
    }
  }

  // Lazy-load the preset list the first time the "new profile" form opens.
  useEffect(() => {
    if (newDraft && presets.length === 0) {
      ipc
        .clusterPresets()
        .then(setPresets)
        .catch(() => {});
    }
  }, [newDraft, presets.length]);

  const presetCountries = useMemo(() => {
    const g = new Map<string, Set<string>>();
    for (const p of presets) {
      if (!p.dxcc || !p.continent) continue; // skip nodes we can't place
      if (!g.has(p.continent)) g.set(p.continent, new Set());
      g.get(p.continent)!.add(p.dxcc);
    }
    return [...g.entries()].map(([cont, set]) => [cont, [...set].sort()] as const).sort();
  }, [presets]);

  const presetNodes = useMemo(
    () =>
      presets.filter((p) => p.dxcc === presetCountry).sort((a, b) => a.name.localeCompare(b.name)),
    [presets, presetCountry],
  );

  function applyPreset(p: ClusterPreset) {
    setDraft((d) => ({
      ...(d ?? BLANK),
      id: p.name,
      host: p.host,
      port: p.port,
      kind: "cluster",
      software: /ar-?cluster/i.test(p.software) ? "ar_cluster" : "dx_spider",
    }));
  }

  async function persist(next: NodeProfile[]) {
    await saveProfiles(next);
  }

  function startAdd() {
    setView("conn");
    setDraft({ ...BLANK, callsign: profiles.find((p) => p.callsign)?.callsign ?? "" });
    setNewDraft(true);
  }
  function startAddRbn(variant: "cw" | "ft8") {
    setView("conn");
    setDraft({
      ...BLANK,
      id: variant === "ft8" ? "RBN FT8" : "RBN CW",
      host: "telnet.reversebeacon.net",
      port: variant === "ft8" ? 7001 : 7000,
      callsign: profiles.find((p) => p.callsign)?.callsign ?? "",
      kind: "rbn",
    });
    setNewDraft(false);
  }
  function startEdit(p: NodeProfile) {
    setView("conn");
    setDraft({ kind: "cluster", ...p, on_login: [...p.on_login] });
    setNewDraft(false);
  }
  function closeDraft() {
    setDraft(null);
    setNewDraft(false);
  }

  async function save() {
    if (!draft) return;
    const id = (draft.id || `${draft.host}:${draft.port}`).trim();
    const profile: NodeProfile = { ...draft, id, callsign: draft.callsign.toUpperCase().trim() };
    upsertProfile(profile);
    closeDraft();
    await persist(Object.values(useCluster.getState().connections).map((c) => c.profile));
  }

  async function del(id: string) {
    removeProfile(id);
    closeDraft();
    await persist(Object.values(useCluster.getState().connections).map((c) => c.profile));
  }

  async function connect(p: NodeProfile) {
    // Optimistically flip state so the button can't be clicked twice (a second
    // socket would be a same-callsign clash the node kicks).
    useCluster.getState().setConnState(p.id, "connecting");
    try {
      await ipc.connectNode(p);
    } catch (e) {
      useCluster.getState().setConnState(p.id, "disconnected");
      useCluster.getState().setConnError(p.id, String(e));
    }
  }

  return (
    <div className="panel conn-panel">
      <div className="panel-head">
        <h2>{tr("conn.title")}</h2>
        <div className="seg-toggle">
          <button className={view === "conn" ? "active" : ""} onClick={() => setView("conn")}>
            {tr("conn.viewConnections")}
          </button>
          <button
            className={view === "settings" ? "active" : ""}
            onClick={() => setView("settings")}
          >
            {tr("conn.settings")}
          </button>
        </div>
        {view === "conn" && (
          <div className="conn-add">
            <button className="primary" onClick={startAdd}>
              {tr("conn.addProfile")}
            </button>
            <div className="row">
              <button onClick={() => startAddRbn("cw")}>{tr("conn.addRbnCw")}</button>
              <button onClick={() => startAddRbn("ft8")}>{tr("conn.addRbnFt8")}</button>
            </div>
          </div>
        )}
      </div>

      {view === "conn" && (
        <>
          {profiles.length === 0 && !draft && <p className="muted">{tr("conn.empty")}</p>}

          <ul className="profile-list">
            {profiles.map((p) => {
              const st = connections[p.id]?.state ?? "disconnected";
              const err = connections[p.id]?.lastError;
              const live = st === "online" || st === "connecting" || st === "logging_in";
              return (
                <li key={p.id} className="profile-row">
                  <span className={`dot ${st}`} />
                  <div className="profile-main">
                    <strong>
                      {p.id}
                      {p.kind === "rbn" && (
                        <span className="tag" title={tr("conn.rbnTagTitle")}>
                          {tr("conn.rbnTag")}
                        </span>
                      )}
                      {(p.kind ?? "cluster") === "cluster" && p.software === "ar_cluster" && (
                        <span className="tag" title={tr("conn.softwareArCluster")}>
                          AR
                        </span>
                      )}
                      {p.auto_connect && (
                        <span className="tag" title={tr("conn.autoTagTitle")}>
                          {tr("conn.autoTag")}
                        </span>
                      )}
                    </strong>
                    <span className="muted">
                      {p.host}:{p.port} · {p.callsign || tr("conn.noCall")}
                    </span>
                    {err && <span className="err">{err}</span>}
                  </div>
                  <span className="state">{stateLabel(st)}</span>
                  {live ? (
                    <button onClick={() => ipc.disconnectNode(p.id)}>
                      {tr("conn.disconnect")}
                    </button>
                  ) : (
                    <button
                      className="primary"
                      disabled={!p.callsign || !p.host}
                      onClick={() => connect(p)}
                    >
                      {tr("conn.connect")}
                    </button>
                  )}
                  <button onClick={() => startEdit(p)}>{tr("common.edit")}</button>
                </li>
              );
            })}
          </ul>

          {draft && (
            <div className="editor">
              <h3>{newDraft ? tr("conn.newProfile") : tr("conn.editProfile")}</h3>

              {newDraft && (
                <section className="preset-browser">
                  <p className="field-hint">{tr("conn.presetIntro")}</p>
                  <label>
                    {tr("conn.presetCountry")}
                    <select
                      value={presetCountry}
                      onChange={(e) => setPresetCountry(e.target.value)}
                    >
                      <option value="">
                        {presets.length ? tr("conn.presetPick") : tr("common.loading")}
                      </option>
                      {presetCountries.map(([cont, list]) => (
                        <optgroup key={cont} label={cont}>
                          {list.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  {presetCountry && (
                    <ul className="preset-list">
                      {presetNodes.map((p) => (
                        <li key={`${p.name}@${p.host}:${p.port}`} onClick={() => applyPreset(p)}>
                          <strong>{p.name}</strong>
                          <span className="muted">
                            {p.host}:{p.port} · {p.software}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="field-hint">{tr("conn.presetCredit")}</p>
                </section>
              )}

              <div className="row">
                <label className="grow">
                  {tr("conn.name")}
                  <input
                    value={draft.id}
                    placeholder={tr("conn.namePlaceholder")}
                    onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                  />
                </label>
                <label>
                  {tr("conn.kindLabel")}
                  <select
                    value={draft.kind ?? "cluster"}
                    onChange={(e) =>
                      setDraft({ ...draft, kind: e.target.value as NodeProfile["kind"] })
                    }
                  >
                    <option value="cluster">{tr("conn.kindCluster")}</option>
                    <option value="rbn">{tr("conn.kindRbn")}</option>
                  </select>
                </label>
                {(draft.kind ?? "cluster") === "cluster" && (
                  <label>
                    {tr("conn.softwareLabel")}
                    <select
                      value={draft.software ?? "dx_spider"}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          software: e.target.value as NodeProfile["software"],
                        })
                      }
                    >
                      <option value="dx_spider">{tr("conn.softwareDxSpider")}</option>
                      <option value="ar_cluster">{tr("conn.softwareArCluster")}</option>
                    </select>
                  </label>
                )}
              </div>
              {draft.kind === "rbn" && <p className="muted">{tr("conn.rbnEditorNote")}</p>}
              <div className="row">
                <label className="grow">
                  {tr("conn.host")}
                  <input
                    value={draft.host}
                    placeholder="hrd.wa9pie.net"
                    onChange={(e) => setDraft({ ...draft, host: e.target.value })}
                  />
                </label>
                <label>
                  {tr("conn.port")}
                  <input
                    type="number"
                    value={draft.port}
                    onChange={(e) => setDraft({ ...draft, port: Number(e.target.value) || 0 })}
                  />
                </label>
              </div>
              <div className="row">
                <label className="grow">
                  {tr("conn.callsign")}
                  <input
                    value={draft.callsign}
                    placeholder="HA5XYZ"
                    onChange={(e) => setDraft({ ...draft, callsign: e.target.value })}
                  />
                </label>
                <label className="grow">
                  {tr("conn.password")}
                  <input
                    type="password"
                    value={draft.password ?? ""}
                    onChange={(e) => setDraft({ ...draft, password: e.target.value || null })}
                  />
                </label>
              </div>
              <label>
                {tr("conn.onLogin")}
                <textarea
                  rows={3}
                  value={draft.on_login.join("\n")}
                  placeholder={"set/name Bela\nset/qth Budapest\nsh/dx 20"}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      on_login: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <label className="inline">
                <input
                  type="checkbox"
                  checked={draft.auto_connect ?? false}
                  onChange={(e) => setDraft({ ...draft, auto_connect: e.target.checked })}
                />
                {tr("conn.autoConnect")}
              </label>
              <div className="row end">
                {draft.id && (
                  <button className="danger" onClick={() => del(draft.id)}>
                    {tr("common.delete")}
                  </button>
                )}
                <button onClick={closeDraft}>{tr("common.cancel")}</button>
                <button
                  className="primary"
                  onClick={save}
                  disabled={!draft.host || !draft.callsign}
                >
                  {tr("common.save")}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {view === "settings" && (
        <div className="editor settings">
          <details className="settings-group" name="conn-settings">
            <summary>{tr("conn.langGroup")}</summary>
            <label>
              {tr("conn.language")}
              <select
                value={lang}
                onChange={(e) => {
                  const v = e.target.value as typeof lang;
                  setLang(v);
                  void patchSettings({ lang: v });
                }}
              >
                <option value="system">
                  {tr("conn.langSystem")} (
                  {LANGUAGES.find((l) => l.code === resolveLang("system"))?.label})
                </option>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            {lang === "system" && (
              <p className="field-hint">
                {tr("conn.langDetected", { locale: sysLocale ?? navigator.language })}
              </p>
            )}
          </details>

          <details className="settings-group" name="conn-settings">
            <summary>{tr("conn.stationGroup")}</summary>
            <label>
              {tr("conn.locator")}
              <input
                value={locDraft ?? homeLocator}
                placeholder="JN97MN"
                onChange={(e) => setLocDraft(e.target.value.toUpperCase())}
                onBlur={() => locDraft !== null && saveLocator(locDraft)}
                onKeyDown={(e) => e.key === "Enter" && locDraft !== null && saveLocator(locDraft)}
              />
            </label>
            <p className="field-hint">{tr("conn.locatorHint")}</p>
          </details>

          <details className="settings-group" name="conn-settings">
            <summary>{tr("conn.ctyGroup")}</summary>
            <p className="field-hint">
              {ctyStatus
                ? `${tr("conn.ctyEntities", { n: ctyStatus.entities })} · ${
                    ctyStatus.source === "downloaded"
                      ? ctyStatus.age_days != null
                        ? tr("conn.ctyDownloadedAge", { d: ctyStatus.age_days })
                        : tr("conn.ctyDownloaded")
                      : ctyStatus.source === "bundled"
                        ? tr("conn.ctyBundled")
                        : tr("conn.ctyNone")
                  }`
                : "…"}
            </p>
            <p className="field-hint">{tr("conn.ctyCredit")}</p>
            <div className="row settings-controls">
              <label className="inline">
                <input
                  type="checkbox"
                  checked={ctyAutoUpdate}
                  onChange={(e) => {
                    setCtyAutoUpdate(e.target.checked);
                    void patchSettings({ ctyAutoUpdate: e.target.checked });
                  }}
                />
                {tr("conn.ctyAutoUpdate")}
              </label>
              <span className="grow" />
              <button disabled={ctyBusy} onClick={refreshCty}>
                {ctyBusy ? tr("conn.ctyUpdating") : tr("conn.ctyUpdateNow")}
              </button>
            </div>
          </details>

          <details className="settings-group" name="conn-settings">
            <summary>{tr("conn.presetsGroup")}</summary>
            <p className="field-hint">
              {presetsStatus
                ? `${tr("conn.presetsCount", { n: presetsStatus.count })}${
                    presetsStatus.version ? ` (v${presetsStatus.version})` : ""
                  } · ${
                    presetsStatus.source === "downloaded"
                      ? presetsStatus.age_days != null
                        ? tr("conn.ctyDownloadedAge", { d: presetsStatus.age_days })
                        : tr("conn.ctyDownloaded")
                      : presetsStatus.source === "bundled"
                        ? tr("conn.ctyBundled")
                        : tr("conn.ctyNone")
                  }`
                : "…"}
            </p>
            <p className="field-hint">{tr("conn.presetCredit")}</p>
            <div className="row settings-controls">
              <label className="inline">
                <input
                  type="checkbox"
                  checked={presetsAutoUpdate}
                  onChange={(e) => {
                    setPresetsAutoUpdate(e.target.checked);
                    void patchSettings({ presetsAutoUpdate: e.target.checked });
                  }}
                />
                {tr("conn.ctyAutoUpdate")}
              </label>
              <span className="grow" />
              <button disabled={presetsBusy} onClick={refreshPresets}>
                {presetsBusy ? tr("conn.ctyUpdating") : tr("conn.ctyUpdateNow")}
              </button>
            </div>
          </details>

          <details className="settings-group" name="conn-settings">
            <summary>{tr("conn.pskrSection")}</summary>
            <p className="field-hint">{tr("conn.pskrHint")}</p>
            <label className="inline">
              <input
                type="checkbox"
                checked={pskrEnabled}
                onChange={(e) => void togglePskr(e.target.checked)}
              />
              {tr("conn.pskrEnable")}
            </label>
            <label>
              {tr("conn.pskrCallsigns")}
              <input
                value={pskrDraft ?? pskrCallsigns}
                placeholder={resolvePskrCalls("", profileCalls).join(", ") || "HA5XYZ"}
                onChange={(e) => setPskrDraft(e.target.value.toUpperCase())}
                onBlur={() => pskrDraft !== null && savePskrCalls(pskrDraft)}
                onKeyDown={(e) =>
                  e.key === "Enter" && pskrDraft !== null && savePskrCalls(pskrDraft)
                }
              />
            </label>
            <p className="field-hint">
              {tr("conn.pskrStatusLabel")}: {pskrStatusLabel()}
            </p>
          </details>

          <details className="settings-group" name="conn-settings">
            <summary>{tr("conn.wsjtxSection")}</summary>
            <p className="field-hint">{tr("conn.wsjtxHint")}</p>
            <label className="inline">
              <input
                type="checkbox"
                checked={wsjtxEnabled}
                onChange={(e) => void toggleWsjtx(e.target.checked)}
              />
              {tr("conn.wsjtxEnable")}
            </label>
            <label>
              {tr("conn.wsjtxAddr")}
              <input
                className="mono"
                value={wsjtxDraft ?? wsjtxBind}
                placeholder="127.0.0.1:2237"
                onChange={(e) => setWsjtxDraft(e.target.value)}
                onBlur={() => wsjtxDraft !== null && saveWsjtxBind(wsjtxDraft)}
                onKeyDown={(e) =>
                  e.key === "Enter" && wsjtxDraft !== null && saveWsjtxBind(wsjtxDraft)
                }
              />
            </label>
            <p className="field-hint">
              {tr("conn.pskrStatusLabel")}: {wsjtxStatusLabel()}
            </p>
          </details>

          <details className="settings-group" name="conn-settings">
            <summary>{tr("conn.catSection")}</summary>
            <p className="field-hint">{tr("conn.catHint")}</p>
            <label className="inline">
              <input
                type="checkbox"
                checked={catEnabled}
                onChange={(e) => void toggleCat(e.target.checked)}
              />
              {tr("conn.catEnable")}
            </label>
            <label>
              {tr("conn.catTransport")}
              <select
                value={catTransport}
                onChange={(e) => {
                  const v = e.target.value as "network" | "serial";
                  setCatTransport(v);
                  void patchCat({ catTransport: v });
                }}
              >
                <option value="network">{tr("conn.catNetwork")}</option>
                <option value="serial">{tr("conn.catSerial")}</option>
              </select>
            </label>

            {catTransport === "network" ? (
              <>
                <label>
                  {tr("conn.catHost")}
                  <input
                    className="mono"
                    value={catHostDraft ?? catHost}
                    placeholder="127.0.0.1"
                    onChange={(e) => setCatHostDraft(e.target.value)}
                    onBlur={() => {
                      if (catHostDraft === null) return;
                      const v = catHostDraft.trim() || "127.0.0.1";
                      setCatHost(v);
                      setCatHostDraft(null);
                      void patchCat({ catHost: v });
                    }}
                  />
                </label>
                <label>
                  {tr("conn.catPort")}
                  <input
                    type="number"
                    value={catPort}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 4532;
                      setCatPort(v);
                      void patchCat({ catPort: v });
                    }}
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  {tr("conn.catModel")}
                  <select
                    value={catModelId}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setCatModelId(v);
                      void patchCat({ catModelId: v });
                    }}
                  >
                    <option value={0}>{tr("conn.catModelPick")}</option>
                    {rigModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.mfg} {m.model} {m.model ? "" : `#${m.id}`} · {m.status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {tr("conn.catDevice")}
                  <input
                    className="mono"
                    value={catDeviceDraft ?? catDevice}
                    placeholder="/dev/ttyUSB0"
                    onChange={(e) => setCatDeviceDraft(e.target.value)}
                    onBlur={() => {
                      if (catDeviceDraft === null) return;
                      const v = catDeviceDraft.trim();
                      setCatDevice(v);
                      setCatDeviceDraft(null);
                      void patchCat({ catDevice: v });
                    }}
                  />
                </label>
                <label>
                  {tr("conn.catBaud")}
                  <select
                    value={catBaud}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setCatBaud(v);
                      void patchCat({ catBaud: v });
                    }}
                  >
                    {BAUD_RATES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            <label className="inline">
              <input
                type="checkbox"
                checked={catPoll}
                onChange={(e) => {
                  setCatPoll(e.target.checked);
                  void patchCat({ catPoll: e.target.checked });
                }}
              />
              {tr("conn.catPoll")}
            </label>
            <label className="inline">
              <input
                type="checkbox"
                checked={catFollow}
                onChange={(e) => {
                  setCatFollow(e.target.checked);
                  void patchSettings({ catFollow: e.target.checked });
                }}
              />
              {tr("conn.catFollow")}
            </label>
            <div className="seg-field">
              <span className="seg-label">{tr("conn.catDigiMode")}</span>
              <span className="segmented" role="group" aria-label={tr("conn.catDigiMode")}>
                {(["none", "usb", "data"] as const).map((v) => (
                  <button
                    key={v}
                    className={catDigiMode === v ? "active" : ""}
                    aria-pressed={catDigiMode === v}
                    onClick={() => {
                      setCatDigiMode(v);
                      void patchSettings({ catDigiMode: v });
                    }}
                  >
                    {tr(`conn.catDigi_${v}`)}
                  </button>
                ))}
              </span>
            </div>
            <p className="field-hint">{tr("conn.catDigiModeHint")}</p>
            <div className="row settings-controls">
              <button onClick={() => void testRig()}>{tr("conn.catTest")}</button>
              <span className="grow" />
            </div>
            <p className="field-hint">
              {tr("conn.catStatusLabel")}: {rigStatusLabel()}
              {rigTestMsg ? ` — ${rigTestMsg}` : ""}
            </p>
          </details>

          <details className="settings-group" name="conn-settings">
            <summary>{tr("conn.logSection")}</summary>
            <p className="field-hint">{tr("conn.logHint")}</p>
            <label className="inline">
              <input
                type="checkbox"
                checked={logPushEnabled}
                onChange={(e) => void toggleLogPush(e.target.checked)}
              />
              {tr("conn.logEnable")}
            </label>
            <label>
              {tr("conn.logFormat")}
              <select
                value={logFormat}
                onChange={(e) => {
                  const v = e.target.value as LogFormat;
                  setLogFormat(v);
                  void patchSettings({ logFormat: v });
                }}
              >
                <option value="wsjtx">{tr("conn.logFormatWsjtx")}</option>
                <option value="adif">{tr("conn.logFormatAdif")}</option>
              </select>
            </label>
            <label>
              {tr("conn.catHost")}
              <input
                className="mono"
                value={logHostDraft ?? logHost}
                placeholder="127.0.0.1"
                onChange={(e) => setLogHostDraft(e.target.value)}
                onBlur={() => {
                  if (logHostDraft === null) return;
                  const v = logHostDraft.trim() || "127.0.0.1";
                  setLogHost(v);
                  setLogHostDraft(null);
                  void patchSettings({ logHost: v });
                }}
              />
            </label>
            <label>
              {tr("conn.catPort")}
              <input
                type="number"
                value={logPort}
                onChange={(e) => {
                  const v = Number(e.target.value) || 2237;
                  setLogPort(v);
                  void patchSettings({ logPort: v });
                }}
              />
            </label>
            <label className="inline">
              <input
                type="checkbox"
                checked={raiseLoggerEnabled}
                onChange={(e) => {
                  setRaiseLoggerEnabled(e.target.checked);
                  void patchSettings({ raiseLoggerEnabled: e.target.checked });
                }}
              />
              {tr("conn.logRaise")}
            </label>
            <label>
              {tr("conn.logRaiseTitle")}
              <input
                value={raiseCmdDraft ?? raiseLoggerTitle}
                placeholder="Log4OM"
                onChange={(e) => setRaiseCmdDraft(e.target.value)}
                onBlur={() => {
                  if (raiseCmdDraft === null) return;
                  setRaiseLoggerTitle(raiseCmdDraft);
                  setRaiseCmdDraft(null);
                  void patchSettings({ raiseLoggerTitle: raiseCmdDraft });
                }}
              />
            </label>
            <p className="field-hint">{tr("conn.logRaiseHint")}</p>
            <div className="row settings-controls">
              <button disabled={!logPushEnabled} onClick={() => void runTestLogPush()}>
                {tr("conn.logTest")}
              </button>
              <span className="grow" />
            </div>
            {logTestMsg && <p className="field-hint">{logTestMsg}</p>}
          </details>
        </div>
      )}
    </div>
  );
});
