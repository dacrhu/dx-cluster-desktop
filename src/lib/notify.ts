import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

let permission: boolean | null = null;

async function ensurePermission(): Promise<boolean> {
  if (permission !== null) return permission;
  try {
    permission = await isPermissionGranted();
    if (!permission) permission = (await requestPermission()) === "granted";
  } catch {
    permission = false;
  }
  return permission;
}

/** Ask the OS for notification permission up front (from the bootstrap) so the
 *  prompt, if any, isn't tied to the first alert firing. */
export function primeNotifications(): void {
  void ensurePermission();
}

export async function notify(title: string, body: string): Promise<void> {
  // The plugin's JS `sendNotification` is unreliable on Linux; send from Rust.
  try {
    await invoke("os_notify", { title, body });
    return;
  } catch {
    /* fall through to the JS plugin */
  }
  try {
    if (await ensurePermission()) sendNotification({ title, body });
  } catch {
    /* notifications unavailable */
  }
}

// --- alert chimes (synthesised, no bundled asset) --------------------------

export type AlertSound = "chime" | "morse" | "sweep";

/** Sound ids; labels come from i18n (`sound.<id>`). */
export const ALERT_SOUNDS: { id: AlertSound }[] = [
  { id: "chime" },
  { id: "morse" },
  { id: "sweep" },
];

/** Alert tones are transposed up this many equal-tempered semitones from their
 *  written base pitch (bump this to shift every sound at once). */
const PITCH_SHIFT_SEMITONES = 5;
const PITCH = 2 ** (PITCH_SHIFT_SEMITONES / 12);

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext {
  audioCtx ??= new AudioContext();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

/** Create / resume the AudioContext from a user gesture so later chimes play. */
export function primeAudio(): void {
  try {
    ctx();
  } catch {
    /* audio unavailable */
  }
}

function tone(
  ac: AudioContext,
  type: OscillatorType,
  freq: number | [number, number],
  start: number,
  len: number,
  peak = 0.35,
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  if (Array.isArray(freq)) {
    osc.frequency.setValueAtTime(freq[0] * PITCH, start);
    osc.frequency.exponentialRampToValueAtTime(freq[1] * PITCH, start + len);
  } else {
    osc.frequency.value = freq * PITCH;
  }
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + len);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + len + 0.03);
}

// Rising 3-note arpeggio, twice.
const CHIME: [number, number, number][] = [
  [660, 0.0, 0.11],
  [880, 0.11, 0.11],
  [1174, 0.22, 0.16],
  [660, 0.42, 0.09],
  [880, 0.52, 0.09],
  [1174, 0.62, 0.2],
];

// Morse "DX"  (-.. -..-)  dit = 70 ms.
const DIT = 0.07;

function playMorse(ac: AudioContext, t0: number) {
  const pattern = "-.. -..-"; // D X
  let at = 0;
  for (const ch of pattern) {
    if (ch === " ") {
      at += DIT * 2; // letter gap (already had a symbol gap)
      continue;
    }
    const len = ch === "-" ? DIT * 3 : DIT;
    tone(ac, "square", 700, t0 + at, len, 0.28);
    at += len + DIT; // symbol + intra-char gap
  }
}

/** Rough wall-clock length of each sound, in seconds, so overlapping alerts
 *  don't stack the same chime on top of itself. */
const SOUND_LEN: Record<AlertSound, number> = { chime: 0.9, morse: 1.6, sweep: 0.65 };

/** `AudioContext.currentTime` up to which a chime is already scheduled. */
let beepBusyUntil = 0;

export function beep(style: AlertSound = "chime"): void {
  try {
    const ac = ctx();
    // A burst of simultaneous alert hits should sound once, not N times.
    if (ac.currentTime < beepBusyUntil) return;
    const t0 = ac.currentTime + 0.03;
    beepBusyUntil = t0 + SOUND_LEN[style];
    if (style === "morse") {
      playMorse(ac, t0);
    } else if (style === "sweep") {
      tone(ac, "sawtooth", [420, 1800], t0, 0.22, 0.3);
      tone(ac, "sawtooth", [420, 1800], t0 + 0.3, 0.26, 0.3);
    } else {
      for (const [f, at, len] of CHIME) tone(ac, "triangle", f, t0 + at, len);
    }
  } catch {
    /* audio unavailable */
  }
}
