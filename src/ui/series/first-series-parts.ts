// What the series screen adds for the guided first series (ADR 0090): round 2's line under the
// banner, saying what showing first means, and at the result, win or lose, the new ways to play.
// Read from the series' moment, never a timer; static text, read in place.
import { PLAY_CHOICES } from '../../app/modes.ts';
import { createCoach } from '../coach.ts';
import { FIRST_SERIES_GUIDE, newWays, SHOW_FIRST_STEPS } from '../first-series-text.ts';
import { createUnlockCard } from './unlock-card.ts';
import type { PickChoice } from './series-view.ts';

export interface FirstSeriesParts {
  /** Under the pick banner. */
  readonly coach: HTMLElement;
  /** The unlock card, under the result sticker (unlock-card.ts). */
  readonly newWays: HTMLElement;
  /** `guided`: this is the first series; `picking`: the pick shows now (not under a toss). */
  show(guided: boolean, choice: PickChoice | undefined, picking: boolean, finished: boolean): void;
}

export function createFirstSeriesParts(): FirstSeriesParts {
  const coach = createCoach('series-coach');
  const unlock = createUnlockCard();
  return {
    coach: coach.element,
    newWays: unlock.element,
    show(guided, choice, picking, finished) {
      const teaching = guided && picking && choice?.kind === 'show';
      coach.show(
        teaching ? { steps: SHOW_FIRST_STEPS, step: { at: 3, of: FIRST_SERIES_GUIDE } } : undefined,
      );
      unlock.show(guided && finished ? newWays(PLAY_CHOICES.includes('friend')) : undefined);
    },
  };
}
