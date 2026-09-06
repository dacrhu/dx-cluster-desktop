// Act on a spot: put the radio on it (CAT), and/or hand it to the logging
// program's entry window. Triggered only by the explicit "Tune radio" /
// "Prepare QSO" buttons in the spot fact card (Spots / Bandmap / Map).

/** Reusable helper: run the configured "raise the logger window" command. */
async function raiseLoggerIfWanted(): Promise<void> {
  const s = useCluster.getState();
  if (s.raiseLoggerEnabled && s.raiseLoggerTitle.trim()) {
    await ipc.raiseWindow(s.raiseLoggerTitle).catch((e) => console.warn("raiseWindow failed", e));
  }
}

import { useCluster } from "@/store/useCluster";
import * as ipc from "@/lib/ipc";
import { modeArg, modeLabel } from "@/lib/mode";
import { qsxFromComment } from "@/lib/split";
import type { EnrichedSpot, RigConfig } from "@/lib/types";

/** Build the RigConfig the Rust side expects from the current settings. */
export function rigConfigFromStore(): RigConfig {
  const s = useCluster.getState();
  const transport: RigConfig["transport"] =
    s.catTransport === "serial"
      ? {
          kind: "serial",
          model_id: s.catModelId,
          device: s.catDevice,
          baud: s.catBaud,
          // A private local port for our spawned rigctld (offset from the
          // default so it won't collide with a user's own daemon).
          port: 4599,
        }
      : { kind: "network", host: s.catHost, port: s.catPort };
  return { transport, poll: s.catPoll };
}

/** QSY the rig to this spot, simplex (no-op if CAT is off). If the rig was left
 *  in split by an earlier "Tune split", the Rust session drops split here. */
export async function tuneToSpot(spot: EnrichedSpot): Promise<void> {
  const s = useCluster.getState();
  if (!s.catEnabled) return;
  try {
    await ipc.rigSet(spot.freq_khz, modeArg(spot.mode, spot.freq_khz, s.catDigiMode));
  } catch (e) {
    console.warn("tuneToSpot failed", e);
  }
}

/** QSY the rig to this spot in split — RX on the spot, TX on the DX's QSX from
 *  the comment. Plain simplex tune when the comment carries no usable QSX.
 *  No-op if CAT is off. */
export async function tuneSplitToSpot(spot: EnrichedSpot): Promise<void> {
  const s = useCluster.getState();
  if (!s.catEnabled) return;
  const tx = qsxFromComment(spot.comment, spot.freq_khz);
  const mode = modeArg(spot.mode, spot.freq_khz, s.catDigiMode);
  try {
    if (tx == null) await ipc.rigSet(spot.freq_khz, mode);
    else await ipc.rigSetSplit(spot.freq_khz, tx, mode);
  } catch (e) {
    console.warn("tuneSplitToSpot failed", e);
  }
}

/** Push this spot to the logging program's entry window (no-op if off). */
export async function prepareQso(spot: EnrichedSpot): Promise<void> {
  const s = useCluster.getState();
  if (!s.logPushEnabled) return;
  const online = Object.values(s.connections).find((c) => c.state === "online");
  const myCall = online?.profile.callsign ?? null;
  try {
    await ipc.logPrepare(s.logHost, s.logPort, s.logFormat, {
      call: spot.dx_call,
      freqHz: spot.freq_khz * 1000,
      mode: modeLabel(spot.mode, spot.comment) || spot.mode,
      band: spot.band,
      grid: spot.grid,
      comment: spot.comment || null,
      myCall,
      myGrid: s.homeLocator || null,
    });
    await raiseLoggerIfWanted();
  } catch (e) {
    console.warn("prepareQso failed", e);
  }
}

/** Send a dummy hint to the logger (the Settings "Test push" button). */
export async function testLogPush(): Promise<void> {
  const s = useCluster.getState();
  const online = Object.values(s.connections).find((c) => c.state === "online");
  await ipc.logPrepare(s.logHost, s.logPort, s.logFormat, {
    call: "TE5T",
    freqHz: 14_074_000,
    mode: "SSB",
    band: "20m",
    myCall: online?.profile.callsign ?? null,
    myGrid: s.homeLocator || null,
  });
  await raiseLoggerIfWanted();
}
