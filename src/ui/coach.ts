// The coach (ADR 0090 addendum "One coach"): one look for every moment the game teaches before a
// fight — the first series' "How a series goes", "Your first pick" and round 2's line, and a
// format's first time ("How Showdown goes", "How Blind goes"). It reads as a guide, not content: the
// tip's own cream edge and "i" (the arena's tips wear the same, ADR 0036), a step marker where the
// guide has steps ("1 of 3"), and an entrance on the motion tokens. It sits against the thing it
// talks about, a notch pointing at it, and shrinks to its title line once acted on. A static part
// read in place (no live region): it is there when the screen shows, so a screen reader meets it
// in order, its words redrawn only when they change.
import { element, setHidden } from './dom.ts';
import type { Steps } from './notice-content.ts';

/** What the coach says: its steps box's words, and where it is in a guide of several. */
export interface CoachTip {
  readonly steps: Steps;
  /** "1 of 3": this tip's place in the guide it belongs to. */
  readonly step?: { readonly at: number; readonly of: number };
}

export interface Coach {
  readonly element: HTMLElement;
  /** Shows `tip`, or nothing. A new tip enters again; the same words leave it as it is. */
  show(tip: CoachTip | undefined): void;
  /** Acted on: the coach shrinks to its title line (true) or opens again (false). */
  settle(settled: boolean): void;
}

/** The words a step marker says, and a screen reader hears. */
export const stepWords = (at: number, of: number): string => `${String(at)} of ${String(of)}`;

export function createCoach(className: string): Coach {
  const root = element('section', `coach ${className}`);
  root.hidden = true;
  let shown = '';
  return {
    element: root,
    show(tip) {
      const key = tip === undefined ? '' : JSON.stringify(tip);
      if (key === shown) return;
      shown = key;
      root.hidden = tip === undefined;
      root.removeAttribute('data-settled');
      if (tip === undefined) {
        root.replaceChildren();
        return;
      }
      const head = element('div', 'coach-head');
      const mark = element('span', 'tip-i', 'i');
      mark.setAttribute('aria-hidden', 'true');
      head.append(mark, element('h2', 'coach-title', tip.steps.title));
      if (tip.step !== undefined) {
        const step = element('span', 'coach-step', stepWords(tip.step.at, tip.step.of));
        step.setAttribute('aria-label', `Step ${stepWords(tip.step.at, tip.step.of)}`);
        head.append(step);
      }
      const body = element('div', 'coach-body');
      if (tip.steps.items.length > 0) {
        const list = element(tip.steps.unordered === true ? 'ul' : 'ol', 'coach-list');
        list.append(...tip.steps.items.map((item) => element('li', '', item)));
        body.append(list);
      }
      if (tip.steps.note !== undefined) body.append(element('p', 'coach-note', tip.steps.note));
      root.replaceChildren(head, body);
      // Enters once per tip: the class is set again for a new one (coach.css).
      root.classList.remove('coach-enter');
      void root.getBoundingClientRect();
      root.classList.add('coach-enter');
    },
    settle(settled) {
      if (settled) root.setAttribute('data-settled', '');
      else root.removeAttribute('data-settled');
      const body = root.querySelector<HTMLElement>('.coach-body');
      if (body !== null) setHidden(body, settled);
    },
  };
}
