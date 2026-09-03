import type { Mode } from "./types";

/** CSS class for a spot's mode *category* (`mode-cw` … `mode-fm`), "" if unknown.
 *  Pair with `.mode-tag` for coloured text or `.mode-dot` for a coloured dot.
 *  All digital sub-modes share the `mode-digi` colour. */
export function modeClass(m: Mode): string {
  return m === "UNKNOWN" ? "" : `mode-${m.toLowerCase()}`;
}

// Specific digital sub-modes, longest/most-specific first so "PSK63" wins over
// "PSK". Matched as a substring of the (upper-cased) spot comment.
const DIGI_SUBMODES = [
  "FT8",
  "FT4",
  "FST4W",
  "FST4",
  "JT65",
  "JT9",
  "JT6M",
  "JS8",
  "Q65",
  "MSK144",
  "FSK441",
  "WSPR",
  "RTTY",
  "PSK63",
  "PSK31",
  "PSK125",
  "PSK",
  "OLIVIA",
  "CONTESTIA",
  "DOMINO",
  "MFSK",
  "SSTV",
  "THOR",
  "MT63",
  "HELL",
  "ROS",
  "PACKET",
  "PACTOR",
  "ARDOP",
  "VARA",
  "NAVTEX",
];

/** Human label for the mode: the real sub-mode from the comment when we have it
 *  (FT8, RTTY, SSTV …), otherwise the category (CW / SSB / DIGI / FM). */
export function modeLabel(m: Mode, comment: string): string {
  if (m === "UNKNOWN") return "";
  if (m === "DIGI") {
    const c = comment.toUpperCase();
    return DIGI_SUBMODES.find((t) => c.includes(t)) ?? "DIGI";
  }
  return m;
}
