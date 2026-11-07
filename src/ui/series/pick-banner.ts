import { drawBallIcon } from '../../render/ball-icon.ts';
import type { Side } from '../../sim/series.ts';
import type { DefinitionLookup } from '../../sim/types.ts';
import { element } from '../dom.ts';
import { bannerText, SIDE_NAMES } from '../series-text.ts';
import type { PickChoice } from './series-view.ts';

/** Reveal's coin toss (ADR 0029): who won it, and the series seed it was tossed for. */
export interface Toss {
  readonly first: Side;
  readonly key: number;
}

export interface PickBanner {
  readonly element: HTMLElement;
  /**
   * "The bot plays Venom. Pick your answer.", and the like; redrawn only when it changes. On
   * Reveal's round 1 `toss` leads it: the coin, then "Coin toss: you show first." (ADR 0041).
   */
  show(choice: PickChoice, toss?: Toss): void;
}

const FACE_PX = 20;

/**
 * The banner over a pick's rows (ADR 0025, 0035, 0037), in plain sentences with ball names: the
 * ball being answered (with its drawing), that the player shows first, or that they open a
 * Showdown while the bot picks at the same time. On Reveal's round 1 it also carries the coin toss
 * (ADR 0041): a flat coin with the winner's name on its face, flipped once per series (not with
 * reduced motion), and the toss in words.
 */
export function createPickBanner(lookup: DefinitionLookup): PickBanner {
  const root = element('p', 'series-banner');
  // The rows' accessible names and the live status say it in words.
  root.setAttribute('aria-hidden', 'true');
  const face = element('canvas', 'series-banner-icon');
  const coin = element('span', 'series-coin');
  const front = element('span', 'series-coin-face');
  const back = element('span', 'series-coin-face series-coin-back');
  coin.append(front, back);
  const nameOf = (id: string) => lookup.get(id)?.name ?? id;
  let shown = '';
  let flipped: number | undefined;
  return {
    element: root,
    show(choice, toss) {
      const faced = choice.facing;
      const key = `${choice.kind}:${faced ?? ''}:${toss?.first ?? ''}:${String(toss?.key ?? '')}`;
      if (key === shown) return;
      shown = key;
      const { lead, ask } = bannerText(choice, nameOf, toss?.first);
      const ball = faced === undefined ? undefined : lookup.get(faced);
      if (ball !== undefined) drawBallIcon(face, ball, FACE_PX);
      const first = element('span', 'series-banner-lead');
      if (toss !== undefined) {
        coin.dataset['first'] = toss.first;
        front.textContent = SIDE_NAMES[toss.first];
        back.textContent = SIDE_NAMES[toss.first === 'a' ? 'b' : 'a'];
        first.append(coin);
      }
      first.append(lead, ...(ball === undefined ? [] : [' ', face]));
      root.replaceChildren(first, ' ', element('span', 'series-banner-ask', ask));
      if (toss === undefined || toss.key === flipped) return;
      flipped = toss.key;
      // Flip once per series: drop the class, and add it again on the next frame.
      root.classList.remove('series-coin-flip');
      requestAnimationFrame(() => {
        root.classList.add('series-coin-flip');
      });
    },
  };
}
