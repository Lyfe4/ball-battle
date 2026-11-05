import { element } from './dom.ts';
import { createSymbolLegend } from './symbol-legend.ts';

export interface ScreenHeader {
  readonly element: HTMLElement;
  /** Moves focus to the heading, so a screen reader announces the new screen. */
  focus(): void;
  /** For a screen whose heading follows what it shows (the manual's ball). */
  setTitle(title: string): void;
}

export interface ScreenHeaderOptions {
  /** The screen shows symbols: a `?` opens the legend that explains them (ADR 0025). */
  readonly legend?: boolean;
}

/**
 * The top of a screen: a Back button, the screen's heading and, where the screen shows symbols,
 * the legend's `?`. The heading takes focus when the screen opens (tabindex -1: focusable by
 * script, not in the tab order).
 */
export function createScreenHeader(
  title: string,
  backLabel: string,
  onBack: () => void,
  options: ScreenHeaderOptions = {},
): ScreenHeader {
  const header = element('header', 'screen-header');
  const back = element('button', 'screen-back', '‹');
  back.type = 'button';
  back.setAttribute('aria-label', backLabel);
  back.addEventListener('click', onBack);
  const heading = element('h1', 'screen-title', title);
  heading.tabIndex = -1;
  header.append(back, heading);
  if (options.legend === true) {
    const legend = createSymbolLegend();
    header.append(legend.toggle, legend.panel);
  }
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
