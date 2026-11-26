// The fair-play check of an online series (ADR 0051): once every round has been watched, the
// series is played again here from its revealed seeds and must match what the server said. Once
// per series; `reset` when another series opens.
import type { SeriesView } from '../api/series.ts';
import { fairPlayOf, type FairPlay } from '../app/online-series.ts';
import type { DefinitionLookup } from '../sim/types.ts';

export interface FairCheck {
  /** The result so far: checking, fair or unfair; undefined before it starts. */
  readonly result: () => FairPlay | 'checking' | undefined;
  /** Starts the check once `watched` covers every round of a finished series. */
  check(view: SeriesView | undefined, watched: number): void;
  reset(): void;
}

/** `checked` is called when a result lands, to draw it. */
export function createFairCheck(lookup: DefinitionLookup, checked: () => void): FairCheck {
  let fair: FairPlay | 'checking' | undefined;
  return {
    result: () => fair,
    check(view, watched) {
      if (view === undefined || view.status === 'open' || watched !== view.rounds.length) return;
      if (fair !== undefined) return;
      const series = view;
      fair = 'checking';
      void fairPlayOf(series, lookup).then((result) => {
        fair = result;
        if (result === 'unfair') console.error(`Series ${series.id}: the fair-play check failed`);
        checked();
      });
    },
    reset() {
      fair = undefined;
    },
  };
}
