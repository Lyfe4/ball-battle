// The guided first series (ADR 0090): a brand-new device's first series is Best of 3 · Reveal
// against the Easy bot, with home and the lineup showing less until it is over. Remembered on the
// device beside the tips (tips.ts), in its style: storage can be missing or throw, and then the
// device counts as done, so nobody is ever held in the guided state.
//
// With no key of its own, a device is new unless it has played before (a key only real play
// writes, PLAYED_KEYS), so an existing player never sees it (D6). Reading writes nothing: a first
// page load (or the reload after Log out, which leaves nothing of the player) stays empty. The
// guided state is written when the first series starts (`begin`), before any key it writes itself
// (its saved series, its tips) could end it early. Three states: 'guided' (the first series is ahead),
// 'graduated' (it was played here and is over: the new ways to play wear "New" until tried) and
// 'done' (skipped, or a device that played before: everything, nothing marked new).
import type { Format } from '../sim/series.ts';

export const FIRST_SERIES_STORAGE_KEY = 'ballbattle.firstSeries';
/** The formats a graduated device has chosen in What to play: their "New" tag is gone. */
export const FORMATS_CHOSEN_STORAGE_KEY = 'ballbattle.formatsChosen';
/** The formats whose one-time "How it goes" box has shown at the start of a series. */
export const FORMATS_TAUGHT_STORAGE_KEY = 'ballbattle.formatsTaught';

/**
 * Keys only a player's own play writes: a format or an opponent chosen, an ability hint or a what
 * to watch card seen (in a fight, never the home demo), a series saved, ADR 0036's old count of
 * cards seen. Never a key a first page load writes (sound, speed, the stage's first paint, the
 * slow-frames line) or a remembered setting alone. Named here, not imported: this module loads
 * before anything else decides the build (modes.ts reads it); first-series.test.ts pins each name
 * to its owner's constant.
 */
export const PLAYED_KEYS: readonly string[] = [
  'ballbattle.playFormat',
  'ballbattle.playOpponent',
  'ballbattle.hintsSeen',
  'ballbattle.readySeen',
  'ballbattle.series',
  'ballbattle.versusSeen',
];

/** The formats taught by a box and tagged "New": Reveal is taught by the first series itself. */
const LATER_FORMATS: readonly Format[] = ['showdown', 'blind'];

type State = 'guided' | 'graduated' | 'done';

export type FirstSeriesStorage = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface FirstSeries {
  /** False while the guided first series is ahead (or under way); true for everyone else. */
  done(): boolean;
  /** The guided first series starts (Play): remembered, so the keys it writes can't end it. */
  begin(): void;
  /** The first series is over, finished or left: everything shows, the new formats marked new. */
  finish(): void;
  /** Skip: show me everything. Everything shows, nothing marked new. */
  skip(): void;
  /** "Show all tips again": the next visit is a first one again. */
  reset(): void;
  /** What to play tags `format` "New": graduated here, and not chosen since. */
  isNew(format: Format): boolean;
  /** `format` was chosen in What to play: no longer new. */
  chose(format: Format): void;
  /** True the first time a graduated device starts a series in `format`: its "How it goes" box. */
  takeFormatBox(format: Format): boolean;
}

function read(storage: FirstSeriesStorage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(storage: FirstSeriesStorage, key: string, value: string | undefined): void {
  try {
    if (value === undefined) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    // Not remembered: this page load keeps its answer in memory.
  }
}

const setOf = (value: string | null) => new Set((value ?? '').split(',').filter((x) => x !== ''));

/** The device's state, decided and written on its first read. Storage that throws is done. */
function decide(storage: FirstSeriesStorage): State {
  try {
    const stored = storage().getItem(FIRST_SERIES_STORAGE_KEY);
    if (stored === 'guided' || stored === 'graduated' || stored === 'done') return stored;
    return PLAYED_KEYS.some((key) => storage().getItem(key) !== null) ? 'done' : 'guided';
  } catch {
    return 'done';
  }
}

/**
 * The device's first-series state, read on first use, not when made: the page asks when home first
 * shows.
 */
export function createFirstSeries(storage: FirstSeriesStorage): FirstSeries {
  // Kept in memory too, so a page load stays consistent when a write fails.
  let known: State | undefined;
  const state = (): State => (known ??= decide(storage));
  const chosen = setOf(read(storage, FORMATS_CHOSEN_STORAGE_KEY));
  const taught = setOf(read(storage, FORMATS_TAUGHT_STORAGE_KEY));
  const later = (format: Format) => state() === 'graduated' && LATER_FORMATS.includes(format);
  const become = (next: State) => {
    known = next;
    write(storage, FIRST_SERIES_STORAGE_KEY, next);
  };
  return {
    done: () => state() !== 'guided',
    begin() {
      if (state() === 'guided') become('guided');
    },
    finish() {
      if (state() === 'guided') become('graduated');
    },
    skip() {
      if (state() === 'guided') become('done');
    },
    reset() {
      become('guided');
      chosen.clear();
      taught.clear();
      write(storage, FORMATS_CHOSEN_STORAGE_KEY, undefined);
      write(storage, FORMATS_TAUGHT_STORAGE_KEY, undefined);
    },
    isNew: (format) => later(format) && !chosen.has(format),
    chose(format) {
      if (!later(format) || chosen.has(format)) return;
      chosen.add(format);
      write(storage, FORMATS_CHOSEN_STORAGE_KEY, [...chosen].join(','));
    },
    takeFormatBox(format) {
      if (!later(format) || taught.has(format)) return false;
      taught.add(format);
      write(storage, FORMATS_TAUGHT_STORAGE_KEY, [...taught].join(','));
      return true;
    },
  };
}
