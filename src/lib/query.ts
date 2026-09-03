import type { EnrichedSpot } from "./types";

/**
 * A small query language for filtering the spot table.
 *
 * - Space-separated terms are ANDed. `OR` (or `|`) between terms starts a new
 *   alternative group — a spot matches if any group matches.
 * - `field:value` scopes a term. Comma-separated values inside one term are ORed
 *   (`band:20m,40m`, `cq:14,15`).
 * - `-term` / `!term` negates.
 * - `"quoted phrase"` matches a phrase containing spaces.
 * - A bare word matches anywhere in call / spotter / comment / DXCC name.
 *
 * Fields: dx by dxcc bydxcc cq bycq itu cont bycont band mode grid
 *         comment|c  freq|f (supports `freq>14000`, `f<14100`, `freq:14000-14100`)
 *         age (minutes, e.g. `age<15`)   flag: skimmer
 */

export type SpotPredicate = (s: EnrichedSpot) => boolean;

interface Token {
  negated: boolean;
  raw: string;
}

const OR_SPLIT = /\s+(?:OR|\|)\s+/i;

/** Split on whitespace, but keep `"quoted phrases"` (incl. as field values) whole. */
function splitTokens(input: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (const ch of input) {
    if (ch === '"') {
      inQuote = !inQuote;
      continue; // quotes are structural, drop them
    }
    if (!inQuote && /\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function tokenize(input: string): Token[] {
  return splitTokens(input)
    .map((t) => {
      const negated = t.startsWith("-") || t.startsWith("!");
      return { negated, raw: negated ? t.slice(1) : t };
    })
    .filter((t) => t.raw !== "");
}

function upper(s: string | undefined | null): string {
  return (s ?? "").toUpperCase();
}

function haystack(s: EnrichedSpot): string {
  return upper(`${s.dx_call} ${s.spotter} ${s.comment} ${s.dx?.dxcc_name ?? ""}`);
}

/** Numeric comparison helper for `freq` / `age`. Returns null if `spec` isn't numeric. */
function numMatch(spec: string, value: number): boolean | null {
  const range = spec.match(/^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/);
  if (range) return value >= Number(range[1]) && value <= Number(range[2]);
  const cmp = spec.match(/^(>=|<=|>|<)?\s*(-?\d+(?:\.\d+)?)$/);
  if (!cmp) return null;
  const n = Number(cmp[2]);
  switch (cmp[1]) {
    case ">":
      return value > n;
    case "<":
      return value < n;
    case ">=":
      return value >= n;
    case "<=":
      return value <= n;
    default:
      return Math.abs(value - n) < 0.05;
  }
}

function anyOf(spec: string): string[] {
  return spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function termPredicate(token: Token): SpotPredicate {
  const { raw } = token;
  const colon = raw.indexOf(":");
  const cmpIdx = raw.search(/[<>]/);

  // field:value
  if (colon > 0 && (cmpIdx < 0 || colon < cmpIdx)) {
    const field = raw.slice(0, colon).toLowerCase();
    const value = raw.slice(colon + 1);
    return scoped(field, value);
  }
  // field>value / field<value (freq/age)
  if (cmpIdx > 0) {
    const field = raw.slice(0, cmpIdx).toLowerCase();
    return scoped(field, raw.slice(cmpIdx));
  }
  // bare flag
  if (raw.toLowerCase() === "skimmer") return (s) => s.is_skimmer;

  // bare word -> substring anywhere
  const needle = raw.toUpperCase();
  return (s) => haystack(s).includes(needle);
}

function scoped(field: string, value: string): SpotPredicate {
  const vals = anyOf(value);
  const U = vals.map((v) => v.toUpperCase());

  switch (field) {
    case "dx":
    case "call":
      return (s) => U.some((v) => upper(s.dx_call).startsWith(v));
    case "by":
    case "de":
    case "spotter":
      return (s) => U.some((v) => upper(s.spotter_base).startsWith(v));
    case "dxcc":
      return (s) =>
        U.some((v) => upper(s.dx?.dxcc_name).includes(v) || upper(s.dx?.primary_prefix) === v);
    case "bydxcc":
      return (s) =>
        U.some((v) => upper(s.by?.dxcc_name).includes(v) || upper(s.by?.primary_prefix) === v);
    case "cq":
      return (s) => s.dx != null && vals.some((v) => numMatch(v, s.dx!.cq_zone) === true);
    case "bycq":
      return (s) => s.by != null && vals.some((v) => numMatch(v, s.by!.cq_zone) === true);
    case "itu":
      return (s) => s.dx != null && vals.some((v) => numMatch(v, s.dx!.itu_zone) === true);
    case "cont":
    case "continent":
      return (s) => U.includes(upper(s.dx?.continent));
    case "bycont":
      return (s) => U.includes(upper(s.by?.continent));
    case "band":
      return (s) => U.includes(upper(s.band));
    case "mode":
      return (s) => U.includes(upper(s.mode));
    case "grid":
      return (s) => U.some((v) => upper(s.grid).startsWith(v));
    case "comment":
    case "c":
      return (s) => U.some((v) => upper(s.comment).includes(v));
    case "freq":
    case "f": {
      const preds = vals.map((v) => (s: EnrichedSpot) => numMatch(v, s.freq_khz) === true);
      return (s) => preds.some((p) => p(s));
    }
    case "age": {
      // minutes since received
      const preds = vals.map(
        (v) => (s: EnrichedSpot) => numMatch(v, (Date.now() / 1000 - s.received_at) / 60) === true,
      );
      return (s) => preds.some((p) => p(s));
    }
    default:
      // unknown field -> treat whole token as a bare substring
      return (s) => haystack(s).includes(`${field}:${value}`.toUpperCase());
  }
}

/**
 * Compile a query string into a predicate. An empty query matches everything.
 * Invalid fragments degrade to substring matches rather than throwing.
 */
export function compileQuery(query: string): SpotPredicate {
  const trimmed = query.trim();
  if (!trimmed) return () => true;

  const groups = trimmed.split(OR_SPLIT).map((group) => {
    const preds = tokenize(group).map((tok) => {
      const p = termPredicate(tok);
      return tok.negated ? (s: EnrichedSpot) => !p(s) : p;
    });
    return (s: EnrichedSpot) => preds.every((p) => p(s));
  });

  return (s) => groups.some((g) => g(s));
}
