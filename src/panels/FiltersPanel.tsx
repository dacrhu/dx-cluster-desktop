import { useEffect, useState } from "react";
import { useCluster } from "@/store/useCluster";
import { saveFilters } from "@/lib/persist";
import * as ipc from "@/lib/ipc";
import {
  ALL_BANDS,
  ALL_CONTINENTS,
  ALL_MODES,
  emptyFilter,
  type Mode,
  type SpotFilter,
} from "@/lib/types";

function CsvInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <label className="grow">
      {label}
      <input
        value={value.join(", ")}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
      />
    </label>
  );
}

function Chips<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: readonly T[];
  selected: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o}
          className={selected.includes(o) ? "chip active" : "chip"}
          onClick={() => onToggle(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

const NODE_FILTER_RE = /^\s*(filter\d+|\d+)\s+(accept|reject)\s+(.+?)\s*$/i;

export function FiltersPanel() {
  const { filters, setFilters, connections } = useCluster();
  const [previews, setPreviews] = useState<Record<number, string | null>>({});
  const [nodeFilters, setNodeFilters] = useState<string[] | null>(null);
  const [fetching, setFetching] = useState(false);

  const onlineId = Object.values(connections).find((c) => c.state === "online")?.profile.id;

  async function fetchNodeFilters() {
    if (!onlineId) return;
    setFetching(true);
    try {
      const lines = await ipc.runQuery(onlineId, "sh/filter");
      const parsed = lines
        .map((l) => l.match(NODE_FILTER_RE))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => `${m[2].toLowerCase()} ${m[3]}`);
      setNodeFilters(parsed);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all(filters.map((f) => ipc.applySpotFilter("", f, false).catch(() => null))).then(
      (cmds) => {
        if (cancelled) return;
        const map: Record<number, string | null> = {};
        cmds.forEach((c, i) => (map[i] = c));
        setPreviews(map);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [filters]);

  function update(i: number, patch: Partial<SpotFilter>) {
    const next = filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f));
    setFilters(next);
    saveFilters(next);
  }
  function add() {
    const next = [...filters, emptyFilter()];
    setFilters(next);
    saveFilters(next);
  }
  function remove(i: number) {
    const next = filters.filter((_, idx) => idx !== i);
    setFilters(next);
    saveFilters(next);
  }
  function toggleIn<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  async function applyToNode(f: SpotFilter) {
    if (!onlineId) return;
    await ipc.applySpotFilter(onlineId, f, true);
  }

  return (
    <div className="panel filters-panel">
      <div className="panel-head">
        <h2>Spot szűrők</h2>
        <button className="primary" onClick={add}>
          + Új szabály
        </button>
      </div>
      <p className="muted">
        A szabályok helyben mindig érvényesülnek (a Spotok fülön ki/be kapcsolható). A node-oldali
        alkalmazás DXSpider <code>accept/reject spot</code> parancsot küld — a sáv, mód, kontinens,
        skimmer csak helyi szűrés. Ez a lista az appban létrehozott szabályokat mutatja; a node-on
        korábban (más klienssel vagy kézzel) beállított szűrőket az alábbi gombbal kérheted le.
      </p>

      <div className="preview-row">
        <button disabled={!onlineId || fetching} onClick={fetchNodeFilters}>
          {fetching ? "lekérés…" : "Node aktuális szűrői (sh/filter)"}
        </button>
        {nodeFilters !== null && (
          <code className="preview">
            {nodeFilters.length ? nodeFilters.join("  |  ") : "a node-on nincs aktív spot szűrő"}
          </code>
        )}
      </div>

      {filters.length === 0 && <p className="muted">Nincs szűrő. Minden spot látszik.</p>}

      <ul className="filter-list">
        {filters.map((f, i) => (
          <li key={i} className="filter-card">
            <div className="row">
              <select
                value={f.action}
                onChange={(e) => update(i, { action: e.target.value as "accept" | "reject" })}
              >
                <option value="accept">Elfogad (accept)</option>
                <option value="reject">Elutasít (reject)</option>
              </select>
              <select
                value={f.skimmer}
                onChange={(e) => update(i, { skimmer: e.target.value as SpotFilter["skimmer"] })}
              >
                <option value="include">skimmer: mind</option>
                <option value="exclude">skimmer: nélkül</option>
                <option value="only">skimmer: csak</option>
              </select>
              <span className="grow" />
              <button className="danger" onClick={() => remove(i)}>
                Törlés
              </button>
            </div>

            <div className="field">
              <span>Sávok</span>
              <Chips
                options={ALL_BANDS}
                selected={f.bands}
                onToggle={(b) => update(i, { bands: toggleIn(f.bands, b) })}
              />
            </div>
            <div className="field">
              <span>Módok</span>
              <Chips
                options={ALL_MODES}
                selected={f.modes}
                onToggle={(m) => update(i, { modes: toggleIn(f.modes, m as Mode) })}
              />
            </div>
            <div className="field">
              <span>DX kontinens</span>
              <Chips
                options={ALL_CONTINENTS}
                selected={f.dx_continents}
                onToggle={(c) => update(i, { dx_continents: toggleIn(f.dx_continents, c) })}
              />
            </div>

            <div className="row">
              <CsvInput
                label="DX hívójel prefixek"
                value={f.dx_call_prefixes}
                placeholder="HA, OM, 9A"
                onChange={(v) => update(i, { dx_call_prefixes: v })}
              />
              <CsvInput
                label="Spotter hívójel prefixek"
                value={f.spotter_call_prefixes}
                placeholder="W, VE"
                onChange={(v) => update(i, { spotter_call_prefixes: v })}
              />
            </div>
            <div className="row">
              <CsvInput
                label="DX DXCC (primary prefix)"
                value={f.dx_dxcc}
                placeholder="HA, DL"
                onChange={(v) => update(i, { dx_dxcc: v })}
              />
              <CsvInput
                label="DX CQ zónák"
                value={f.dx_cq_zones.map(String)}
                placeholder="14, 15"
                onChange={(v) =>
                  update(i, { dx_cq_zones: v.map(Number).filter((n) => Number.isFinite(n)) })
                }
              />
            </div>

            <div className="preview-row">
              <code className="preview">
                {previews[i] ?? "(nincs node-oldali parancs — csak helyi szűrés)"}
              </code>
              <button
                disabled={!onlineId || !previews[i]}
                onClick={() => applyToNode(f)}
                title={onlineId ? "" : "nincs élő kapcsolat"}
              >
                Alkalmaz a node-on
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
