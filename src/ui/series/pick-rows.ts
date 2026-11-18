import { drawBallIcon } from '../../render/ball-icon.ts';
import type { DefinitionLookup } from '../../sim/types.ts';
import { LEAN_WORDS, MARKS } from '../balls/marks.ts';
import { leanOf, matchupTip, type Lean } from '../balls/matchups.ts';
import { cue } from '../../sound/sound.ts';
import { holdBusy } from '../busy-button.ts';
import { element } from '../dom.ts';
import { markSymbol } from '../symbol-tooltip.ts';
import { BOT_SEATS, type Seats } from './seats.ts';
import type { PickChoice } from './series-view.ts';

export interface PickRows {
  readonly element: HTMLElement;
  /** Shows one row per option; rebuilt only when the choice changes. */
  show(choice: PickChoice, seats?: Seats): void;
  /** Focuses the first option. */
  focus(): void;
}

const OWN_PX = 36;
/** A Best of 5's wide chart (ADR 0048): the player's ball smaller, its name under it. */
const OWN_WIDE_PX = 28;
/** More columns than a Best of 3 ever shows: the chart lays each row out narrower. */
const WIDE_FROM = 4;
const HEAD_PX = 26;
const KEY_ORDER: readonly Lean[] = ['favoured', 'even', 'unfavoured'];

/**
 * A pick as a type chart (ADR 0025, 0035, 0037): the bot's balls once, as column heads ("vs the
 * bot's", the ball being answered ringed), then one row per ball of the player's, its cells the
 * player's ▲ / = / ▼ against each column. The mark sits in the player's own row, so it reads as
 * their ball's edge, never the bot's. Each mark is its own tap target: a tap names both balls, who
 * has the edge and why, and never picks; a tap anywhere else on the row picks. A one-line key under
 * the rows says what the marks mean without any gesture, and each row's accessible name says it
 * all in words. Nothing says which ball the bot will play: the player makes their own read.
 */
export function createPickRows(
  lookup: DefinitionLookup,
  onPick: (ball: string) => unknown,
): PickRows {
  const root = element('div', 'pick-rows');
  const head = element('div', 'pick-rows-head');
  // The rows' names say every opponent in words.
  head.setAttribute('aria-hidden', 'true');
  const rows = element('div', 'pick-rows-list');
  rows.setAttribute('role', 'group');
  rows.setAttribute('aria-label', 'Your pick');
  const key = element('p', 'pick-key');
  /** The other side's edge in the key: "bot’s favoured", or "they’re favoured" for a player. */
  let theirEdge: HTMLElement | undefined;
  // The rows' names already say each lean in words.
  key.setAttribute('aria-hidden', 'true');
  for (const [index, lean] of KEY_ORDER.entries()) {
    if (index > 0) key.append(element('span', 'pick-key-dot', '·'));
    const mark = element('span', 'pick-key-mark', MARKS[lean]);
    mark.dataset['lean'] = lean;
    markSymbol(mark, lean);
    const item = element('span', 'pick-key-item');
    const words = element('span', '', ` ${KEY_WORDS[lean]}`);
    if (lean === 'unfavoured') theirEdge = words;
    item.append(mark, words);
    key.append(item);
  }
  root.append(head, rows, key);
  const nameOf = (id: string) => lookup.get(id)?.name ?? id;
  let shown = '';
  let seats: Seats = BOT_SEATS;

  function icon(id: string, px: number, repeat = false): HTMLCanvasElement {
    const canvas = element('canvas', 'pick-row-icon');
    const ball = lookup.get(id);
    if (ball !== undefined) drawBallIcon(canvas, ball, px, repeat);
    return canvas;
  }

  function heads(choice: PickChoice): void {
    const cells = choice.opponents.map((face) => {
      const cell = element('span', 'pick-head-ball');
      if (face === choice.facing) cell.dataset['facing'] = 'true';
      cell.append(icon(face, HEAD_PX));
      return cell;
    });
    head.replaceChildren(element('span', 'pick-head-label', `vs ${seats.their}`), ...cells);
  }

  function row(choice: PickChoice, ball: string): HTMLElement {
    const holder = element('div', 'pick-row');
    holder.dataset['symbolScope'] = '';
    holder.dataset['ball'] = ball;
    const pick = element('button', 'pick-row-pick');
    // Its sound is the lock, once the pick is taken (sound.ts): never a tap before it as well.
    pick.dataset['sound'] = 'own';
    pick.type = 'button';
    const own = element('span', 'pick-row-own');
    own.setAttribute('aria-hidden', 'true');
    const px = choice.opponents.length >= WIDE_FROM ? OWN_WIDE_PX : OWN_PX;
    own.append(icon(ball, px), element('span', 'pick-row-name', nameOf(ball)));
    pick.append(own);
    const leans = choice.opponents.map(
      (face) => `${LEAN_WORDS[leanOf(ball, face)]} ${nameOf(face)}`,
    );
    const verb = choice.kind === 'show' ? 'Show' : choice.kind === 'open' ? 'Open with' : 'Play';
    pick.setAttribute('aria-label', `${verb} ${nameOf(ball)}: ${leans.join(', ')}`);
    // Online a pick is a request: the ball tapped shows it is working and the others wait, so a
    // second tap (on it or another ball) never sends a second pick (busy-button.ts).
    pick.addEventListener('click', () => {
      if (rows.getAttribute('aria-busy') === 'true') return;
      const out = onPick(ball);
      if (!(out instanceof Promise)) {
        cue('lock');
        return;
      }
      rows.setAttribute('aria-busy', 'true');
      // Online, heard once the server has taken it: a refused pick never sounds locked.
      out.then(
        () => {
          cue('lock');
        },
        () => undefined,
      );
      void holdBusy(pick, out, `Picking ${nameOf(ball)}…`).finally(() => {
        rows.removeAttribute('aria-busy');
      });
    });
    // The marks beside the pick button, never inside it: a tap on one explains, never picks.
    const marks = choice.opponents.map((face) => {
      const lean = leanOf(ball, face);
      const badge = element('button', 'pick-row-badge', MARKS[lean]);
      badge.type = 'button';
      // Words for the eyes only: the pick button's name already says them.
      badge.tabIndex = -1;
      badge.setAttribute('aria-hidden', 'true');
      badge.dataset['lean'] = lean;
      if (face === choice.facing) badge.dataset['facing'] = 'true';
      markSymbol(badge, lean, { tip: matchupTip(ball, face, nameOf, 'yours'), tap: true });
      return badge;
    });
    holder.append(pick, ...marks);
    return holder;
  }

  return {
    element: root,
    show(choice, shownSeats = BOT_SEATS) {
      seats = shownSeats;
      const next = JSON.stringify([choice, seats]);
      if (next === shown) return;
      shown = next;
      if (theirEdge !== undefined) {
        theirEdge.textContent = ` ${seats.they === BOT_SEATS.they ? KEY_WORDS.unfavoured : 'they’re favoured'}`;
      }
      root.style.setProperty('--pick-columns', String(choice.opponents.length));
      // Four or five of the bot's balls (a Best of 5, ADR 0048): the narrower rows (pick-rows.css).
      root.classList.toggle('pick-rows-wide', choice.opponents.length >= WIDE_FROM);
      heads(choice);
      rows.replaceChildren(...choice.options.map((ball) => row(choice, ball)));
    },
    focus() {
      rows.querySelector<HTMLButtonElement>('.pick-row-pick')?.focus();
    },
  };
}

/** The key's words, short enough for one line on a phone, and saying whose edge each mark is. */
const KEY_WORDS: Readonly<Record<Lean, string>> = {
  favoured: 'you’re favoured',
  even: 'even',
  unfavoured: 'bot’s favoured',
};
