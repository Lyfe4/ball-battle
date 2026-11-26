// A notice: a reading screen with one thing to say and a way on (ADR 0027: no dead ends). A
// header with Back, a short body, and the buttons that move on, the first the primary. One look
// for every notice: a link from another version, and online play's states (offline, a challenge
// already taken, the 16+ confirmation). A friend's card and the lobby add parts of their own
// (ADR 0055): a sticker, chips, a waiting ball, steps, the link in a quiet box and a quiet action.
import { busyOnClick } from './busy-button.ts';
import { personDisc } from './online/friend-sheet.ts';
import { element } from './dom.ts';
import { createScreenHeader } from './screen-header.ts';
import type { NoticeContent, NoticeField } from './notice-content.ts';
import { createSticker } from './sticker.ts';

export type { NoticeContent, NoticeField } from './notice-content.ts';

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
    const button = element('button', 'hud-button notice-link-copy', 'Copy');
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

/** Whether a folded link was opened: kept while the lobby redraws every few seconds. */
let foldOpen = false;

/** The link's box, or folded under its words with Share inside (a friend's lobby, ADR 0086). */
function linkPart(link: NonNullable<NoticeContent['link']>): HTMLElement {
  if (link.fold === undefined) return linkBox(link);
  const fold = element('details', 'notice-fold');
  fold.open = foldOpen;
  fold.addEventListener('toggle', () => {
    foldOpen = fold.open;
  });
  // What it folds in a body of its own: a <details>' content sits in the browser's own slot, so the
  // fold's gap never reaches between its parts.
  const body = element('div', 'notice-fold-body');
  body.append(linkBox(link));
  fold.append(element('summary', 'sheet-row notice-fold-summary', link.fold), body);
  const share = link.share;
  if (share !== undefined) {
    const button = element('button', 'hud-button notice-fold-share', share.text);
    button.type = 'button';
    button.setAttribute('aria-label', share.label ?? share.text);
    busyOnClick(button, async () => {
      const said = await share.onClick();
      if (share.relabel === true && typeof said === 'string') button.textContent = said;
    });
    body.append(button);
  }
  return fold;
}

const FIELD_INPUT: Readonly<
  Record<
    NoticeField['kind'],
    Partial<Pick<HTMLInputElement, 'type' | 'autocomplete' | 'inputMode'>>
  >
> = {
  email: { type: 'email', autocomplete: 'email', inputMode: 'email' },
  code: { type: 'text', autocomplete: 'one-time-code', inputMode: 'numeric' },
  username: { type: 'text', autocomplete: 'off', inputMode: 'text' },
};

/** A field's label, input and error line; the input stays while its kind does. */
function createField() {
  const box = element('div', 'notice-field');
  const label = element('label', 'notice-field-label');
  const error = element('p', 'notice-field-error');
  error.setAttribute('role', 'alert');
  let input: HTMLInputElement | undefined;
  let kind: NoticeField['kind'] | undefined;
  let onInput: (value: string) => void = () => undefined;
  let submit: () => void = () => undefined;
  return {
    element: box,
    focus: () => input?.focus(),
    show(field: NoticeField, onSubmit: () => void): void {
      onInput = field.onInput;
      submit = onSubmit;
      if (input === undefined || kind !== field.kind) {
        input = element('input', 'notice-field-input');
        Object.assign(input, FIELD_INPUT[field.kind]);
        input.id = `notice-field-${field.kind}`;
        input.spellcheck = false;
        input.autocapitalize = 'off';
        if (field.kind === 'code') input.maxLength = 7;
        // Safari's own: no word suggestions replacing what was typed.
        if (field.kind === 'username') input.setAttribute('autocorrect', 'off');
        input.addEventListener('input', () => {
          onInput(input?.value ?? '');
        });
        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            submit();
          }
        });
        kind = field.kind;
        label.htmlFor = input.id;
        box.replaceChildren(label, input, error);
      }
      label.textContent = field.label;
      error.textContent = field.error ?? '';
      error.hidden = field.error === undefined;
      input.setAttribute('aria-invalid', String(field.error !== undefined));
    },
  };
}

/** A notice drawing into `root`; `onBack` is its header's Back. */
export function createNotice(root: HTMLElement, onBack: () => void): Notice {
  const header = createScreenHeader('', 'Back', onBack);
  const sticker = createSticker();
  const body = element('div', 'notice-body');
  const footer = element('div', 'screen-footer');
  const after = element('div', 'notice-after');
  const field = createField();
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
        const who = content.waiting.who;
        // Waiting for someone by name: their disc, pulsing gently (ADR 0086); else the ball.
        const ball =
          who === undefined
            ? element('span', 'notice-waiting-ball')
            : personDisc({ id: '', name: who }, 'row');
        ball.classList.add(who === undefined ? 'notice-waiting-mark' : 'notice-waiting-disc');
        ball.setAttribute('aria-hidden', 'true');
        waiting.append(
          ball,
          element('h2', 'notice-waiting-title', content.waiting.title),
          element('p', 'notice-waiting-line', content.waiting.line),
        );
        parts.push(waiting);
      }
      parts.push(...content.body.map((text) => element('p', 'notice-text', text)));
      if (content.links !== undefined) {
        const links = element('p', 'notice-text notice-links');
        links.append(
          ...content.links.map(({ text, href }) => {
            const anchor = element('a', 'text-link', text);
            anchor.href = href;
            anchor.target = '_blank';
            anchor.rel = 'noopener';
            return anchor;
          }),
        );
        parts.push(links);
      }
      if (content.steps !== undefined) {
        const steps = element('section', 'notice-steps');
        const list = element('ol', 'notice-steps-list');
        list.append(...content.steps.items.map((item) => element('li', '', item)));
        steps.append(element('h2', 'notice-steps-title', content.steps.title), list);
        parts.push(steps);
      }
      if (content.field !== undefined) {
        field.show(content.field, () => {
          footer.querySelector<HTMLButtonElement>('.hud-button')?.click();
        });
        parts.push(field.element);
      }
      if (content.part instanceof HTMLElement) parts.push(content.part);
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
      if (content.link !== undefined) rest.push(linkPart(content.link));
      if (content.note !== undefined) rest.push(element('p', 'notice-text', content.note));
      if (content.quiet !== undefined) {
        const quiet = element('button', 'hud-button notice-quiet', content.quiet.text);
        quiet.type = 'button';
        quiet.setAttribute('aria-label', content.quiet.label ?? content.quiet.text);
        busyOnClick(quiet, content.quiet.onClick);
        rest.push(quiet);
      }
      if (content.more !== undefined && content.more.length > 0) {
        const more = element('div', 'notice-more');
        for (const spec of content.more) {
          const action = element('button', 'sheet-row', spec.text);
          action.type = 'button';
          if (spec.opens === true) action.dataset['opens'] = '';
          action.setAttribute('aria-label', spec.label ?? spec.text);
          busyOnClick(action, spec.onClick);
          more.append(action);
        }
        rest.push(more);
      }
      if (content.danger !== undefined && content.danger.length > 0) {
        const zone = element('div', 'sheet-danger notice-danger');
        for (const spec of content.danger) {
          const action = element('button', 'sheet-row danger-row', spec.text);
          action.type = 'button';
          action.setAttribute('aria-label', spec.label ?? spec.text);
          busyOnClick(action, spec.onClick);
          zone.append(action);
        }
        rest.push(zone);
      }
      after.replaceChildren(...rest);
      after.hidden = rest.length === 0;
      if (focus && content.field !== undefined) field.focus();
      else if (focus) header.focus();
    },
  };
}
