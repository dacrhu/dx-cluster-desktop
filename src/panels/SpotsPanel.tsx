import { useMemo, useState } from "react";
import { useCluster } from "@/store/useCluster";
import { spotPasses } from "@/lib/filter";
import { compileQuery } from "@/lib/query";
import { ALL_BANDS, ALL_MODES, type Mode } from "@/lib/types";
import { SpotTable, type SpotAction } from "@/components/SpotTable";
import * as ipc from "@/lib/ipc";

const QUERY_HELP =
  "Kereső: szabad szó bárhol illeszkedik. Mezők: dx: by: dxcc: bydxcc: cq: bycq: itu: " +
  "cont: bycont: band: mode: grid: c: freq: age:  ·  freq:14000-14100, freq>14000  ·  " +
  '-mode:cw (tagadás)  ·  "több szavas"  ·  dx:HA OR dx:OM  ·  band:20m,40m (vagy-lista)';

export function SpotsPanel({ onGoToFilters }: { onGoToFilters: () => void }) {
  const { spots, filters, filtersEnabled, connections, setFiltersEnabled } = useCluster();

  const [bands, setBands] = useState<string[]>([]);
  const [modes, setModes] = useState<Mode[]>([]);
  const [search, setSearch] = useState("");
  const [showSkimmer, setShowSkimmer] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  const onlineId = Object.values(connections).find((c) => c.state === "online")?.profile.id;

  const queryPred = useMemo(() => compileQuery(search), [search]);

  const visible = useMemo(() => {
    return spots.filter((s) => {
      if (!showSkimmer && s.is_skimmer) return false;
      if (bands.length && !(s.band && bands.includes(s.band))) return false;
      if (modes.length && !modes.includes(s.mode)) return false;
      if (!queryPred(s)) return false;
      if (filtersEnabled && filters.length && !spotPasses(s, filters)) return false;
      return true;
    });
  }, [spots, bands, modes, queryPred, showSkimmer, filters, filtersEnabled]);

  const [freq, setFreq] = useState("");
  const [call, setCall] = useState("");
  const [comment, setComment] = useState("");
  const [postMsg, setPostMsg] = useState("");

  async function postSpot() {
    if (!onlineId) return;
    try {
      const sent = await ipc.postSpot(onlineId, Number(freq), call, comment);
      setPostMsg(`elküldve: ${sent}`);
      setCall("");
      setComment("");
    } catch (e) {
      setPostMsg(String(e));
    }
  }

  function addTerm(term: string) {
    setSearch((prev) => (prev.trim() ? `${prev.trim()} ${term}` : term));
  }

  const actions: SpotAction[] = [
    { label: "Csak ez a hívójel", run: (s) => setSearch(`dx:${s.dx_call}`) },
    { label: "+ ez a DXCC a keresőbe", run: (s) => s.dx && addTerm(`dxcc:${s.dx.primary_prefix}`) },
    { label: "+ ez a sáv a keresőbe", run: (s) => s.band && addTerm(`band:${s.band}`) },
    { label: "− ez a spotter kizárása", run: (s) => addTerm(`-by:${s.spotter_base}`) },
    {
      label: "Spot előkészítése erre",
      run: (s) => {
        setFreq(String(s.freq_khz));
        setCall(s.dx_call);
      },
    },
    {
      label: "Talk a spotternek",
      run: (s) => {
        if (onlineId) ipc.sendRaw(onlineId, `talk ${s.spotter_base}`);
      },
    },
  ];

  function toggle<T>(list: T[], v: T, set: (x: T[]) => void) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  return (
    <div className="panel spots-panel">
      <div className="quickbar">
        <div className="band-buttons">
          {ALL_BANDS.map((b) => (
            <button
              key={b}
              className={bands.includes(b) ? "chip active" : "chip"}
              onClick={() => toggle(bands, b, setBands)}
            >
              {b}
            </button>
          ))}
        </div>
        <div className="mode-buttons">
          {ALL_MODES.map((m) => (
            <button
              key={m}
              className={modes.includes(m) ? "chip active" : "chip"}
              onClick={() => toggle(modes, m, setModes)}
            >
              {m}
            </button>
          ))}
        </div>
        <input
          className="search mono"
          placeholder='keresés — pl. dx:HA band:20m -mode:ft  vagy  "med games"'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          spellCheck={false}
        />
        {search && (
          <button className="chip" onClick={() => setSearch("")} title="kereső törlése">
            ✕
          </button>
        )}
        <button
          className={showHelp ? "chip active" : "chip"}
          onClick={() => setShowHelp((v) => !v)}
          title="keresési szintaxis"
        >
          ?
        </button>
        <label className="inline">
          <input
            type="checkbox"
            checked={showSkimmer}
            onChange={(e) => setShowSkimmer(e.target.checked)}
          />
          skimmer
        </label>
        <label className="inline">
          <input
            type="checkbox"
            checked={filtersEnabled}
            onChange={(e) => setFiltersEnabled(e.target.checked)}
          />
          mentett szűrők
        </label>
        <button onClick={onGoToFilters}>Szűrők szerkesztése</button>
        <span className="muted">
          {visible.length} / {spots.length}
        </span>
      </div>

      {showHelp && <p className="muted query-help">{QUERY_HELP}</p>}

      <div className="post-spot">
        <span>Spot küldése:</span>
        <input
          className="mono"
          style={{ width: 90 }}
          placeholder="kHz"
          value={freq}
          onChange={(e) => setFreq(e.target.value)}
        />
        <input
          className="mono"
          style={{ width: 110 }}
          placeholder="hívójel"
          value={call}
          onChange={(e) => setCall(e.target.value)}
        />
        <input
          className="grow"
          placeholder="megjegyzés"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button
          className="primary"
          disabled={!onlineId || !freq || !call}
          onClick={postSpot}
          title={onlineId ? "" : "nincs élő kapcsolat"}
        >
          Küldés
        </button>
        {postMsg && <span className="muted">{postMsg}</span>}
      </div>

      <SpotTable spots={visible} actions={actions} />
    </div>
  );
}
