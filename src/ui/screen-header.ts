import type { TabId } from '../app/tabs.ts';
import { element } from './dom.ts';
import { createSettingsToggle } from './settings-menu.ts';
import { createSymbolLegend } from './symbol-legend.ts';

export interface ScreenHeader {
  readonly element: HTMLElement;
  /** Moves focus to the heading, so a screen reader announces the new screen. */
  focus(): void;
  /** For a screen whose heading follows what it shows (the manual's ball). */
  setTitle(title: string): void;
  /** Shows or hides Back: a tab screen has none, a screen opened from it has one (the manual's ball). */
  setBack(shown: boolean): void;
}

export interface ScreenHeaderOptions {
  /** The screen shows symbols: a `?` opens the legend that explains them (ADR 0025). */
  readonly legend?: boolean;
  /**
   * The settings gear (ADR 0040), on by default. Off only where a bar under the header holds the
   * screen's ? and the gear beside it (round 1's pick), so a screen has one gear.
   */
  readonly settings?: boolean;
  /**
   * The tab this screen is, if it is one (ADR 0081): the shell puts the avatar in its lead slot
   * while it shows as that tab (shell.ts, ADR 0087), and it has no Back (addendum of 2026-11-24):
   * the tab bar and the browser's Back lead away. `setBack` shows it on a screen opened from it.
   */
  readonly tab?: TabId;
}

/**
 * The lead slot of a header row: one tap target wide whether it holds Back, the avatar (a tab
 * screen's, `data-tab-head`, placed by the shell) or nothing.
 */
export function createLeadSlot(tab?: TabId): HTMLElement {
  const lead = element('div', 'screen-lead');
  if (tab !== undefined) lead.dataset['tabHead'] = tab;
  return lead;
}

/**
 * The header row of a screen where nothing fights (ADR 0087): the lead slot (Back, or the avatar
 * on a tab screen), the heading, the legend's `?` where the screen shows symbols, then the gear,
 * always last. The heading takes focus when the screen opens (tabindex
 * -1: focusable by script, not in the tab order).
 */
export function createScreenHeader(
  title: string,
  backLabel: string,
  onBack: () => void,
  options: ScreenHeaderOptions = {},
): ScreenHeader {
  const header = element('header', 'screen-header');
  // The lead slot (ADR 0087): always one tap target wide, so the title starts at the same place on
  // every screen. Back where the screen has one; on a tab screen the shell puts the avatar here
  // (shell.ts), and a build without accounts leaves it empty.
  const lead = createLeadSlot(options.tab);
  const back = element('button', 'screen-back', '‹');
  back.type = 'button';
  back.dataset['sound'] = 'back';
  back.setAttribute('aria-label', backLabel);
  back.addEventListener('click', onBack);
  back.hidden = options.tab !== undefined;
  lead.append(back);
  const heading = element('h1', 'screen-title', title);
  heading.tabIndex = -1;
  header.append(lead, heading);
  // The tools: the ? where the screen shows symbols, then the gear, always last (ADR 0087, amending
  // ADR 0040), so it never moves between screens. The legend opens under the row.
  const legend = options.legend === true ? createSymbolLegend() : undefined;
  if (legend !== undefined) header.append(legend.toggle);
  if (options.settings !== false) header.append(createSettingsToggle());
  if (legend !== undefined) header.append(legend.panel);
  return {
    element: header,
    focus: () => {
      heading.focus();
    },
    setTitle: (next) => {
      heading.textContent = next;
    },
    setBack: (shown) => {
      back.hidden = !shown;
    },
  };
}
