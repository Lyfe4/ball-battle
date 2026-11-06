import type { Side } from '../../sim/series.ts';
import { element, setText } from '../dom.ts';
import { SIDE_NAMES, tossLine } from '../series-text.ts';

export interface TossStrip {
  readonly element: HTMLElement;
  /**
   * Shows who won Reveal's coin toss (ADR 0029). The coin flips once per series (`key`, its seed),
   * not every time the screen is drawn, and not at all with reduced motion (the CSS stops it).
   */
  show(first: Side, key: number): void;
}

/**
 * Reveal's coin toss, flat and brief: a coin with You on one face and Bot on the other flips and
 * lands on the side that shows first in round 1, then one short line says what that means. The
 * coin is decoration; the line carries it for screen readers too.
 */
export function createTossStrip(): TossStrip {
  const root = element('p', 'series-toss');
  const coin = element('span', 'series-toss-coin');
  coin.setAttribute('aria-hidden', 'true');
  const front = element('span', 'series-toss-face');
  const back = element('span', 'series-toss-face series-toss-back');
  coin.append(front, back);
  const label = element('span', 'visually-hidden', 'Coin toss: ');
  const line = element('span', 'series-toss-line');
  root.append(coin, label, line);
  let shown: number | undefined;

  return {
    element: root,
    show(first, key) {
      root.dataset['first'] = first;
      setText(front, SIDE_NAMES[first]);
      setText(back, SIDE_NAMES[first === 'a' ? 'b' : 'a']);
      setText(line, tossLine(first));
      if (key === shown) return;
      shown = key;
      // Restart the flip: drop the class, and add it again on the next frame.
      root.classList.remove('series-toss-flip');
      requestAnimationFrame(() => {
        root.classList.add('series-toss-flip');
      });
    },
  };
}
