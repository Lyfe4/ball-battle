// A notice: a reading screen with one thing to say and a way on (ADR 0027: no dead ends). A
// header with Back, a short body, and the buttons that move on, the first the primary. One look
// for every notice: a link from another version, and online play's states (loading, offline, a
// challenge already taken, the 16+ confirmation).
import { element } from './dom.ts';
import { createScreenHeader } from './screen-header.ts';

export interface NoticeButton {
  readonly text: string;
  readonly onClick: () => void;
  /** An accessible name, when the text alone isn't enough. */
  readonly label?: string;
}

export interface NoticeContent {
  readonly title: string;
  /** One paragraph per entry. */
  readonly body: readonly string[];
  /** In order; the first is the primary. Empty only while something loads. */
  readonly buttons: readonly NoticeButton[];
}

export interface Notice {
  readonly element: HTMLElement;
  /** Shows `content`, and moves focus to the heading unless `focus` is false. */
  show(content: NoticeContent, focus?: boolean): void;
}

/** A notice drawing into `root`; `onBack` is its header's Back. */
export function createNotice(root: HTMLElement, onBack: () => void): Notice {
  const header = createScreenHeader('', 'Back', onBack);
  const body = element('div', 'notice-body');
  const footer = element('div', 'screen-footer');
  root.classList.add('notice');
  root.replaceChildren(header.element, body, footer);
  return {
    element: root,
    show(content, focus = true) {
      header.setTitle(content.title);
      body.replaceChildren(...content.body.map((text) => element('p', 'notice-text', text)));
      footer.replaceChildren(
        ...content.buttons.map((spec, index) => {
          const button = element(
            'button',
            index === 0 ? 'hud-button hud-button-primary' : 'hud-button',
            spec.text,
          );
          button.type = 'button';
          if (spec.label !== undefined) button.setAttribute('aria-label', spec.label);
          button.addEventListener('click', spec.onClick);
          return button;
        }),
      );
      footer.hidden = content.buttons.length === 0;
      if (focus) header.focus();
    },
  };
}
