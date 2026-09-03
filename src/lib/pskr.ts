/**
 * Effective PSK Reporter watch callsigns: the user's explicit list when given
 * (comma / whitespace separated), otherwise every connection profile's
 * callsign. Matching on PSK Reporter is exact, so portable / contest calls are
 * kept verbatim (e.g. `HA5XYZ/P` is not folded to `HA5XYZ`).
 */
export function resolvePskrCalls(explicitText: string, profileCalls: string[]): string[] {
  const explicit = explicitText
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const source = explicit.length ? explicit : profileCalls;
  return [...new Set(source.map((c) => c.toUpperCase()))].filter(Boolean);
}
