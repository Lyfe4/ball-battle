import { element } from './dom.ts';

export interface ScreenHeader {
  readonly element: HTMLElement;
  /** Moves focus to the heading, so a screen reader announces the new screen. */
  focus(): void;
  /** For a screen whose heading follows what it shows (the manual's ball). */
  setTitle(title: string): void;
}

/**
 * The top of a setup screen: a Back button and the screen's heading. The heading takes focus when
 * the screen opens (tabindex -1: focusable by script, not in the tab order).
 */
export function createScreenHeader(
  title: string,
  backLabel: string,
  onBack: () => void,
): ScreenHeader {
  const header = element('header', 'screen-header');
  const back = element('button', 'screen-back', '‹');
  back.type = 'button';
  back.setAttribute('aria-label', backLabel);
  back.addEventListener('click', onBack);
  const heading = element('h1', 'screen-title', title);
  heading.tabIndex = -1;
  header.append(back, heading);
  return {
    element: header,
    focus: () => {
      heading.focus();
    },
    setTitle: (next) => {
      heading.textContent = next;
    },
  };
}
