import { drawBallIcon } from '../../render/ball-icon.ts';
import type { DefinitionLookup } from '../../sim/types.ts';
import { LEAN_WORDS, MARKS } from '../balls/marks.ts';
import { leanOf, type Lean } from '../balls/matchups.ts';
import { element } from '../dom.ts';
import { markSymbol } from '../symbol-tooltip.ts';
import type { PickChoice } from './series-view.ts';

export interface PickRows {
  readonly element: HTMLElement;
  /** Shows one row per option; rebuilt only when the choice changes. */
  show(choice: PickChoice): void;
  /** Focuses the first option. */
  focus(): void;
}

const OWN_PX = 36;
const FACE_PX = 24;
const KEY_ORDER: readonly Lean[] = ['favoured', 'even', 'unfavoured'];

/**
 * A pick as rows to tap (ADR 0025, 0035), read like a type chart: each row is one of the player's
 * balls, then every ball the bot still has, in the same columns on every row, each marked with the
 * player's ▲ / = / ▼ against it. Nothing says which ball the bot will play: the player makes their
 * own read. When answering, the bot's shown ball is ringed. A one-line key under the rows says what
 * the marks mean, so no gesture is needed to read them; the accessible name says it all in words.
 */
export function createPickRows(lookup: DefinitionLookup, onPick: (ball: string) => void): PickRows {
  const root = element('div', 'pick-rows');
  const rows = element('div', 'pick-rows-list');
  rows.setAttribute('role', 'group');
  rows.setAttribute('aria-label', 'Your pick');
  const key = element('p', 'pick-key');
  // The rows' names already say each lean in words.
  key.setAttribute('aria-hidden', 'true');
  for (const [index, lean] of KEY_ORDER.entries()) {
    if (index > 0) key.append(element('span', 'pick-key-dot', '·'));
    const mark = element('span', 'pick-key-mark', MARKS[lean]);
    mark.dataset['lean'] = lean;
    markSymbol(mark, lean);
    key.append(element('span', 'pick-key-item', ''));
    key.lastElementChild?.append(mark, ` ${KEY_WORDS[lean]}`);
  }
  root.append(rows, key);
  const nameOf = (id: string) => lookup.get(id)?.name ?? id;
  let shown = '';

  function icon(id: string, px: number, repeat = false): HTMLCanvasElement {
    const canvas = element('canvas', 'pick-row-icon');
    const ball = lookup.get(id);
    if (ball !== undefined) drawBallIcon(canvas, ball, px, repeat);
    return canvas;
  }

  function row(choice: PickChoice, ball: string): HTMLButtonElement {
    const button = element('button', 'pick-row');
    button.type = 'button';
    const own = element('span', 'pick-row-own');
    own.append(icon(ball, OWN_PX), element('span', 'pick-row-name', nameOf(ball)));
    const against = element('span', 'pick-row-faces');
    for (const face of choice.opponents) {
      const lean = leanOf(ball, face);
      const badge = element('span', 'pick-row-badge', MARKS[lean]);
      badge.dataset['lean'] = lean;
      markSymbol(badge, lean);
      const holder = element('span', 'pick-row-face');
      if (face === choice.facing) holder.dataset['facing'] = 'true';
      // A mirror: the bot's ball drawn lighter, as in the arena.
      holder.append(icon(face, FACE_PX, face === ball), badge);
      against.append(holder);
    }
    against.setAttribute('aria-hidden', 'true');
    own.setAttribute('aria-hidden', 'true');
    button.append(own, against);
    const leans = choice.opponents.map(
      (face) => `${LEAN_WORDS[leanOf(ball, face)]} ${nameOf(face)}`,
    );
    const verb = choice.kind === 'show' ? 'Show' : choice.kind === 'open' ? 'Open with' : 'Play';
    button.setAttribute('aria-label', `${verb} ${nameOf(ball)}: ${leans.join(', ')}`);
    button.addEventListener('click', () => {
      onPick(ball);
    });
    return button;
  }

  return {
    element: root,
    show(choice) {
      const next = JSON.stringify(choice);
      if (next === shown) return;
      shown = next;
      rows.replaceChildren(...choice.options.map((ball) => row(choice, ball)));
    },
    focus() {
      rows.querySelector('button')?.focus();
    },
  };
}

/** The key's words, short enough for one line on a phone. */
const KEY_WORDS: Readonly<Record<Lean, string>> = {
  favoured: 'favoured',
  even: 'even',
  unfavoured: 'unfavoured',
};
