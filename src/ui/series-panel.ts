import { drawBallIcon } from '../render/ball-icon.ts';
import {
  awaitingPick,
  formatOf,
  nextBallOf,
  nextMatch,
  remainingOf,
  type NextMatch,
  type SeriesState,
} from '../sim/series.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import { leanOf, type Lean } from './balls/matchups.ts';
import { element, setText } from './dom.ts';
import {
  betweenLine,
  botPicksLine,
  finalLine,
  FORMAT_NAMES,
  linkPickLine,
  pickLine,
  revealShowLine,
  playingLine,
  roundLine,
  scoreLine,
} from './series-text.ts';

export interface SeriesActions {
  /** Plays the next match: the next round, or a drawn round again. */
  readonly onNext: () => void;
  /** Loser picks next: the player picked `ball` for the coming round. */
  readonly onPick: (ball: string) => void;
  /** Same lineups, new seed. */
  readonly onRematch: () => void;
  /** Back to the lineup builder. */
  readonly onNewSeries: () => void;
  /** Leaves the series before it is decided. */
  readonly onLeave: () => void;
}

export interface SeriesView {
  readonly state: SeriesState;
  /** The match on screen, if any. */
  readonly current: NextMatch | undefined;
  /** True once the match on screen has ended and its result is showing. */
  readonly settled: boolean;
  /** A replayed link holds the pick that is due, so Next round makes it rather than the player. */
  readonly linkPickDue: boolean;
}

export interface SeriesPanel {
  setVisible(visible: boolean): void;
  /** Cheap to call every frame: only changed text and buttons are touched. */
  update(view: SeriesView): void;
}

const PICK_ICON_PX = 28;
const MARKS: Readonly<Record<Lean, string>> = { favoured: '▲', unfavoured: '▼', even: '' };

/**
 * The best-of-3 scoreboard: the format, the score, every finished round, and what is happening
 * now. Between plays it offers Next round (or Replay round after a draw), with the bot's next ball
 * hidden. In loser-picks-next, when the player lost, it shows the bot's next ball and one button
 * per ball the player has left instead. At the end, the result with Rematch and New series. Plain
 * DOM, all text through textContent.
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
  const format = element('p', 'series-format');
  const score = element('p', 'series-score');
  const rounds = element('ol', 'series-rounds');
  // Announced when it changes: the round starting, a result, a pick due, the series result.
  const status = element('p', 'series-status');
  status.setAttribute('aria-live', 'polite');
  const picks = element('div', 'series-picks');
  picks.setAttribute('role', 'group');
  picks.setAttribute('aria-label', 'Pick your next ball');

  const buttons = element('div', 'hud-actions');
  const next = button('Next round', 'hud-button hud-button-primary', actions.onNext);
  const rematch = button('Rematch', 'hud-button', actions.onRematch);
  const newSeries = button('New series', 'hud-button hud-button-primary', actions.onNewSeries);
  buttons.append(next, rematch, newSeries);
  const leave = button('Leave series', 'text-link series-leave', actions.onLeave);
  root.append(heading, format, score, status, picks, buttons, rounds, leave);

  function button(text: string, className: string, onClick: () => void): HTMLButtonElement {
    const node = element('button', className, text);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  }

  /**
   * One button per ball the player may pick, marked ▲ / ▼ against each ball it may face: the bot's
   * next ball in loser-picks-next, the two the bot can answer with in reveal. Rebuilt only when the
   * choice changes.
   */
  let shownChoices = '';
  function showChoices(choices: readonly string[], against: readonly string[]): void {
    const key = `${choices.join()}>${against.join()}`;
    if (key === shownChoices) return;
    shownChoices = key;
    picks.replaceChildren(
      ...choices.map((id) => {
        const pick = button('', 'hud-button series-pick', () => {
          actions.onPick(id);
        });
        const icon = element('canvas', 'series-pick-icon');
        icon.setAttribute('aria-hidden', 'true');
        const ball = definitions.get(id);
        if (ball !== undefined) drawBallIcon(icon, ball, PICK_ICON_PX);
        const marks = against.map((other) => {
          const lean = leanOf(id, other);
          const mark = element('span', 'series-pick-mark', MARKS[lean] || '·');
          mark.dataset['lean'] = lean;
          mark.setAttribute('aria-hidden', 'true');
          return mark;
        });
        pick.append(icon, element('span', '', `Play ${nameOf(id)}`), ...marks);
        const words = against.map((other) => {
          const lean = leanOf(id, other);
          return `${lean === 'even' ? 'even with' : `${lean} against`} ${nameOf(other)}`;
        });
        pick.setAttribute('aria-label', `Play ${nameOf(id)}, ${words.join(', ')}`);
        return pick;
      }),
    );
  }

  let shownRounds = -1;
  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    update({ state, current, settled, linkPickDue }) {
      setText(format, FORMAT_NAMES[formatOf(state.setup)]);
      setText(score, scoreLine(state));
      if (state.rounds.length !== shownRounds) {
        shownRounds = state.rounds.length;
        rounds.replaceChildren(
          ...state.rounds.map((record) => element('li', 'series-round', roundLine(record, nameOf))),
        );
      }
      const playing = current !== undefined && !settled;
      const upcoming = nextMatch(state);
      const due = playing || linkPickDue ? undefined : awaitingPick(state);
      const finished = state.winner !== undefined && !playing;
      const roundsPlayed = state.rounds.length;
      const reveal = formatOf(state.setup) === 'reveal';
      const botLeft = remainingOf(state, 'b');
      let text = '';
      if (playing) text = playingLine(current, nameOf);
      else if (finished) text = finalLine(state);
      else if (due === 'a' && reveal) text = revealShowLine(roundsPlayed, botLeft, nameOf);
      else if (due === 'a') text = pickLine(roundsPlayed, nextBallOf(state, 'b') ?? '', nameOf);
      else if (due === 'b') text = botPicksLine(roundsPlayed, nextBallOf(state, 'a') ?? '', nameOf);
      else if (upcoming !== undefined) text = betweenLine(state, upcoming, nameOf);
      else if (linkPickDue) text = linkPickLine(roundsPlayed);
      setText(status, text);

      picks.hidden = due !== 'a';
      if (due === 'a') {
        showChoices(remainingOf(state, 'a'), reveal ? botLeft : [nextBallOf(state, 'b') ?? '']);
      }
      const between =
        !playing && !finished && (upcoming !== undefined || due === 'b' || linkPickDue);
      setText(next, state.pending.length > 0 ? 'Replay round' : 'Next round');
      next.hidden = !between;
      rematch.hidden = !finished;
      newSeries.hidden = !finished;
      buttons.hidden = !between && !finished;
      leave.hidden = finished;
    },
  };
}
