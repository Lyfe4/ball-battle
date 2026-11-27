// Less motion (ADR 0087 addendum of 2026-11-28): the device's setting (prefers-reduced-motion), or
// the game's own Reduce motion in settings, for a player who wants it here and not everywhere. One
// answer for the page: the stylesheets read `data-motion="reduce"` on the root beside the media
// query (every reduced-motion block has both), and scripts ask `reducedMotion()` in place of
// matchMedia. Remembered on the device in tips.ts's style: storage that throws means off.

export const REDUCE_MOTION_STORAGE_KEY = 'ballbattle.reduceMotion';
const QUERY = '(prefers-reduced-motion: reduce)';

type Storage = () => Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** What a script reads: whether to move less now, and a way to hear when that changes. */
export interface MotionQuery {
  readonly matches: boolean;
  addEventListener(type: 'change', listener: () => void): void;
}

let chosen: boolean | undefined;
const listeners = new Set<() => void>();
/** The device's query, made once: read every frame by the arena. */
let system: MediaQueryList | undefined;
const systemQuery = (): MediaQueryList | undefined =>
  typeof matchMedia === 'function' ? (system ??= matchMedia(QUERY)) : undefined;

function readChosen(storage: Storage): boolean {
  try {
    return storage().getItem(REDUCE_MOTION_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** The device asks for less motion, whatever the game's setting. */
export function systemReducesMotion(): boolean {
  return systemQuery()?.matches === true;
}

/** The game's own setting, as last chosen on this device. */
export function reduceMotionChosen(): boolean {
  chosen ??= readChosen(() => localStorage);
  return chosen;
}

/** Writes the root's attribute for the stylesheets. Call once at start, then on every change. */
export function applyMotion(root: HTMLElement = document.documentElement): void {
  if (reduceMotionChosen()) root.dataset['motion'] = 'reduce';
  else delete root.dataset['motion'];
}

/** Chooses the game's Reduce motion on this device (settings). */
export function setReduceMotion(on: boolean, storage: Storage = () => localStorage): void {
  chosen = on;
  try {
    if (on) storage().setItem(REDUCE_MOTION_STORAGE_KEY, '1');
    else storage().removeItem(REDUCE_MOTION_STORAGE_KEY);
  } catch {
    // Not remembered: this page keeps it in memory.
  }
  applyMotion();
  for (const listener of listeners) listener();
}

/** Move less: the device's setting or the game's. Read where a script chose by matchMedia. */
export function reducedMotion(): MotionQuery {
  return {
    get matches() {
      return reduceMotionChosen() || systemReducesMotion();
    },
    addEventListener(_type, listener) {
      listeners.add(listener);
      systemQuery()?.addEventListener('change', listener);
    },
  };
}
