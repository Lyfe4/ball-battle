import { offlineToss, type TossTimes } from '../../app/coin-toss.ts';
import { firstToShowOf, formatOf, remainingOf, type SeriesState } from '../../sim/series.ts';
import type { DefinitionLookup } from '../../sim/types.ts';
import { element } from '../dom.ts';
import { createScreenHeader } from '../screen-header.ts';
import { pickLine } from '../series-text.ts';
import { createCoinToss } from './coin-toss.ts';
import { createPickBanner } from './pick-banner.ts';
import { createPickRows } from './pick-rows.ts';
import { createSeriesBar } from './series-bar.ts';
import { createSeriesTrack } from './series-track.ts';
import { BOT_SEATS } from './seats.ts';
import { pickChoiceOf, trackOf } from './series-view.ts';

export interface AnswerStep {
  readonly element: HTMLElement;
  /**
   * Shows round 1 of a Reveal or Showdown series about to start: Reveal's coin toss (once per
   * series), then the player's pick (an answer to the bot's shown ball, the ball they show first,
   * or Showdown's opener). Focuses the heading.
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
 * Reveal's coin toss as its own moment (ADR 0061: the pick waits for it), the track (the bot's shown ball in round 1 when it won the toss, else its
 * three waiting), then "Your pick" and one row per ball the player has, each marked against every
 * ball the bot has. A tap picks and the round starts.
 */
export function createAnswerStep(lookup: DefinitionLookup, actions: AnswerActions): AnswerStep {
  const root = element('section', 'series-step answer-step');
  // The series bar under the heading holds this screen's gear and ? (ADR 0038, 0040).
  const header = createScreenHeader('Round 1', 'Change lineup', actions.onBack, {
    settings: false,
  });
  // A phone turned sideways reads the score line here too, the track a tap away (ADR 0067), so the
  // picks show without a scroll; elsewhere the line stays what is played and the track shows.
  const track = createSeriesTrack(lookup);
  track.element.id = 'answer-track';
  root.dataset['phase'] = 'between';
  let shownSetup: SeriesState['setup'] | undefined;
  const drawBar = () => {
    if (shownSetup === undefined) return;
    const open = root.hasAttribute('data-track-open');
    bar.show(shownSetup, { round: 0, you: 0, bot: 0, open });
  };
  const bar = createSeriesBar({
    id: track.element.id,
    onToggle: () => {
      root.toggleAttribute('data-track-open');
      drawBar();
    },
  });
  const banner = createPickBanner(lookup);
  const status = element('p', 'visually-hidden');
  status.setAttribute('aria-live', 'polite');
  const rows = createPickRows(lookup, actions.onAnswer);
  const toss = createCoinToss(() => {
    reveal();
  });
  root.append(
    header.element,
    bar.element,
    bar.legend,
    status,
    toss.element,
    track.element,
    banner.element,
    rows.element,
  );
  const nameOf = (id: string) => lookup.get(id)?.name ?? id;
  /** Each series' toss, by its seed: it flips the first time round 1 shows, never again. */
  const tossed = new Map<number, TossTimes>();
  let opened: SeriesState | undefined;

  /** The pick, once the toss (if any) is over: it stays hidden while the coin is in the air. */
  function reveal(): void {
    const state = opened;
    if (state === undefined) return;
    const first = formatOf(state.setup) === 'reveal' ? firstToShowOf(state.setup) : undefined;
    const seed = state.setup.seed;
    let times = tossed.get(seed);
    if (first !== undefined && times === undefined) {
      times = offlineToss(Date.now());
      tossed.set(seed, times);
    }
    const stage =
      first === undefined || times === undefined
        ? undefined
        : toss.show({ first, key: String(seed), seats: BOT_SEATS, times, now: () => Date.now() });
    const tossing = stage !== undefined && stage !== 'done';
    banner.element.hidden = tossing;
    rows.element.hidden = tossing;
    track.element.hidden = tossing;
    const choice = pickChoiceOf(state);
    if (choice === undefined) return;
    banner.show(choice, first);
    rows.show(choice);
    // Said once the coin has landed: the toss's own line says it while it plays.
    status.textContent = tossing ? '' : pickLine(choice, 0, remainingOf(state, 'b'), nameOf, first);
  }

  return {
    element: root,
    open(state) {
      shownSetup = state.setup;
      root.removeAttribute('data-track-open');
      drawBar();
      track.update(state, trackOf(state, undefined));
      opened = state;
      reveal();
      header.focus();
    },
  };
}
