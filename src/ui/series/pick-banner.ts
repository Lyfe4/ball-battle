import { drawBallIcon } from '../../render/ball-icon.ts';
import type { DefinitionLookup } from '../../sim/types.ts';
import { element } from '../dom.ts';
import type { PickChoice } from './series-view.ts';

export interface PickBanner {
  readonly element: HTMLElement;
  /** "Your pick: answer [ball]", "show first" or "opener"; redrawn only when it changes. */
  show(choice: PickChoice): void;
}

const FACE_PX = 20;

const BANNERS: Readonly<Record<PickChoice['kind'], string>> = {
  answer: 'Your pick: answer ',
  show: 'Your pick: show first',
  open: 'Your pick: opener',
};

/**
 * The banner over a pick's rows (ADR 0025, 0035): what the player is answering, that they show
 * first, or that they open a Showdown while the bot picks at the same time.
 */
export function createPickBanner(lookup: DefinitionLookup): PickBanner {
  const root = element('p', 'series-banner');
  // The rows' accessible names and the live status say it in words.
  root.setAttribute('aria-hidden', 'true');
  const face = element('canvas', 'series-banner-icon');
  let shown = '';
  return {
    element: root,
    show(choice) {
      const faced = choice.facing;
      const key = `${choice.kind}:${faced ?? ''}`;
      if (key === shown) return;
      shown = key;
      const ball = faced === undefined ? undefined : lookup.get(faced);
      if (ball !== undefined) drawBallIcon(face, ball, FACE_PX);
      root.replaceChildren(BANNERS[choice.kind], ...(ball === undefined ? [] : [face]));
    },
  };
}
