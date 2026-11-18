// The live match this device last saw end (ADR 0055, playtest 2026-11-19): remembered for as long
// as a rematch of it can still be asked and answered, so a request reaches the player wherever they
// are in the game, and still does if they close the tab and come back in time. Kept on the device
// only (`ballbattle.*`, cleared by Forget me); the server decides everything about the rematch.
import { REMATCH_ANSWER_MS, REMATCH_OFFER_MS } from '../api/rematch.ts';
import type { BestOf, Format, Side } from '../sim/series.ts';
import type { DeviceStorage } from './online-device.ts';

const KEY = 'ballbattle.online.rematch';

/**
 * How long after the end this device keeps asking: the offer (2 minutes) and an answer (30 s), a
 * little more for clocks and slow reads. Only an upper bound: the server's answer ends it sooner.
 */
export const WATCH_MS = REMATCH_OFFER_MS + REMATCH_ANSWER_MS + 10_000;

export interface RematchWatch {
  /** The live series that ended. */
  readonly id: string;
  readonly you: Side;
  /** The other player, as the end screen names them ("Player 4821"). */
  readonly they: string;
  readonly format: Format;
  readonly bestOf: BestOf;
  /** Until when, by this device's clock (ms since the epoch). */
  readonly until: number;
}

function safely<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

export function rememberRematchWatch(storage: DeviceStorage, watch: RematchWatch): void {
  safely(() => {
    storage().setItem(KEY, JSON.stringify(watch));
  }, undefined);
}

/** Forgets the watch of series `id` (another series' is kept). */
export function forgetRematchWatch(storage: DeviceStorage, id: string): void {
  safely(() => {
    if (rematchWatchOf(storage, -Infinity)?.id === id) storage().removeItem(KEY);
  }, undefined);
}

/** The remembered watch at device time `now`, if it is still on. Never throws. */
export function rematchWatchOf(storage: DeviceStorage, now: number): RematchWatch | undefined {
  const raw = safely<unknown>(() => JSON.parse(storage().getItem(KEY) ?? 'null'), null);
  if (typeof raw !== 'object' || raw === null) return undefined;
  const fields = raw as Record<string, unknown>;
  const { id, you, they, format, bestOf, until } = fields;
  if (
    typeof id !== 'string' ||
    (you !== 'a' && you !== 'b') ||
    typeof they !== 'string' ||
    (format !== 'blind' && format !== 'reveal' && format !== 'showdown') ||
    (bestOf !== 3 && bestOf !== 5) ||
    typeof until !== 'number' ||
    until <= now
  ) {
    return undefined;
  }
  return { id, you, they, format, bestOf, until };
}
