import { drawBallIcon } from '../../render/ball-icon.ts';
import { RULESET_VERSION } from '../../sim/ruleset.ts';
import { recordPick, startSeries, type Lineup } from '../../sim/series.ts';
import type { DefinitionLookup } from '../../sim/types.ts';
import { element } from '../dom.ts';
import { createScreenHeader } from '../screen-header.ts';
import { createPickRows } from './pick-rows.ts';
import { createSeriesTrack } from './series-track.ts';
import { pickChoiceOf, trackOf } from './series-view.ts';

export interface AnswerStep {
  readonly element: HTMLElement;
  /** Shows the series as it starts, the bot's round-1 ball shown, and focuses the heading. */
  open(own: Lineup, bot: Lineup, shown: string): void;
}

export interface AnswerActions {
  /** Back to the lineup, to change the balls. */
  readonly onBack: () => void;
  /** The player's answer for round 1. */
  readonly onAnswer: (ball: string) => void;
}

/**
 * Reveal, round 1 (ADR 0021), phone first and visual (ADR 0025): the track with the bot's shown
 * ball in round 1 and its other two waiting under round 2, then "Your pick: answer" and one row per
 * ball the player has, each marked against the shown ball. A tap answers and the round starts.
 */
export function createAnswerStep(lookup: DefinitionLookup, actions: AnswerActions): AnswerStep {
  const root = element('section', 'series-step answer-step');
  const header = createScreenHeader('Round 1', 'Change lineup', actions.onBack, { legend: true });
  const track = createSeriesTrack(lookup);
  const banner = element('p', 'series-banner');
  banner.setAttribute('aria-hidden', 'true');
  const face = element('canvas', 'series-banner-icon');
  const status = element('p', 'visually-hidden');
  status.setAttribute('aria-live', 'polite');
  const rows = createPickRows(lookup, actions.onAnswer);
  root.append(header.element, status, track.element, banner, rows.element);

  return {
    element: root,
    open(own, bot, shown) {
      // The series as the player sees it now: the bot has shown its round-1 ball (display only;
      // the series itself starts once the player answers).
      const state = recordPick(
        startSeries({
          ruleset: RULESET_VERSION,
          seed: 0,
          a: own,
          b: bot,
          opponent: { kind: 'player' },
          format: 'reveal',
        }),
        shown,
      );
      track.update(state, trackOf(state, undefined));
      const ball = lookup.get(shown);
      if (ball !== undefined) drawBallIcon(face, ball, 20);
      banner.replaceChildren('Your pick: answer ', face);
      const name = ball?.name ?? shown;
      status.textContent = `The bot shows its ${name} first, for round 1. Pick your answer.`;
      const choice = pickChoiceOf(state);
      if (choice !== undefined) rows.show(choice);
      header.focus();
    },
  };
}
