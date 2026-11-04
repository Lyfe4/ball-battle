import { nextMatch, type NextMatch, type SeriesState } from '../sim/series.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import { element, setText } from './dom.ts';
import { betweenLine, finalLine, playingLine, roundLine, scoreLine } from './series-text.ts';

export interface SeriesActions {
  /** Plays the next match: the next round, or a drawn round again. */
  readonly onNext: () => void;
  /** Same lineups, new seed. */
  readonly onRematch: () => void;
  /** Back to the lineup builder. */
  readonly onNewSeries: () => void;
}

export interface SeriesView {
  readonly state: SeriesState;
  /** The match on screen, if any. */
  readonly current: NextMatch | undefined;
  /** True once the match on screen has ended and its result is showing. */
  readonly settled: boolean;
}

export interface SeriesPanel {
  setVisible(visible: boolean): void;
  /** Cheap to call every frame: only changed text and buttons are touched. */
  update(view: SeriesView): void;
}

/**
 * The best-of-3 scoreboard: the score, every finished round, and what is happening now. Between
 * plays it offers Next round (or Replay round after a draw), with the bot's next ball hidden;
 * at the end, the result with Rematch and New series. Plain DOM, all text through textContent.
 */
export function createSeriesPanel(
  root: HTMLElement,
  definitions: DefinitionLookup,
  actions: SeriesActions,
): SeriesPanel {
  root.replaceChildren();
  root.className = 'series';
  const nameOf = (id: string) => definitions.get(id)?.name ?? id;

  const headingId = 'series-heading';
  root.setAttribute('aria-labelledby', headingId);
  const heading = element('h2', 'series-heading', 'Best of 3');
  heading.id = headingId;
  const score = element('p', 'series-score');
  const rounds = element('ol', 'series-rounds');
  // Announced when it changes: the round starting, a result, the series result.
  const status = element('p', 'series-status');
  status.setAttribute('aria-live', 'polite');

  const buttons = element('div', 'hud-actions');
  const next = button('Next round', 'hud-button hud-button-primary', actions.onNext);
  const rematch = button('Rematch', 'hud-button', actions.onRematch);
  const newSeries = button('New series', 'hud-button hud-button-primary', actions.onNewSeries);
  buttons.append(next, rematch, newSeries);
  root.append(heading, score, rounds, status, buttons);

  function button(text: string, className: string, onClick: () => void): HTMLButtonElement {
    const node = element('button', className, text);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  }

  let shownRounds = -1;
  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    update({ state, current, settled }) {
      setText(score, scoreLine(state));
      if (state.rounds.length !== shownRounds) {
        shownRounds = state.rounds.length;
        rounds.replaceChildren(
          ...state.rounds.map((record) => element('li', 'series-round', roundLine(record, nameOf))),
        );
      }
      const playing = current !== undefined && !settled;
      const upcoming = nextMatch(state);
      const finished = state.winner !== undefined && !playing;
      let text = '';
      if (playing) text = playingLine(current, nameOf);
      else if (finished) text = finalLine(state);
      else if (upcoming !== undefined) text = betweenLine(state, upcoming, nameOf);
      setText(status, text);

      const between = !playing && !finished && upcoming !== undefined;
      setText(next, state.pending.length > 0 ? 'Replay round' : 'Next round');
      next.hidden = !between;
      rematch.hidden = !finished;
      newSeries.hidden = !finished;
      buttons.hidden = !between && !finished;
    },
  };
}
