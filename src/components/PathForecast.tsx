import { memo, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useCluster } from "@/store/useCluster";
import { useT } from "@/i18n";
import * as ipc from "@/lib/ipc";
import { patchSettings } from "@/lib/persist";
import { sfiToSsn } from "@/lib/muf";
import { locatorToLonLat, type LonLat } from "@/lib/grid";
import {
  dayNightStrips,
  FORECAST_BANDS,
  forecastGrid,
  pathInfo,
  reliabilityColor,
} from "@/lib/forecast";
import type { CtyEntity } from "@/lib/types";

const HOURS = Array.from({ length: 24 }, (_, i) => i + 1);

/** Band × UTC-hour reliability grid from the QTH to a chosen DXCC entity. */
export const PathForecast = memo(function PathForecast() {
  const tr = useT();
  const { homeLocator, target, setTarget, wwv, wcy } = useCluster(
    useShallow((s) => ({
      homeLocator: s.homeLocator,
      target: s.forecastTarget,
      setTarget: s.setForecastTarget,
      wwv: s.wwv[0],
      wcy: s.wcy[0],
    })),
  );
  const [entities, setEntities] = useState<CtyEntity[]>([]);
  const [long, setLong] = useState(false);
  useEffect(() => {
    ipc
      .ctyEntities()
      .then((e) => setEntities([...e].sort((a, b) => a.name.localeCompare(b.name))))
      .catch((e) => console.warn("cty entities failed to load", e));
  }, []);

  const home = useMemo(() => locatorToLonLat(homeLocator), [homeLocator]);
  const entity = entities.find((e) => e.primary_prefix === target) ?? null;
  const ssn = wcy?.r ?? (wwv ? Math.round(sfiToSsn(wwv.sfi)) : 90);

  const model = useMemo(() => {
    if (!home || !entity) return null;
    const dest: LonLat = [entity.lon, entity.lat];
    const path = pathInfo(home, dest, long);
    return {
      path,
      grid: forecastGrid(path, ssn),
      strips: dayNightStrips(home, dest, path),
    };
  }, [home, entity, long, ssn]);

  const nowHour = ((new Date().getUTCHours() + 23) % 24) + 1; // 00 UTC → column 24

  const pick = (v: string) => {
    setTarget(v);
    void patchSettings({ forecastTarget: v });
  };

  const headLine =
    model && entity
      ? `${entity.name} · ${long ? tr("prop.longPath") : tr("prop.shortPath")}`
      : tr("prop.forecastPick");
  const hint = !home ? tr("prop.forecastNoQth") : !entity ? tr("prop.forecastNoTarget") : null;

  return (
    <section className="path-forecast">
      <div className="panel-head">
        <h3>{tr("prop.forecastTitle")}</h3>
        <div className="pf-controls">
          <select value={target} onChange={(e) => pick(e.target.value)}>
            <option value="">{tr("prop.forecastPick")}</option>
            {entities.map((e) => (
              <option key={e.primary_prefix} value={e.primary_prefix}>
                {e.name} ({e.primary_prefix})
              </option>
            ))}
          </select>
          <span className="seg-toggle">
            <button className={!long ? "active" : ""} onClick={() => setLong(false)}>
              {tr("prop.shortPath")}
            </button>
            <button className={long ? "active" : ""} onClick={() => setLong(true)}>
              {tr("prop.longPath")}
            </button>
          </span>
        </div>
      </div>
      <div className="pf-head">
        <b>{headLine}</b>
        <div className="muted">
          {model
            ? `${Math.round(model.path.km)} km · ${Math.round(model.path.km * 0.621371)} mi · ${Math.round(model.path.bearing)}° · SSN ${ssn}`
            : "\u00a0"}
        </div>
      </div>
      <div className={`pf-wrap${model ? "" : " empty"}`}>
        <table className="pf-table">
          <thead>
            <tr>
              <th />
              {HOURS.map((h) => (
                <th key={h} className={model && h === nowHour ? "pf-now" : ""}>
                  {String(h).padStart(2, "0")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FORECAST_BANDS.map((b, bi) => (
              <tr key={b.label}>
                <th>{b.label}</th>
                {HOURS.map((_, hi) => {
                  const r = model?.grid[bi][hi];
                  return (
                    <td
                      key={hi}
                      style={r == null ? undefined : { background: reliabilityColor(r) }}
                      title={
                        r == null
                          ? undefined
                          : `${b.label} m · ${String(hi + 1).padStart(2, "0")} UTC · ${Math.round(r * 100)} %`
                      }
                    />
                  );
                })}
              </tr>
            ))}
            {(["tx", "mp", "rx"] as const).map((k) => (
              <tr key={k}>
                <th>{k.toUpperCase()}</th>
                {HOURS.map((_, hi) => {
                  const st = model?.strips[k][hi];
                  return <td key={hi} className={st ? `pf-${st}` : ""} />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {hint && <div className="pf-hint">{hint}</div>}
      </div>
      <p className="muted pf-note">{tr("prop.forecastNote")}</p>
    </section>
  );
});
