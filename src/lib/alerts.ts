import { t } from "@/i18n";
import { compileQuery, type SpotPredicate } from "./query";
import type { EnrichedSpot, Mode } from "./types";

/** A watch-list rule: notify when an incoming spot matches every set condition. */
export interface AlertRule {
  id: string;
  label: string;
  enabled: boolean;
  /** DX callsign prefixes (start-of-string match). */
  calls: string[];
  /** DXCC primary prefixes (exact). */
  dxcc: string[];
  bands: string[];
  modes: Mode[];
  /** DX continents. */
  continents: string[];
  /** Also match on the spotter side instead of the DX side. */
  matchSpotter: boolean;
  /** Optional advanced query — the same mini-language as the Spots search box
   *  (`re:/MM$`, `age<15`, `dx:HA OR dx:OM`, …). ANDed with the fields above. */
  query?: string;
}

/** A spot that fired an alert — kept in a log so it isn't lost when the live
 *  table scrolls past (high traffic) or the operator steps away. */
export interface AlertHit {
  /** `${ruleId}:${spot.id}` — stable React key + dedup guard. */
  key: string;
  /** ms wall-clock time the alert fired. */
  at: number;
  ruleId: string;
  ruleLabel: string;
  spot: EnrichedSpot;
}

export function emptyAlert(): AlertRule {
  return {
    id: crypto.randomUUID(),
    label: "",
    enabled: true,
    calls: [],
    dxcc: [],
    bands: [],
    modes: [],
    continents: [],
    matchSpotter: false,
    query: "",
  };
}

function up(s: string | undefined | null) {
  return (s ?? "").toUpperCase();
}

/** `compileQuery` is not free; cache one compiled predicate per query string
 *  (there are only ever a handful of rules). */
const queryCache = new Map<string, SpotPredicate>();
function rulePredicate(q: string): SpotPredicate {
  let p = queryCache.get(q);
  if (!p) {
    p = compileQuery(q);
    queryCache.set(q, p);
  }
  return p;
}

/** Plain-language description of what a rule matches (conditions are ANDed). */
export function describeAlert(rule: AlertRule): string {
  const side = rule.matchSpotter ? t("alerts.desc.spotterSide") : t("alerts.desc.dxSide");
  const parts: string[] = [];
  if (rule.calls.length) parts.push(t("alerts.desc.call", { side, v: rule.calls.join(" / ") }));
  if (rule.dxcc.length) parts.push(t("alerts.desc.dxcc", { side, v: rule.dxcc.join(" / ") }));
  if (rule.continents.length)
    parts.push(t("alerts.desc.cont", { side, v: rule.continents.join(" / ") }));
  if (rule.bands.length) parts.push(t("alerts.desc.band", { v: rule.bands.join(" / ") }));
  if (rule.modes.length) parts.push(t("alerts.desc.mode", { v: rule.modes.join(" / ") }));
  if (rule.query?.trim()) parts.push(t("alerts.desc.query", { v: rule.query.trim() }));
  if (parts.length === 0) return t("alerts.desc.never");
  return parts.join(t("alerts.desc.and"));
}

/** The first enabled rule `spot` matches, or `null`. Used to tint live rows. */
export function matchingAlert(spot: EnrichedSpot, rules: AlertRule[]): AlertRule | null {
  for (const r of rules) if (alertMatches(spot, r)) return r;
  return null;
}

/** True if `spot` satisfies every non-empty condition of `rule`. */
export function alertMatches(spot: EnrichedSpot, rule: AlertRule): boolean {
  if (!rule.enabled) return false;
  const call = rule.matchSpotter ? spot.spotter_base : spot.dx_call;
  const info = rule.matchSpotter ? spot.by : spot.dx;

  const query = rule.query?.trim() ?? "";

  // A rule with no conditions never matches (avoids notifying on everything).
  const hasCond =
    rule.calls.length ||
    rule.dxcc.length ||
    rule.bands.length ||
    rule.modes.length ||
    rule.continents.length ||
    query.length;
  if (!hasCond) return false;

  if (rule.calls.length && !rule.calls.some((c) => up(call).startsWith(up(c)))) return false;
  if (rule.dxcc.length && !rule.dxcc.some((d) => up(d) === up(info?.primary_prefix))) return false;
  if (rule.bands.length && !(spot.band && rule.bands.includes(spot.band))) return false;
  if (rule.modes.length && !rule.modes.includes(spot.mode)) return false;
  if (rule.continents.length && !rule.continents.some((k) => up(k) === up(info?.continent)))
    return false;
  if (query && !rulePredicate(query)(spot)) return false;

  return true;
}
