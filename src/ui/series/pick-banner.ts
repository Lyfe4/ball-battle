import { drawBallIcon } from '../../render/ball-icon.ts';
import type { Side } from '../../sim/series.ts';
import type { DefinitionLookup } from '../../sim/types.ts';
import { element } from '../dom.ts';
import { bannerText } from '../series-text.ts';
import { BOT_SEATS, type Seats } from './seats.ts';
import type { PickChoice } from './series-view.ts';

export interface PickBanner {
  readonly element: HTMLElement;
  /**
   * "The bot plays Venom. Pick your answer.", and the like; redrawn only when it changes. On
   * Reveal's round 1 the toss (`first`, who won it) leads it: "Coin toss: you show first." (ADR 0041).
   */
  show(choice: PickChoice, first?: Side, seats?: Seats): void;
}

const FACE_PX = 20;

/**
 * The banner over a pick's rows (ADR 0025, 0035, 0037), in plain sentences with ball names: the
 * ball being answered (with its drawing), that the player shows first, or that they open a
 * Showdown while the bot picks at the same time. On Reveal's round 1 it says the coin toss in
 * words; the toss itself is its own moment before it (coin-toss.ts, ADR 0061).
 */
export function createPickBanner(lookup: DefinitionLookup): PickBanner {
  const root = element('p', 'series-banner');
  // The rows' accessible names and the live status say it in words.
  root.setAttribute('aria-hidden', 'true');
  const face = element('canvas', 'series-banner-icon');
  const nameOf = (id: string) => lookup.get(id)?.name ?? id;
  let shown = '';
  return {
    element: root,
    show(choice, first, seats = BOT_SEATS) {
      const faced = choice.facing;
      const key = `${choice.kind}:${faced ?? ''}:${first ?? ''}:${seats.you}:${seats.them}`;
      if (key === shown) return;
      shown = key;
      const { lead, ask } = bannerText(choice, nameOf, first, seats);
      const ball = faced === undefined ? undefined : lookup.get(faced);
      if (ball !== undefined) drawBallIcon(face, ball, FACE_PX);
      const opening = element('span', 'series-banner-lead');
      opening.append(lead, ...(ball === undefined ? [] : [' ', face]));
      root.replaceChildren(opening, ' ', element('span', 'series-banner-ask', ask));
    },
  };
}
