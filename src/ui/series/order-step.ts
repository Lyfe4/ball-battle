import { drawBallIcon } from '../../render/ball-icon.ts';
import type { Lineup } from '../../sim/series.ts';
import type { BallDefinition } from '../../sim/types.ts';
import { leanOf, type Lean } from '../balls/matchups.ts';
import { element, setText } from '../dom.ts';
import { completeLineup, moveInDraft, type Draft } from '../lineup-draft.ts';
import { createScreenHeader } from '../screen-header.ts';

export interface OrderStep {
  readonly element: HTMLElement;
  /** Shows both lineups (the bot's in roster order, so it gives nothing away) and focuses the heading. */
  open(own: Lineup, bot: Lineup): void;
}

export interface OrderActions {
  /** Back to the lineup, to change the balls. */
  readonly onBack: () => void;
  readonly onLock: (order: Lineup) => void;
}

const ICON_PX = 32;
const MARKS: Readonly<Record<Lean, string>> = { favoured: '▲', unfavoured: '▼', even: '·' };
const WORDS: Readonly<Record<Lean, string>> = {
  favoured: 'favoured against',
  unfavoured: 'unfavoured against',
  even: 'even with',
};

/**
 * Reveal, then order (ADR 0019): both lineups are on the table and the player sets the order of
 * theirs; the bot sets its own in secret. Each of the player's balls shows ▲ / ▼ / · against each of
 * the bot's three, in the bot's row order, so the counters are in front of them while ordering.
 */
export function createOrderStep(
  balls: readonly BallDefinition[],
  actions: OrderActions,
): OrderStep {
  const byId = new Map(balls.map((ball) => [ball.id, ball]));
  const roster = balls.map((ball) => ball.id);
  const nameOf = (id: string) => byId.get(id)?.name ?? id;
  const root = element('section', 'series-step order-step');
  const header = createScreenHeader('Set your order', 'Change lineup', actions.onBack);
  const hint = element(
    'p',
    'series-step-hint',
    'Both lineups are revealed. The bot orders its own in secret; round 1 is both first balls.',
  );
  const botLabel = element('h2', 'order-label', 'The bot’s lineup');
  const botRow = element('ul', 'order-bot');
  const ownLabel = element('h2', 'order-label', 'Your order');
  const list = element('ol', 'order-list');
  let order: Draft = [];
  let bot: readonly string[] = [];

  const rows = [0, 1, 2].map((index) => {
    const item = element('li', 'order-row');
    const number = element('span', 'order-number', String(index + 1));
    number.setAttribute('aria-hidden', 'true');
    const icon = element('canvas', 'order-icon');
    icon.setAttribute('aria-hidden', 'true');
    const name = element('span', 'order-name');
    const marks = element('span', 'order-marks');
    const up = element('button', 'order-move', '↑');
    up.type = 'button';
    up.addEventListener('click', () => {
      move(index, -1);
    });
    const down = element('button', 'order-move', '↓');
    down.type = 'button';
    down.addEventListener('click', () => {
      move(index, 1);
    });
    item.append(number, icon, name, marks, up, down);
    list.append(item);
    return { icon, name, marks, up, down };
  });

  const lock = element('button', 'hud-button hud-button-primary', 'Lock order');
  lock.type = 'button';
  lock.addEventListener('click', () => {
    const lineup = completeLineup(order);
    if (lineup !== undefined) actions.onLock(lineup);
  });
  const footer = element('div', 'screen-footer');
  footer.append(lock);
  root.append(header.element, hint, botLabel, botRow, ownLabel, list, footer);

  function move(index: number, by: -1 | 1): void {
    order = moveInDraft(order, index, by);
    render();
    // Follow the ball that moved, so repeated presses keep moving it.
    const target = rows[index + by];
    (by < 0 ? target?.up : target?.down)?.focus();
    if (target !== undefined && document.activeElement instanceof HTMLButtonElement) {
      if (document.activeElement.disabled) (by < 0 ? target.down : target.up).focus();
    }
  }

  function render(): void {
    rows.forEach((row, index) => {
      const id = order[index] ?? '';
      const ball = byId.get(id);
      setText(row.name, nameOf(id));
      if (ball !== undefined) drawBallIcon(row.icon, ball, ICON_PX);
      const leans = bot.map((other) => leanOf(id, other));
      row.marks.replaceChildren(
        ...leans.map((lean) => {
          const mark = element('span', 'order-mark', MARKS[lean]);
          mark.dataset['lean'] = lean;
          return mark;
        }),
      );
      row.marks.setAttribute(
        'aria-label',
        bot.map((other, i) => `${WORDS[leans[i] ?? 'even']} ${nameOf(other)}`).join(', '),
      );
      row.marks.setAttribute('role', 'img');
      row.up.disabled = index === 0;
      row.down.disabled = index === rows.length - 1;
      row.up.setAttribute('aria-label', `Move ${nameOf(id)} up`);
      row.down.setAttribute('aria-label', `Move ${nameOf(id)} down`);
    });
  }

  return {
    element: root,
    open(own, botLineup) {
      order = own;
      bot = [...botLineup].sort((x, y) => roster.indexOf(x) - roster.indexOf(y));
      botRow.replaceChildren(
        ...bot.map((id) => {
          const item = element('li', 'order-bot-ball');
          const icon = element('canvas', 'order-icon');
          icon.setAttribute('aria-hidden', 'true');
          const ball = byId.get(id);
          if (ball !== undefined) drawBallIcon(icon, ball, ICON_PX);
          item.append(icon, element('span', 'order-bot-name', nameOf(id)));
          return item;
        }),
      );
      // The marks on each row are in the bot row's order; say which ball each one is against.
      setText(ownLabel, `Your order · ▲ ▼ against ${bot.map(nameOf).join(', ')}`);
      render();
      header.focus();
    },
  };
}
