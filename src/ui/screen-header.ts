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
   * The tab this screen is, if it is one (ADR 0081): it has no Back (addendum of 2026-11-24), the
   * tab bar and the browser's Back leading away, and its lead slot shows the game's mark on a phone
   * held upright, where no rail shows it (ADR 0087 addendum of 2026-11-26); the shell puts the
   * avatar before its tools (shell.ts). `setBack` shows Back on a screen opened from it.
   */
  readonly tab?: TabId;
  /**
   * The title where the rail shows (beside, a desktop), if it differs: Play is "Play" there, the
   * rail's mark already saying BallBattle.
   */
  readonly railTitle?: string;
}

/**
 * The lead slot of a header row: one tap target wide whether it holds Back, the game's mark (a tab
 * screen's on a phone, `data-tab-head`) or nothing.
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
  // The game's mark on a tab screen, where no rail shows it (screen-header.css): decoration.
  const mark = options.tab === undefined ? undefined : element('img', 'screen-mark');
  if (mark !== undefined) {
    mark.src = '/favicon.svg';
    mark.alt = '';
    mark.setAttribute('aria-hidden', 'true');
    lead.append(mark);
  }
  const heading = element('h1', 'screen-title');
  heading.tabIndex = -1;
  // One heading; where the rail shows it may read otherwise (Play), the other words hidden.
  const phoneTitle = element('span', 'screen-title-phone', title);
  if (options.railTitle === undefined) heading.append(phoneTitle);
  else heading.append(phoneTitle, element('span', 'screen-title-rail', options.railTitle));
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
      phoneTitle.textContent = next;
    },
    setBack: (shown) => {
      back.hidden = !shown;
      if (mark !== undefined) mark.hidden = shown;
    },
  };
}
