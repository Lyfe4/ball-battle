// "How it goes": a short title and a few numbered lines in a quiet box, a notice's steps (ADR 0090).
// Teaching before a fight is the coach's (coach.ts), the first series' unlock its card
// (unlock-card.ts). A static part read in place (no live region): it is there when the screen
// shows, so a screen reader meets it in order.
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
