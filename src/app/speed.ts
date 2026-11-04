// Playback speed: how much playback time a frame of real time is worth. Presentation only
// (ADR 0007): the frame driver turns playback time into whole ticks, so a faster speed changes
// when ticks run, never which ticks run. The intro, hit-stops, slow-mo and every effect run on the
// same scaled time, so the whole show speeds up together.

export const PLAYBACK_SPEEDS = [1, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

/** The browser storage key the viewer's choice is remembered under. */
export const SPEED_STORAGE_KEY = 'ballbattle.speed';

/** Reads a stored speed; anything unrecognised is normal speed. */
export function parseSpeed(raw: string | null | undefined): PlaybackSpeed {
  return PLAYBACK_SPEEDS.find((speed) => String(speed) === raw?.trim()) ?? 1;
}

/** Playback time for `realMs` of real time at `speed`. */
export function scaleFrame(realMs: number, speed: PlaybackSpeed): number {
  return realMs * speed;
}

/**
 * The viewer's remembered speed. Storage can be missing or throw (private windows, blocked site
 * data, sandboxed frames), and that only ever means normal speed. Takes a getter because merely
 * reading `localStorage` can throw.
 */
export function loadSpeed(storage: () => Pick<Storage, 'getItem'>): PlaybackSpeed {
  try {
    return parseSpeed(storage().getItem(SPEED_STORAGE_KEY));
  } catch {
    return 1;
  }
}

/** Remembers the viewer's speed, if storage allows; failing to is not an error. */
export function saveSpeed(storage: () => Pick<Storage, 'setItem'>, speed: PlaybackSpeed): void {
  try {
    storage().setItem(SPEED_STORAGE_KEY, String(speed));
  } catch {
    // Not remembered this time; the toggle still works for this visit.
  }
}
