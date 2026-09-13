import { useCluster } from "@/store/useCluster";
import { useShallow } from "zustand/react/shallow";
import { patchSettings, saveAlertHits } from "@/lib/persist";
import { describeAlert, emptyAlert, type AlertRule } from "@/lib/alerts";
import { fmtAge, fmtUtc } from "@/lib/format";
import { modeClass, modeLabel } from "@/lib/mode";
import { beep, notify, ALERT_SOUNDS, type AlertSound } from "@/lib/notify";
import { ALL_BANDS, ALL_CONTINENTS, ALL_MODES, type Mode } from "@/lib/types";
import { Chips, CsvInput } from "@/components/fields";
import { QueryHelp } from "@/components/QueryHelp";
import { toggleIn } from "@/lib/util";
import { memo, useState } from "react";
import { useT } from "@/i18n";

export const AlertsPanel = memo(function AlertsPanel({ onGoToSpots }: { onGoToSpots: () => void }) {
  const tr = useT();
  const {
    alerts,
    setAlerts,
    alertsEnabled,
    setAlertsEnabled,
    alertsSound,
    setAlertsSound,
    alertSoundStyle,
    setAlertSoundStyle,
    alertHits,
    clearAlertHits,
    setPendingSpotSearch,
  } = useCluster(
    useShallow((s) => ({
      alerts: s.alerts,
      setAlerts: s.setAlerts,
      alertsEnabled: s.alertsEnabled,
      setAlertsEnabled: s.setAlertsEnabled,
      alertsSound: s.alertsSound,
      setAlertsSound: s.setAlertsSound,
      alertSoundStyle: s.alertSoundStyle,
      setAlertSoundStyle: s.setAlertSoundStyle,
      alertHits: s.alertHits,
      clearAlertHits: s.clearAlertHits,
      setPendingSpotSearch: s.setPendingSpotSearch,
    })),
  );
  const hitsSeen = useCluster((s) => s.seen.alerts ?? 0);

  function openHit(call: string) {
    setPendingSpotSearch(`dx:${call}`);
    onGoToSpots();
  }
  function clearHits() {
    clearAlertHits();
    void saveAlertHits([]);
  }

  // Accordion: at most one card open at a time (null = all collapsed).
  const [expanded, setExpanded] = useState<string | null>(null);
  const toggleExpand = (id: string) => setExpanded((cur) => (cur === id ? null : id));

  function persist(next: AlertRule[]) {
    setAlerts(next);
    void patchSettings({ alertRules: next });
  }
  const update = (i: number, patch: Partial<AlertRule>) =>
    persist(alerts.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  const add = () => {
    const rule = emptyAlert();
    persist([...alerts, rule]);
    setExpanded(rule.id); // open the new one for editing
  };
  const remove = (i: number) => persist(alerts.filter((_, idx) => idx !== i));

  async function saveToggle(patch: { alertsEnabled?: boolean; alertsSound?: boolean }) {
    if (patch.alertsEnabled !== undefined) setAlertsEnabled(patch.alertsEnabled);
    if (patch.alertsSound !== undefined) setAlertsSound(patch.alertsSound);
    await patchSettings(patch);
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{tr("alerts.title")}</h2>
      </div>

      <section className="alert-hits">
        <div className="panel-head">
          <h3>{tr("alerts.hits", { n: alertHits.length })}</h3>
          <span className="muted">{tr("alerts.hitAgeNote")}</span>
          {alertHits.length > 0 && <button onClick={clearHits}>{tr("alerts.clearHits")}</button>}
        </div>
        {alertHits.length === 0 ? (
          <p className="muted">{tr("alerts.noHits")}</p>
        ) : (
          <div className="alert-hits-scroll">
            <table className="data-table alert-hits-table">
              <thead>
                <tr>
                  <th>{tr("col.age")}</th>
                  <th>{tr("col.utc")}</th>
                  <th>{tr("col.khz")}</th>
                  <th>{tr("col.band")}</th>
                  <th>{tr("col.dx")}</th>
                  <th>{tr("col.dxcc")}</th>
                  <th>{tr("col.mode")}</th>
                  <th>{tr("alerts.hitRule")}</th>
                  <th>{tr("col.comment")}</th>
                </tr>
              </thead>
              <tbody>
                {alertHits.map((h) => (
                  <tr
                    key={h.key}
                    className={h.at > hitsSeen ? "fresh" : ""}
                    style={{ cursor: "pointer" }}
                    onClick={() => openHit(h.spot.dx_call)}
                    title={tr("alerts.hitOpen")}
                  >
                    <td>{fmtAge(h.spot.received_at)}</td>
                    <td className="mono">{fmtUtc(h.spot.received_at)}</td>
                    <td className="mono">{h.spot.freq_khz.toFixed(1)}</td>
                    <td>{h.spot.band ?? "—"}</td>
                    <td className="mono">{h.spot.dx_call}</td>
                    <td>{h.spot.dx?.dxcc_name ?? "—"}</td>
                    <td className={`mode-tag ${modeClass(h.spot.mode)}`}>
                      {modeLabel(h.spot.mode, h.spot.comment)}
                    </td>
                    <td>{h.ruleLabel || "—"}</td>
                    <td>{h.spot.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="alerts-settings">
        <div className="panel-head">
          <h3>{tr("alerts.settingsTitle")}</h3>
        </div>
        <div className="post-spot alerts-notify">
          <label className="inline">
            <input
              type="checkbox"
              checked={alertsEnabled}
              onChange={(e) => saveToggle({ alertsEnabled: e.target.checked })}
            />
            {tr("alerts.enabled")}
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={alertsSound}
              onChange={(e) => saveToggle({ alertsSound: e.target.checked })}
            />
            {tr("alerts.sound")}
          </label>
          <select
            value={alertSoundStyle}
            disabled={!alertsSound}
            onChange={(e) => {
              const v = e.target.value as AlertSound;
              setAlertSoundStyle(v);
              void patchSettings({ alertSoundStyle: v });
              beep(v);
            }}
          >
            {ALERT_SOUNDS.map((s) => (
              <option key={s.id} value={s.id}>
                {tr(`sound.${s.id}`)}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              void notify(tr("alerts.testTitle"), tr("alerts.testBody"));
              if (alertsSound) beep(alertSoundStyle);
            }}
          >
            {tr("alerts.test")}
          </button>
        </div>
        <span className="muted">{tr("alerts.cooldownNote")}</span>
      </section>

      <section className="alerts-rules">
        <div className="panel-head">
          <h3>{tr("alerts.rulesTitle")}</h3>
          <button className="primary" onClick={add}>
            {tr("alerts.addRule")}
          </button>
        </div>

        <p className="muted">{tr("alerts.andNote")}</p>

        {alerts.length === 0 && <p className="muted">{tr("alerts.none")}</p>}

        <ul className="rule-list">
          {alerts.map((a, i) => {
            const open = expanded === a.id;
            return (
              <li key={a.id} className={`rule-card${a.enabled ? "" : " is-disabled"}`}>
                <div
                  className="rule-head"
                  onClick={() => toggleExpand(a.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleExpand(a.id)}
                >
                  <input
                    type="checkbox"
                    checked={a.enabled}
                    title={tr("alerts.active")}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => update(i, { enabled: e.target.checked })}
                  />
                  <span className="disclosure">{open ? "▾" : "▸"}</span>
                  <span className="rule-name">{a.label || tr("alerts.unnamed")}</span>
                  <span className="rule-summary">{describeAlert(a)}</span>
                  <span className="grow" />
                  <button
                    className="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(i);
                    }}
                  >
                    {tr("common.delete")}
                  </button>
                </div>

                {open && (
                  <div className="rule-body">
                    <div className="row">
                      <label className="grow">
                        {tr("alerts.ruleName")}
                        <input
                          value={a.label}
                          placeholder={tr("alerts.ruleNamePlaceholder")}
                          onChange={(e) => update(i, { label: e.target.value })}
                        />
                      </label>
                      <label className="inline">
                        <input
                          type="checkbox"
                          checked={a.matchSpotter}
                          onChange={(e) => update(i, { matchSpotter: e.target.checked })}
                        />
                        {tr("alerts.matchSpotter")}
                      </label>
                    </div>

                    <div className="row">
                      <CsvInput
                        label={
                          a.matchSpotter ? tr("alerts.spotterPrefixes") : tr("alerts.dxPrefixes")
                        }
                        value={a.calls}
                        placeholder="HA, OM2, 9A"
                        onChange={(v) => update(i, { calls: v })}
                      />
                      <CsvInput
                        label={tr("alerts.dxcc")}
                        value={a.dxcc}
                        placeholder="HA, 3B9"
                        onChange={(v) => update(i, { dxcc: v })}
                      />
                    </div>

                    <div className="row">
                      <CsvInput
                        label={
                          a.matchSpotter
                            ? tr("alerts.spotterExactCalls")
                            : tr("alerts.dxExactCalls")
                        }
                        value={a.exactCalls}
                        placeholder="HA5XYZ, OM3ABC, 9A1AA"
                        onChange={(v) => update(i, { exactCalls: v })}
                      />
                    </div>
                    <p className="field-hint">{tr("alerts.exactCallsHint")}</p>

                    <label className="grow">
                      <span className="qh-label">
                        {tr("alerts.query")}
                        <QueryHelp />
                      </span>
                      <input
                        className="mono"
                        value={a.query ?? ""}
                        placeholder={tr("alerts.queryPlaceholder")}
                        spellCheck={false}
                        onChange={(e) => update(i, { query: e.target.value })}
                      />
                      <span className="field-hint">{tr("alerts.queryHint")}</span>
                    </label>

                    <div className="field">
                      <span>{tr("alerts.bands")}</span>
                      <Chips
                        options={ALL_BANDS}
                        selected={a.bands}
                        onToggle={(b) => update(i, { bands: toggleIn(a.bands, b) })}
                      />
                    </div>
                    <div className="field">
                      <span>{tr("alerts.modes")}</span>
                      <Chips
                        options={ALL_MODES}
                        selected={a.modes}
                        onToggle={(m) => update(i, { modes: toggleIn(a.modes, m as Mode) })}
                      />
                    </div>
                    <div className="field">
                      <span>{tr("alerts.continent")}</span>
                      <Chips
                        options={ALL_CONTINENTS}
                        selected={a.continents}
                        onToggle={(k) => update(i, { continents: toggleIn(a.continents, k) })}
                      />
                    </div>

                    <code className="preview">
                      {tr("alerts.fires", { desc: describeAlert(a) })}
                    </code>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
});
