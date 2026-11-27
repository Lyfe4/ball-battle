// "How it goes": a short title and a few numbered lines in a quiet box, one look wherever the game
// explains something in steps (ADR 0090): a notice's steps, the first series' coach boxes, the new
// ways to play, a format's first time. A static part read in place (no live region): it is there
// when the screen shows, so a screen reader meets it in order.
import { element } from './dom.ts';
import type { Steps } from './notice-content.ts';

export type { Steps } from './notice-content.ts';

/** The box for `steps`. */
export function createStepsBox(steps: Steps): HTMLElement {
  const box = element('section', 'notice-steps');
  box.append(element('h2', 'notice-steps-title', steps.title));
  if (steps.items.length > 0) {
    const list = element(steps.unordered === true ? 'ul' : 'ol', 'notice-steps-list');
    list.append(...steps.items.map((item) => element('li', '', item)));
    box.append(list);
  }
  if (steps.note !== undefined) box.append(element('p', 'notice-steps-note', steps.note));
  return box;
}

/** A place on a screen that holds a steps box or nothing, redrawn only when its words change. */
export function createStepsPlace(className: string): {
  readonly element: HTMLElement;
  show(steps: Steps | undefined): void;
} {
  const place = element('div', className);
  place.hidden = true;
  let shown = '';
  return {
    element: place,
    show(steps) {
      const key = steps === undefined ? '' : JSON.stringify(steps);
      if (key === shown) return;
      shown = key;
      place.replaceChildren(...(steps === undefined ? [] : [createStepsBox(steps)]));
      place.hidden = steps === undefined;
    },
  };
}
