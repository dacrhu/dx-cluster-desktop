import type { EnrichedSpot, SpotFilter } from "./types";

// Client-side mirror of `SpotFilter::conditions_match` in
// crates/dxcluster-core/src/commands.rs — used for local filtering and the
// "quick filter" bar without touching node-side filters.

function upper(s: string) {
  return s.toUpperCase();
}

function startsWithAny(value: string, prefixes: string[]) {
  const v = upper(value);
  return prefixes.some((p) => v.startsWith(upper(p)));
}

function eqAny(value: string | undefined, options: string[]) {
  if (value === undefined) return false;
  const v = upper(value);
  return options.some((o) => upper(o) === v);
}

export function conditionsMatch(spot: EnrichedSpot, f: SpotFilter): boolean {
  if (f.skimmer === "exclude" && spot.is_skimmer) return false;
  if (f.skimmer === "only" && !spot.is_skimmer) return false;

  if (f.bands.length && !(spot.band && f.bands.includes(spot.band))) return false;
  if (f.modes.length && !f.modes.includes(spot.mode)) return false;

  if (f.dx_call_prefixes.length && !startsWithAny(spot.dx_call, f.dx_call_prefixes)) return false;
  if (f.spotter_call_prefixes.length && !startsWithAny(spot.spotter_base, f.spotter_call_prefixes))
    return false;

  if (f.dx_dxcc.length && !eqAny(spot.dx?.primary_prefix, f.dx_dxcc)) return false;
  if (f.spotter_dxcc.length && !eqAny(spot.by?.primary_prefix, f.spotter_dxcc)) return false;

  if (f.dx_cq_zones.length && !(spot.dx && f.dx_cq_zones.includes(spot.dx.cq_zone))) return false;
  if (f.spotter_cq_zones.length && !(spot.by && f.spotter_cq_zones.includes(spot.by.cq_zone)))
    return false;

  if (f.dx_continents.length && !eqAny(spot.dx?.continent, f.dx_continents)) return false;
  if (f.spotter_continents?.length && !eqAny(spot.by?.continent, f.spotter_continents))
    return false;

  return true;
}

/**
 * Standard cluster filter semantics: if any `accept` rule is present the spot
 * must match at least one; then any matching `reject` rule drops it.
 */
export function spotPasses(spot: EnrichedSpot, filters: SpotFilter[]): boolean {
  const active = filters.filter((f) => f.enabled !== false);
  const accepts = active.filter((f) => f.action === "accept");
  const rejects = active.filter((f) => f.action === "reject");

  if (accepts.length && !accepts.some((f) => conditionsMatch(spot, f))) return false;
  if (rejects.some((f) => conditionsMatch(spot, f))) return false;
  return true;
}
