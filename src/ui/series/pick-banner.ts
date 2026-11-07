import { drawBallIcon } from '../../render/ball-icon.ts';
import type { DefinitionLookup } from '../../sim/types.ts';
import { element } from '../dom.ts';
import type { PickChoice } from './series-view.ts';

export interface PickBanner {
  readonly element: HTMLElement;
  /** "The bot plays Venom. Pick your answer.", and the like; redrawn only when it changes. */
  show(choice: PickChoice): void;
}

const FACE_PX = 20;

/** A pick's prompt as two short sentences: what is happening, then what to do (ADR 0037). */
export interface BannerText {
  readonly lead: string;
  readonly ask: string;
}

export function bannerText(choice: PickChoice, nameOf: (id: string) => string): BannerText {
  if (choice.kind === 'answer' && choice.facing !== undefined) {
    return { lead: `The bot plays ${nameOf(choice.facing)}.`, ask: 'Pick your answer.' };
  }
  if (choice.kind === 'open') {
    return { lead: 'Pick your opener.', ask: 'The bot picks at the same time.' };
  }
  return { lead: 'You show first.', ask: 'Pick a ball; the bot answers.' };
}

/**
 * The banner over a pick's rows (ADR 0025, 0035, 0037), in plain sentences with ball names: the
 * ball being answered (with its drawing), that the player shows first, or that they open a
 * Showdown while the bot picks at the same time.
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
    show(choice) {
      const faced = choice.facing;
      const key = `${choice.kind}:${faced ?? ''}`;
      if (key === shown) return;
      shown = key;
      const { lead, ask } = bannerText(choice, nameOf);
      const ball = faced === undefined ? undefined : lookup.get(faced);
      if (ball !== undefined) drawBallIcon(face, ball, FACE_PX);
      const first = element('span', 'series-banner-lead');
      first.append(lead, ...(ball === undefined ? [] : [' ', face]));
      root.replaceChildren(first, ' ', element('span', 'series-banner-ask', ask));
    },
  };
}
