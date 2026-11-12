// The series length a player last chose on Other modes (ADR 0048), remembered on their device like
// the bot level (bot-level.ts). Storage can be missing or throw (private windows, blocked site
// data), and that only ever means Best of 3. Home's Play never reads it: it is always Best of 3.
import { asBestOf, DEFAULT_BEST_OF, type BestOf } from '../sim/series.ts';

/** The browser storage key the choice is remembered under. */
export const SERIES_LENGTH_STORAGE_KEY = 'ballbattle.seriesLength';

/** The length `raw` names ("3" or "5"), else Best of 3. */
export function parseSeriesLength(raw: string | null | undefined): BestOf {
  return asBestOf(Number(raw?.trim())) ?? DEFAULT_BEST_OF;
}

/** The remembered length. Takes a getter because merely reading `localStorage` can throw. */
export function loadSeriesLength(storage: () => Pick<Storage, 'getItem'>): BestOf {
  try {
    return parseSeriesLength(storage().getItem(SERIES_LENGTH_STORAGE_KEY));
  } catch {
    return DEFAULT_BEST_OF;
  }
}

/** Remembers the length, if storage allows; failing to is not an error. */
export function saveSeriesLength(storage: () => Pick<Storage, 'setItem'>, bestOf: BestOf): void {
  try {
    storage().setItem(SERIES_LENGTH_STORAGE_KEY, String(bestOf));
  } catch {
    // Not remembered this time; the choice still holds for this visit.
  }
}
