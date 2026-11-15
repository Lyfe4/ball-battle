// A notice: a reading screen with one thing to say and a way on (ADR 0027: no dead ends). A
// header with Back, a short body, and the buttons that move on, the first the primary. One look
// for every notice: a link from another version, and online play's states (offline, a challenge
// already taken, the 16+ confirmation). A friend's card and the lobby add parts of their own
// (ADR 0055): a sticker, chips, a waiting ball, steps, the link in a quiet box and a quiet action.
import { busyOnClick } from './busy-button.ts';
import { element } from './dom.ts';
import { createScreenHeader } from './screen-header.ts';
import type { NoticeContent } from './notice-content.ts';
import { createSticker } from './sticker.ts';

export type { NoticeButton, NoticeContent } from './notice-content.ts';

export interface Notice {
  readonly element: HTMLElement;
  /** Shows `content`, and moves focus to the heading unless `focus` is false. */
  show(content: NoticeContent, focus?: boolean): void;
}

function linkBox(link: NonNullable<NoticeContent['link']>): HTMLElement {
  const box = element('div', 'notice-link');
  const url = element('span', 'notice-link-url', link.url);
  box.append(url);
  const copy = link.copy;
  if (copy !== undefined) {
    const button = element('button', 'text-link notice-link-copy', 'Copy');
    button.type = 'button';
    button.setAttribute('aria-label', 'Copy link');
    button.addEventListener('click', () => {
      void copy().then((done) => {
        button.textContent = done;
      });
    });
    box.append(button);
  }
  return box;
}

/** A notice drawing into `root`; `onBack` is its header's Back. */
export function createNotice(root: HTMLElement, onBack: () => void): Notice {
  const header = createScreenHeader('', 'Back', onBack);
  const sticker = createSticker();
  const body = element('div', 'notice-body');
  const footer = element('div', 'screen-footer');
  const after = element('div', 'notice-after');
  root.classList.add('notice');
  root.replaceChildren(header.element, body, footer, after);
  return {
    element: root,
    show(content, focus = true) {
      header.setTitle(content.title);
      root.toggleAttribute('data-sticker', content.sticker !== undefined);
      const parts: HTMLElement[] = [];
      if (content.sticker !== undefined) {
        sticker.show(content.sticker);
        parts.push(sticker.element);
      }
      if (content.chips !== undefined) {
        const chips = element('ul', 'notice-chips');
        chips.append(...content.chips.map((chip) => element('li', 'notice-chip', chip)));
        parts.push(chips);
      }
      if (content.waiting !== undefined) {
        const waiting = element('div', 'notice-waiting');
        const ball = element('span', 'notice-waiting-ball');
        ball.setAttribute('aria-hidden', 'true');
        waiting.append(
          ball,
          element('h2', 'notice-waiting-title', content.waiting.title),
          element('p', 'notice-waiting-line', content.waiting.line),
        );
        parts.push(waiting);
      }
      parts.push(...content.body.map((text) => element('p', 'notice-text', text)));
      if (content.steps !== undefined) {
        const steps = element('section', 'notice-steps');
        const list = element('ol', 'notice-steps-list');
        list.append(...content.steps.items.map((item) => element('li', '', item)));
        steps.append(element('h2', 'notice-steps-title', content.steps.title), list);
        parts.push(steps);
      }
      body.replaceChildren(...parts);
      footer.replaceChildren(
        ...content.buttons.map((spec, index) => {
          const button = element(
            'button',
            index === 0 ? 'hud-button hud-button-primary' : 'hud-button',
            spec.text,
          );
          button.type = 'button';
          if (spec.label !== undefined) button.setAttribute('aria-label', spec.label);
          busyOnClick(button, () => {
            const answer = spec.onClick();
            // A button whose request says what happened ("Link copied") shows it.
            if (spec.relabel === true && answer instanceof Promise) {
              void answer.then((done: unknown) => {
                if (typeof done === 'string') button.textContent = done;
              });
            }
            return answer;
          });
          return button;
        }),
      );
      footer.hidden = content.buttons.length === 0;
      const rest: HTMLElement[] = [];
      if (content.link !== undefined) rest.push(linkBox(content.link));
      if (content.note !== undefined) rest.push(element('p', 'notice-text', content.note));
      if (content.quiet !== undefined) {
        const quiet = element('button', 'text-link notice-quiet', content.quiet.text);
        quiet.type = 'button';
        quiet.setAttribute('aria-label', content.quiet.label ?? content.quiet.text);
        busyOnClick(quiet, content.quiet.onClick);
        rest.push(quiet);
      }
      after.replaceChildren(...rest);
      after.hidden = rest.length === 0;
      if (focus) header.focus();
    },
  };
}
