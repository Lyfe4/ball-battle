// What the series screen adds for the guided first series (ADR 0090): round 2's line under the
// banner, saying what showing first means, and at the result, win or lose, the new ways to play.
// Read from the series' moment, never a timer; static text, read in place.
import { PLAY_CHOICES } from '../../app/modes.ts';
import { element, setHidden } from '../dom.ts';
import { newWaysSteps, SHOW_FIRST_LINE } from '../first-series-text.ts';
import { createStepsPlace } from '../steps-box.ts';
import type { PickChoice } from './series-view.ts';

export interface FirstSeriesParts {
  /** Under the pick banner. */
  readonly coach: HTMLElement;
  /** After the result's buttons. */
  readonly newWays: HTMLElement;
  /** `guided`: this is the first series; `picking`: the pick shows now (not under a toss). */
  show(guided: boolean, choice: PickChoice | undefined, picking: boolean, finished: boolean): void;
}

export function createFirstSeriesParts(): FirstSeriesParts {
  const coach = element('p', 'series-coach', SHOW_FIRST_LINE);
  coach.hidden = true;
  const newWays = createStepsPlace('series-new');
  return {
    coach,
    newWays: newWays.element,
    show(guided, choice, picking, finished) {
      setHidden(coach, !guided || !picking || choice?.kind !== 'show');
      newWays.show(guided && finished ? newWaysSteps(PLAY_CHOICES.includes('friend')) : undefined);
    },
  };
}
