import { drawBallIcon } from '../../render/ball-icon.ts';
import type { Lineup } from '../../sim/series.ts';
import type { BallDefinition } from '../../sim/types.ts';
import { leanOf, type Lean } from '../balls/matchups.ts';
import { element, setText } from '../dom.ts';
import { createScreenHeader } from '../screen-header.ts';

export interface AnswerStep {
  readonly element: HTMLElement;
  /**
   * Shows both lineups (the bot's in roster order) with the ball the bot shows first marked, and
   * the player's three to answer with; focuses the heading.
   */
  open(own: Lineup, bot: Lineup, shown: string): void;
}

export interface AnswerActions {
  /** Back to the lineup, to change the balls. */
  readonly onBack: () => void;
  /** The player's answer for round 1. */
  readonly onAnswer: (ball: string) => void;
}

const ICON_PX = 40;
const MARKS: Readonly<Record<Lean, string>> = { favoured: '▲', unfavoured: '▼', even: '' };
const WORDS: Readonly<Record<Lean, string>> = {
  favoured: 'favoured against',
  unfavoured: 'unfavoured against',
  even: 'even with',
};

/**
 * Reveal, round 1 (ADR 0021), phone first: one job, answering the ball the bot shows first. The
 * bot's three are on top with its round-1 ball marked; the player's three are buttons, each marked
 * ▲ / ▼ against that ball. A tap answers and the round starts. The ball kept back matters too: in
 * round 2 the player shows first and the bot answers with its best counter.
 */
export function createAnswerStep(
  balls: readonly BallDefinition[],
  actions: AnswerActions,
): AnswerStep {
  const byId = new Map(balls.map((ball) => [ball.id, ball]));
  const roster = balls.map((ball) => ball.id);
  const nameOf = (id: string) => byId.get(id)?.name ?? id;
  const root = element('section', 'series-step answer-step');
  const header = createScreenHeader('Round 1', 'Change lineup', actions.onBack);
  const hint = element('p', 'series-step-hint');
  const botLabel = element('h2', 'order-label', 'The bot’s lineup');
  const botRow = element('ul', 'order-bot');
  const ownLabel = element('h2', 'order-label', 'Answer with');
  const choices = element('div', 'answer-choices');
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', 'Your ball for round 1');
  const after = element(
    'p',
    'series-step-hint',
    'Round 2 you show first, and the bot answers with its best counter from the two it has left.',
  );
  root.append(header.element, hint, botLabel, botRow, ownLabel, choices, after);

  function icon(id: string): HTMLCanvasElement {
    const canvas = element('canvas', 'order-icon');
    canvas.setAttribute('aria-hidden', 'true');
    const ball = byId.get(id);
    if (ball !== undefined) drawBallIcon(canvas, ball, ICON_PX);
    return canvas;
  }

  return {
    element: root,
    open(own, bot, shown) {
      setText(hint, `The bot shows first: its ${nameOf(shown)} plays round 1. Pick your answer.`);
      const sorted = [...bot].sort((x, y) => roster.indexOf(x) - roster.indexOf(y));
      botRow.replaceChildren(
        ...sorted.map((id) => {
          const item = element('li', 'order-bot-ball');
          item.classList.toggle('answer-shown', id === shown);
          const name = element('span', 'order-bot-name', nameOf(id));
          item.append(icon(id), name);
          if (id === shown) item.append(element('span', 'answer-shown-note', 'Plays round 1'));
          return item;
        }),
      );
      choices.replaceChildren(
        ...own.map((id) => {
          const lean = leanOf(id, shown);
          const button = element('button', 'answer-choice');
          button.type = 'button';
          const mark = element('span', 'answer-mark', MARKS[lean]);
          mark.dataset['lean'] = lean;
          mark.setAttribute('aria-hidden', 'true');
          button.append(icon(id), element('span', 'answer-name', nameOf(id)), mark);
          button.setAttribute('aria-label', `${nameOf(id)}, ${WORDS[lean]} ${nameOf(shown)}`);
          button.addEventListener('click', () => {
            actions.onAnswer(id);
          });
          return button;
        }),
      );
      header.focus();
    },
  };
}
