// The shell's tabs (ADR 0081): which a build shows, which screens wear the tab bar, and which tab
// a screen belongs to. Pure, so the rules are tested as tables.
import { ACCOUNTS_BUILD } from './accounts-build.ts';
import type { ScreenKey } from './history-rules.ts';
import { ONLINE_BUILD } from './online-build.ts';

export type TabId = 'play' | 'balls' | 'friends' | 'ranks';

export interface Tab {
  readonly id: TabId;
  readonly label: string;
  /** The screen it opens. */
  readonly screen: ScreenKey;
}

const ALL: readonly Tab[] = [
  { id: 'play', label: 'Play', screen: 'home' },
  { id: 'balls', label: 'Balls', screen: 'manual' },
  { id: 'friends', label: 'Friends', screen: 'friends' },
  { id: 'ranks', label: 'Ranks', screen: 'ranks' },
];

/** Play and Balls always; Friends with online play; Ranks only with accounts (previews, staging). */
export function tabsFor(online: boolean, accounts: boolean): readonly Tab[] {
  return ALL.filter(
    (tab) => (tab.id !== 'friends' || online) && (tab.id !== 'ranks' || (online && accounts)),
  );
}

export const TABS: readonly Tab[] = tabsFor(ONLINE_BUILD, ACCOUNTS_BUILD);

/**
 * The tab a screen is, if it is one: the bar shows on these screens alone. Never a match, a series,
 * a setup or lineup, a live room, sign-in, Profile or a ball's own page (ADR 0081: nothing over a
 * fight or a lineup pick; a screen opened from a tab has its own Back).
 */
export function tabOf(screen: ScreenKey, tabs: readonly Tab[] = TABS): TabId | undefined {
  return tabs.find((tab) => tab.screen === screen)?.id;
}
