import { useLayoutEffect, useRef, useState } from "react";

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

/**
 * Keeps a popover that's CSS-anchored `right: 0` to a relatively-positioned
 * button (`QueryHelp`'s `.qh-pop`, `MapLayers`'s `.ml-pop`, …) from spilling
 * past the left edge of the window — that anchoring is fine while the button
 * sits well clear of the left edge, but once the window narrows enough the
 * popover's fixed width pushes its left side off-screen with no way to read
 * or scroll to it. Attach the returned `ref` to the popover element and
 * spread `style` onto it: after every paint (and on resize, since narrowing
 * the window is exactly the failure case) it measures the box's natural
 * position and nudges it right just far enough to clear the edge, capped so
 * that doesn't in turn push the right side off-screen.
 */
export function useClampPopover(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    if (!open) {
      setShift(0);
      return;
    }
    const margin = 8;
    const recalc = () => {
      const el = ref.current;
      if (!el) return;
      // Measure the untransformed position — a previous shift must not bias
      // the next measurement (e.g. the window growing back).
      const prevTransform = el.style.transform;
      el.style.transform = "none";
      const rect = el.getBoundingClientRect();
      el.style.transform = prevTransform;
      const overflowLeft = margin - rect.left;
      const shifted =
        overflowLeft > 0
          ? Math.min(overflowLeft, Math.max(0, window.innerWidth - margin - rect.right))
          : 0;
      setShift(shifted);
    };
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [open]);

  return { ref, style: shift ? { transform: `translateX(${shift}px)` } : undefined };
}
