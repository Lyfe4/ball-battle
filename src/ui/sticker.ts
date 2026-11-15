import { element, setText } from './dom.ts';
import type { StickerWords } from './sticker-words.ts';

export type { StickerWords } from './sticker-words.ts';

export interface Sticker {
  readonly element: HTMLElement;
  /** Shows `words`; writes only what changed (the series panel calls it every frame). */
  show(words: StickerWords): void;
}

/**
 * A cream sticker on the page (ADR 0055): the Winner sticker's look off the court, tilted, with the
 * accent's edge and slab, for the moments a screen announces rather than explains: who challenges
 * you, and how a match ended. `heading` makes the title the screen's heading.
 */
export function createSticker(heading = false): Sticker {
  const root = element('div', 'sticker');
  const above = element('p', 'sticker-small');
  const title = element(heading ? 'h1' : 'p', 'sticker-title');
  const below = element('p', 'sticker-small');
  root.append(above, title, below);
  return {
    element: root,
    show(words) {
      setText(above, words.above ?? '');
      above.hidden = words.above === undefined;
      setText(title, words.title);
      setText(below, words.below ?? '');
      below.hidden = words.below === undefined;
    },
  };
}
