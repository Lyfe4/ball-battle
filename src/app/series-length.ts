// The series length a player last chose (ADR 0048), remembered on their device like the bot level
// (bot-level.ts). A new series is Best of 5 unless the player chose otherwise (ADR 0090 addendum):
// nothing chosen, or storage missing or throwing (private windows, blocked site data), means Best
// of 5. A choice once made is kept. A link's length is its own (no length is Best of 3,
// `DEFAULT_BEST_OF`, as every link before ADR 0048), never this.
import { asBestOf, type BestOf } from '../sim/series.ts';

/** A new series' length unless the player chose another (ADR 0090 addendum; ADR 0048 amended). */
export const NEW_SERIES_BEST_OF: BestOf = 5;

/** The browser storage key the choice is remembered under. */
export const SERIES_LENGTH_STORAGE_KEY = 'ballbattle.seriesLength';

/** The length `raw` names ("3" or "5"), else a new series' length (Best of 5). */
export function parseSeriesLength(raw: string | null | undefined): BestOf {
  return asBestOf(Number(raw?.trim())) ?? NEW_SERIES_BEST_OF;
}

/** The remembered length. Takes a getter because merely reading `localStorage` can throw. */
export function loadSeriesLength(storage: () => Pick<Storage, 'getItem'>): BestOf {
  try {
    return parseSeriesLength(storage().getItem(SERIES_LENGTH_STORAGE_KEY));
  } catch {
    return NEW_SERIES_BEST_OF;
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
