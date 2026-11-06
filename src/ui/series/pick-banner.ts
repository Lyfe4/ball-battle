import { drawBallIcon } from '../../render/ball-icon.ts';
import type { DefinitionLookup } from '../../sim/types.ts';
import { element } from '../dom.ts';
import type { PickChoice } from './series-view.ts';

export interface PickBanner {
  readonly element: HTMLElement;
  /** "Your pick: answer [ball]" or "Your pick: show first"; redrawn only when it changes. */
  show(choice: PickChoice): void;
}

const FACE_PX = 20;

/** The banner over a pick's rows (ADR 0025): what the player is answering, or that they show first. */
export function createPickBanner(lookup: DefinitionLookup): PickBanner {
  const root = element('p', 'series-banner');
  // The rows' accessible names and the live status say it in words.
  root.setAttribute('aria-hidden', 'true');
  const face = element('canvas', 'series-banner-icon');
  let shown = '';
  return {
    element: root,
    show(choice) {
      const faced = choice.kind === 'answer' ? choice.options[0]?.faces[0] : undefined;
      const key = `${choice.kind}:${faced ?? ''}`;
      if (key === shown) return;
      shown = key;
      const ball = faced === undefined ? undefined : lookup.get(faced);
      if (ball !== undefined) drawBallIcon(face, ball, FACE_PX);
      root.replaceChildren(
        choice.kind === 'answer' ? 'Your pick: answer ' : 'Your pick: show first',
        ...(ball === undefined ? [] : [face]),
      );
    },
  };
}
