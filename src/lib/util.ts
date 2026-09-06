import { useRef } from "react";

/** Toggle a value's membership in an array (returns a new array). */
export function toggleIn<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

/** Space-separated include/exclude terms: `foo` must appear, `-foo` must not.
 *  Shared by the Announcements search box and the WWV/WCY history filter. */
export function matchTerms(hay: string, query: string): boolean {
  const h = hay.toUpperCase();
  for (const t of query.trim().toUpperCase().split(/\s+/).filter(Boolean)) {
    if (t.startsWith("-")) {
      if (t.length > 1 && h.includes(t.slice(1))) return false;
    } else if (!h.includes(t)) {
      return false;
    }
  }
  return true;
}

/** Does the string contain any non-ASCII character? DX cluster mail / talk is
 *  historically a 7-bit ASCII (Latin-1 at best) medium — many nodes strip or
 *  mangle the rest. */
export const hasNonAscii = (s: string): boolean =>
  // eslint-disable-next-line no-control-regex
  /[^\x00-\x7f]/.test(s);

/** Best-effort transliteration to plain ASCII: strip diacritics (á→a, ő→o,
 *  ű→u, ü→u …), fold smart quotes / dashes, and replace anything left with
 *  `?`. Lossy but guaranteed to survive an ASCII-only node. */
export function toAsciiText(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // combining diacritical marks
      .replace(/[‘’‚‛]/g, "'")
      .replace(/[“”„‟]/g, '"')
      .replace(/[–—−]/g, "-")
      .replace(/…/g, "...")
      .replace(/ß/g, "ss")
      .replace(/æ/g, "ae")
      .replace(/ø/g, "o")
      .replace(/ł/g, "l")
      // eslint-disable-next-line no-control-regex
      .replace(/[^\x00-\x7f]+/gu, "?")
  );
}

/**
 * While `active`, passes `value` straight through (and remembers it). While
 * inactive, keeps returning the last value seen while active — so a prop fed
 * into an expensive child (an SVG map, a virtualized table) stops changing
 * reference the moment its tab is hidden, and a `memo`-wrapped child can bail
 * out of re-rendering entirely instead of redoing its layout in the
 * background. Catches up to the live value immediately once `active` again.
 */
export function useFrozenWhenInactive<T>(value: T, active: boolean): T {
  const frozen = useRef(value);
  if (active) frozen.current = value;
  return active ? value : frozen.current;
}
