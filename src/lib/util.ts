import { useRef } from "react";

/** Toggle a value's membership in an array (returns a new array). */
export function toggleIn<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
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
