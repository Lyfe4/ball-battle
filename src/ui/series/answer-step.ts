import { revealFirst, remainingOf, type SeriesState } from '../../sim/series.ts';
import type { DefinitionLookup } from '../../sim/types.ts';
import { element } from '../dom.ts';
import { createScreenHeader } from '../screen-header.ts';
import { revealAnswerLine, revealShowLine } from '../series-text.ts';
import { createPickBanner } from './pick-banner.ts';
import { createPickRows } from './pick-rows.ts';
import { createSeriesTrack } from './series-track.ts';
import { createTossStrip } from './toss-strip.ts';
import { pickChoiceOf, trackOf } from './series-view.ts';

export interface AnswerStep {
  readonly element: HTMLElement;
  /**
   * Shows round 1 of a Reveal series about to start: the coin toss, then the player's pick (an
   * answer to the bot's shown ball, or the ball they show first). Focuses the heading.
   */
  open(state: SeriesState): void;
}

export interface AnswerActions {
  /** Back to the lineup, to change the balls. */
  readonly onBack: () => void;
  /** The player's round-1 pick: their answer, or the ball they show first. */
  readonly onAnswer: (ball: string) => void;
}

/**
 * Reveal, round 1 (ADR 0021, 0029), phone first and visual (ADR 0025): the coin toss that decided
 * who shows first, the track (the bot's shown ball in round 1 when it won the toss, else its three
 * waiting), then "Your pick" and one row per ball the player has, each marked against what it
 * would face. A tap picks and the round starts.
 */
export function createAnswerStep(lookup: DefinitionLookup, actions: AnswerActions): AnswerStep {
  const root = element('section', 'series-step answer-step');
  const header = createScreenHeader('Round 1', 'Change lineup', actions.onBack, { legend: true });
  const toss = createTossStrip();
  const track = createSeriesTrack(lookup);
  const banner = createPickBanner(lookup);
  const status = element('p', 'visually-hidden');
  status.setAttribute('aria-live', 'polite');
  const rows = createPickRows(lookup, actions.onAnswer);
  root.append(header.element, toss.element, status, track.element, banner.element, rows.element);
  const nameOf = (id: string) => lookup.get(id)?.name ?? id;

  return {
    element: root,
    open(state) {
      toss.show(revealFirst(state.setup.seed), state.setup.seed);
      track.update(state, trackOf(state, undefined));
      const choice = pickChoiceOf(state);
      if (choice !== undefined) {
        banner.show(choice);
        rows.show(choice);
        const shown = choice.options[0]?.faces[0];
        status.textContent =
          choice.kind === 'answer' && shown !== undefined
            ? revealAnswerLine(0, shown, nameOf)
            : revealShowLine(0, remainingOf(state, 'b'), nameOf);
      }
      header.focus();
    },
  };
}
