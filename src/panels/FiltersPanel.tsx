import { memo, useEffect, useState } from "react";
import { useCluster, useOnlineId } from "@/store/useCluster";
import { useShallow } from "zustand/react/shallow";
import { saveFilters } from "@/lib/persist";
import { Chips, CsvInput } from "@/components/fields";
import { describeFilter } from "@/lib/filterDesc";
import { toggleIn } from "@/lib/util";
import { useT } from "@/i18n";
import * as ipc from "@/lib/ipc";
import {
  ALL_BANDS,
  ALL_CONTINENTS,
  ALL_MODES,
  emptyFilter,
  type Mode,
  type SpotFilter,
} from "@/lib/types";

const NODE_FILTER_RE = /^\s*(filter\d+|\d+)\s+(accept|reject)\s+(.+?)\s*$/i;
const UNKNOWN_CMD_RE = /^(unknown command|sorry)/i;

export const FiltersPanel = memo(function FiltersPanel() {
  const tr = useT();
  const { filters, setFilters } = useCluster(
    useShallow((s) => ({
      filters: s.filters,
      setFilters: s.setFilters,
    })),
  );
  // Node-side filters only make sense on a real cluster node that takes
  // commands — the RBN feed is command-less. Which node that is (when more
  // than one is online) is picked once, in the topbar connection picker, and
  // shared by every send-panel.
  const onlineId = useOnlineId();
  // Which dialect to build node commands in — the target node's own setting,
  // defaulting to DXSpider syntax when there's no target yet.
  const targetSoftware = useCluster((s) =>
    onlineId ? (s.connections[onlineId]?.profile.software ?? "dx_spider") : "dx_spider",
  );
  const [previews, setPreviews] = useState<Record<number, string | null>>({});
  const [nodeFilters, setNodeFilters] = useState<string[] | null>(null);
  const [fetching, setFetching] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState("");
  // Accordion: at most one card open at a time (null = all collapsed).
  const [expanded, setExpanded] = useState<string | null>(null);
  const fid = (f: SpotFilter, i: number) => f.id ?? `f${i}`;
  const toggleExpand = (id: string) => setExpanded((cur) => (cur === id ? null : id));

  async function fetchNodeFilters() {
    if (!onlineId) return;
    setFetching(true);
    try {
      if (targetSoftware === "ar_cluster") {
        // AR-Cluster has no per-line accept/reject listing like DXSpider's
        // `sh/filter`. `show/dx options` (verified on AR-Cluster V6 6.1.5123)
        // prints a small block among the live spot stream:
        //   DX configuration options:
        //      Count: 20
        //      Filter: not skimmer or skimvalid
        //      Mode: FILTER
        //      Output: ON
        //      Comment Options:
        // Keep the header + its indented continuation lines, drop the
        // interleaved `DX de …` spots.
        const raw = await ipc.runQuery(onlineId, "show/dx options");
        const out: string[] = [];
        let inBlock = false;
        for (const l of raw) {
          if (/^\s*DX configuration options\s*:/i.test(l)) {
            inBlock = true;
            out.push(l.trim());
          } else if (inBlock && /^\s+\S/.test(l) && !/^\s*DX de /i.test(l)) {
            out.push(l.trim());
          } else if (inBlock && l.trim() !== "") {
            inBlock = false;
          }
        }
        setNodeFilters(out.length ? out : raw);
      } else {
        const lines = await ipc.runQuery(onlineId, "sh/filter");
        const parsed = lines
          .map((l) => l.match(NODE_FILTER_RE))
          .filter((m): m is RegExpMatchArray => m !== null)
          .map((m) => `${m[2].toLowerCase()} ${m[3]}`);
        setNodeFilters(parsed);
      }
    } finally {
      setFetching(false);
    }
  }

  async function clearNodeFilters() {
    if (!onlineId) return;
    setClearing(true);
    setClearMsg("");
    try {
      // DXSpider: `clear/spot all` drops every accept/reject slot. AR-Cluster
      // has only the one filter, and an empty `set/dx/filter` clears it.
      const clearCmd = targetSoftware === "ar_cluster" ? "set/dx/filter" : "clear/spot all";
      const lines = await ipc.runQuery(onlineId, clearCmd, 6000);
      setClearMsg(
        lines.some((l) => UNKNOWN_CMD_RE.test(l.trim()))
          ? tr("filters.clearUnsupported")
          : tr("filters.cleared"),
      );
      await fetchNodeFilters();
    } finally {
      setClearing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      filters.map((f) =>
        f.pushToNode ? ipc.applySpotFilter("", f, false, targetSoftware).catch(() => null) : null,
      ),
    ).then((cmds) => {
      if (cancelled) return;
      const map: Record<number, string | null> = {};
      cmds.forEach((c, i) => (map[i] = c));
      setPreviews(map);
    });
    return () => {
      cancelled = true;
    };
  }, [filters, targetSoftware]);

  function update(i: number, patch: Partial<SpotFilter>) {
    const next = filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f));
    setFilters(next);
    saveFilters(next);
  }
  function add() {
    const rule = emptyFilter();
    const next = [...filters, rule];
    setFilters(next);
    saveFilters(next);
    setExpanded(rule.id!);
  }
  function remove(i: number) {
    const next = filters.filter((_, idx) => idx !== i);
    setFilters(next);
    saveFilters(next);
  }

  async function applyToNode(f: SpotFilter) {
    if (!onlineId) return;
    await ipc.applySpotFilter(onlineId, f, true, targetSoftware);
  }

  return (
    <div className="panel filters-panel">
      <div className="panel-head">
        <h2>{tr("filters.title")}</h2>
        <button className="primary" onClick={add}>
          {tr("filters.addRule")}
        </button>
      </div>
      <p className="muted">
        {tr("filters.intro")} {tr("filters.nodeIntro")}
      </p>

      <div className="preview-row">
        <span className="muted">
          {tr("filters.targetNode")} {onlineId ?? tr("common.noLiveConnection")}
        </span>
        <button disabled={!onlineId || fetching} onClick={fetchNodeFilters}>
          {fetching ? tr("filters.fetching") : tr("filters.fetchNode")}
        </button>
        <button
          className="danger"
          disabled={!onlineId || clearing}
          onClick={clearNodeFilters}
          title={tr("filters.clearNodeHint")}
        >
          {clearing ? tr("filters.clearing") : tr("filters.clearNode")}
        </button>
        {clearMsg && <span className="muted">{clearMsg}</span>}
        {nodeFilters !== null && (
          <code className="preview">
            {nodeFilters.length ? nodeFilters.join("  |  ") : tr("filters.noNodeFilter")}
          </code>
        )}
      </div>

      {filters.length === 0 && <p className="muted">{tr("filters.none")}</p>}

      <ul className="rule-list">
        {filters.map((f, i) => {
          const id = fid(f, i);
          const open = expanded === id;
          const enabled = f.enabled !== false;
          return (
            <li key={id} className={`rule-card${enabled ? "" : " is-disabled"}`}>
              <div
                className="rule-head"
                onClick={() => toggleExpand(id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleExpand(id)}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  title={tr("alerts.active")}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => update(i, { enabled: e.target.checked })}
                />
                <span className="disclosure">{open ? "▾" : "▸"}</span>
                <span className="rule-name">{f.label || tr("filters.unnamed")}</span>
                <span className="rule-summary">{describeFilter(f)}</span>
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
                        value={f.label ?? ""}
                        placeholder={tr("filters.ruleNamePlaceholder")}
                        onChange={(e) => update(i, { label: e.target.value })}
                      />
                    </label>
                    <select
                      value={f.action}
                      onChange={(e) => update(i, { action: e.target.value as "accept" | "reject" })}
                    >
                      <option value="accept">{tr("filters.accept")} (accept)</option>
                      <option value="reject">{tr("filters.reject")} (reject)</option>
                    </select>
                    <select
                      value={f.skimmer}
                      onChange={(e) =>
                        update(i, { skimmer: e.target.value as SpotFilter["skimmer"] })
                      }
                    >
                      <option value="include">{tr("filters.skimmerAll")}</option>
                      <option value="exclude">{tr("filters.skimmerNone")}</option>
                      <option value="only">{tr("filters.skimmerOnly")}</option>
                    </select>
                    <select
                      value={f.pushToNode ? "node" : "local"}
                      title={tr("filters.scopeHint")}
                      onChange={(e) => update(i, { pushToNode: e.target.value === "node" })}
                    >
                      <option value="local">{tr("filters.scopeLocal")}</option>
                      <option value="node">{tr("filters.scopeNode")}</option>
                    </select>
                  </div>

                  <div className="field">
                    <span>{tr("filters.bands")}</span>
                    <Chips
                      options={ALL_BANDS}
                      selected={f.bands}
                      onToggle={(b) => update(i, { bands: toggleIn(f.bands, b) })}
                    />
                  </div>
                  <div className="field">
                    <span>{tr("filters.modes")}</span>
                    <Chips
                      options={ALL_MODES}
                      selected={f.modes}
                      onToggle={(m) => update(i, { modes: toggleIn(f.modes, m as Mode) })}
                    />
                  </div>
                  <div className="field">
                    <span>{tr("filters.dxContinent")}</span>
                    <Chips
                      options={ALL_CONTINENTS}
                      selected={f.dx_continents}
                      onToggle={(c) => update(i, { dx_continents: toggleIn(f.dx_continents, c) })}
                    />
                  </div>
                  <div className="field">
                    <span>{tr("filters.spotterContinent")}</span>
                    <Chips
                      options={ALL_CONTINENTS}
                      selected={f.spotter_continents ?? []}
                      onToggle={(c) =>
                        update(i, { spotter_continents: toggleIn(f.spotter_continents ?? [], c) })
                      }
                    />
                  </div>

                  <div className="row">
                    <CsvInput
                      label={tr("filters.dxCallPrefixes")}
                      value={f.dx_call_prefixes}
                      placeholder="HA, OM, 9A"
                      onChange={(v) => update(i, { dx_call_prefixes: v })}
                    />
                    <CsvInput
                      label={tr("filters.spotterCallPrefixes")}
                      value={f.spotter_call_prefixes}
                      placeholder="W, VE"
                      onChange={(v) => update(i, { spotter_call_prefixes: v })}
                    />
                  </div>
                  <div className="row">
                    <CsvInput
                      label={tr("filters.dxDxcc")}
                      value={f.dx_dxcc}
                      placeholder="HA, DL"
                      onChange={(v) => update(i, { dx_dxcc: v })}
                    />
                    <CsvInput
                      label={tr("filters.spotterDxcc")}
                      value={f.spotter_dxcc}
                      placeholder="W, VE"
                      onChange={(v) => update(i, { spotter_dxcc: v })}
                    />
                  </div>
                  <div className="row">
                    <CsvInput
                      label={tr("filters.dxCqZones")}
                      value={f.dx_cq_zones.map(String)}
                      placeholder="14, 15"
                      onChange={(v) =>
                        update(i, { dx_cq_zones: v.map(Number).filter((n) => Number.isFinite(n)) })
                      }
                    />
                    <CsvInput
                      label={tr("filters.spotterCqZones")}
                      value={f.spotter_cq_zones.map(String)}
                      placeholder="14, 15"
                      onChange={(v) =>
                        update(i, {
                          spotter_cq_zones: v.map(Number).filter((n) => Number.isFinite(n)),
                        })
                      }
                    />
                  </div>

                  {f.pushToNode ? (
                    <div className="preview-row">
                      <code className="preview">{previews[i] ?? tr("filters.noNodeCmd")}</code>
                      <button
                        disabled={!onlineId || !previews[i]}
                        onClick={() => applyToNode(f)}
                        title={onlineId ? "" : tr("common.noLiveConnection")}
                      >
                        {tr("filters.applyToNode")}
                      </button>
                    </div>
                  ) : (
                    <p className="muted filter-local-note">{tr("filters.localOnlyNote")}</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
});
