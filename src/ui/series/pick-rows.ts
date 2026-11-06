import { drawBallIcon } from '../../render/ball-icon.ts';
import type { DefinitionLookup } from '../../sim/types.ts';
import { LEAN_WORDS, MARKS } from '../balls/marks.ts';
import { leanOf } from '../balls/matchups.ts';
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
const FACE_PX = 26;

/**
 * A pick as rows to tap (ADR 0025), instead of buttons with unlabelled marks: each row is the
 * player's ball, then what it would face, each opponent drawn with the player's ▲ / ▼ / = against
 * it. An answer faces the bot's known ball; a ball shown first faces the bot's possible answers
 * ("X or Y" when the counter map ranks them alike). The accessible name says it all in words.
 */
export function createPickRows(lookup: DefinitionLookup, onPick: (ball: string) => void): PickRows {
  const root = element('div', 'pick-rows');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Your pick');
  const nameOf = (id: string) => lookup.get(id)?.name ?? id;
  let shown = '';

  function icon(id: string, px: number, repeat = false): HTMLCanvasElement {
    const canvas = element('canvas', 'pick-row-icon');
    const ball = lookup.get(id);
    if (ball !== undefined) drawBallIcon(canvas, ball, px, repeat);
    return canvas;
  }

  return {
    element: root,
    show(choice) {
      const key = JSON.stringify(choice);
      if (key === shown) return;
      shown = key;
      root.replaceChildren(
        ...choice.options.map(({ ball, faces }) => {
          const row = element('button', 'pick-row');
          row.type = 'button';
          const own = element('span', 'pick-row-own');
          own.append(icon(ball, OWN_PX), element('span', 'pick-row-name', nameOf(ball)));
          const against = element('span', 'pick-row-faces');
          against.append(element('span', 'pick-row-joiner', choice.kind === 'show' ? '→' : 'vs'));
          faces.forEach((face, index) => {
            if (index > 0) against.append(element('span', 'pick-row-joiner', 'or'));
            const lean = leanOf(ball, face);
            const badge = element('span', 'pick-row-badge', MARKS[lean]);
            badge.dataset['lean'] = lean;
            markSymbol(badge, lean);
            const holder = element('span', 'pick-row-face');
            // A mirror: the bot's ball drawn lighter, as in the arena.
            holder.append(icon(face, FACE_PX, face === ball), badge);
            against.append(holder);
          });
          against.setAttribute('aria-hidden', 'true');
          own.setAttribute('aria-hidden', 'true');
          row.append(own, against);
          const words = faces.map((face) => `${LEAN_WORDS[leanOf(ball, face)]} ${nameOf(face)}`);
          row.setAttribute(
            'aria-label',
            choice.kind === 'show'
              ? `Show ${nameOf(ball)}; the bot answers with ${faces.map(nameOf).join(' or ')}: ${words.join(', ')}`
              : `Play ${nameOf(ball)}, ${words.join(', ')}`,
          );
          row.addEventListener('click', () => {
            onPick(ball);
          });
          return row;
        }),
      );
    },
    focus() {
      root.querySelector('button')?.focus();
    },
  };
}
