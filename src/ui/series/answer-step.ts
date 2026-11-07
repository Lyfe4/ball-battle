import { formatOf, revealFirst, remainingOf, type SeriesState } from '../../sim/series.ts';
import type { DefinitionLookup } from '../../sim/types.ts';
import { element } from '../dom.ts';
import { createScreenHeader } from '../screen-header.ts';
import { pickLine } from '../series-text.ts';
import { createPickBanner } from './pick-banner.ts';
import { createPickRows } from './pick-rows.ts';
import { createSeriesBar } from './series-bar.ts';
import { createSeriesTrack } from './series-track.ts';
import { pickChoiceOf, trackOf } from './series-view.ts';

export interface AnswerStep {
  readonly element: HTMLElement;
  /**
   * Shows round 1 of a Reveal or Showdown series about to start: Reveal's coin toss, then the
   * player's pick (an answer to the bot's shown ball, the ball they show first, or Showdown's
   * opener). Focuses the heading.
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
 * Round 1 of Reveal (ADR 0021, 0029) or Showdown (ADR 0035), phone first and visual (ADR 0025):
 * under its heading the series bar every later pick shows (what is played, and the ?; ADR 0038),
 * Reveal's coin toss, the track (the bot's shown ball in round 1 when it won the toss, else its
 * three waiting), then "Your pick" and one row per ball the player has, each marked against every
 * ball the bot has. A tap picks and the round starts.
 */
export function createAnswerStep(lookup: DefinitionLookup, actions: AnswerActions): AnswerStep {
  const root = element('section', 'series-step answer-step');
  // The series bar under the heading holds this screen's gear and ? (ADR 0038, 0040).
  const header = createScreenHeader('Round 1', 'Change lineup', actions.onBack, {
    settings: false,
  });
  const bar = createSeriesBar();
  const track = createSeriesTrack(lookup);
  const banner = createPickBanner(lookup);
  const status = element('p', 'visually-hidden');
  status.setAttribute('aria-live', 'polite');
  const rows = createPickRows(lookup, actions.onAnswer);
  root.append(
    header.element,
    bar.element,
    bar.legend,
    status,
    track.element,
    banner.element,
    rows.element,
  );
  const nameOf = (id: string) => lookup.get(id)?.name ?? id;

  return {
    element: root,
    open(state) {
      bar.show(state.setup);
      // Reveal's coin toss leads the banner (ADR 0029, 0041).
      const reveal = formatOf(state.setup) === 'reveal';
      const toss = reveal
        ? { first: revealFirst(state.setup.seed), key: state.setup.seed }
        : undefined;
      track.update(state, trackOf(state, undefined));
      const choice = pickChoiceOf(state);
      if (choice !== undefined) {
        banner.show(choice, toss);
        rows.show(choice);
        status.textContent = pickLine(choice, 0, remainingOf(state, 'b'), nameOf, toss?.first);
      }
      header.focus();
    },
  };
}
