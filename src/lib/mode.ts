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

/** How a digital-mode spot should switch the rig — a shack setting
 *  (`store.catDigiMode`), mirror of Rust `rigctl::DigiMode`. */
export type DigiMode = "none" | "usb" | "data";

/** The `rigctld` mode string to send when tuning to a spot, or `undefined` to
 *  leave the rig's mode alone. Mirror of Rust `rigctl::mode_for`. CW → CW,
 *  SSB → LSB/USB by band edge, FM → FM; the digital category follows `digi`. */
export function modeArg(m: Mode, freqKhz: number, digi: DigiMode): string | undefined {
  switch (m) {
    case "CW":
      return "CW";
    case "FM":
      return "FM";
    case "DIGI":
      return digi === "none" ? undefined : digi === "usb" ? "USB" : "PKTUSB";
    case "SSB":
    default:
      return freqKhz < 10_000 ? "LSB" : "USB";
  }
}
