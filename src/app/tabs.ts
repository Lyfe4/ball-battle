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

/**
 * What the shell is around a screen (ADR 0087): a tab screen; a screen browsed to from one (a
 * ball's page, Profile); a task that needs the room (a setup, sign-in, a challenge, a notice); or a
 * fight, where the arena takes over (a lineup, a match, a series, a live room, a start's lineup).
 */
export type ShellKind = 'tab' | 'browse' | 'task' | 'fight';

const KINDS: Readonly<Record<ScreenKey, ShellKind>> = {
  home: 'tab',
  manual: 'tab',
  friends: 'tab',
  ranks: 'tab',
  'manual-entry': 'browse',
  profile: 'browse',
  pick: 'task',
  'series-rules': 'task',
  send: 'task',
  challenge: 'task',
  signin: 'task',
  outdated: 'task',
  match: 'fight',
  'series-lineup': 'fight',
  series: 'fight',
  online: 'fight',
  start: 'fight',
};

/**
 * The shell's kind for `screen`. The bar shows on a phone held upright for a tab or browse screen;
 * the rail beside and on a desktop for every kind but a fight (ADR 0087, amending ADR 0081: on a PC
 * the rail leaves only when the arena takes over). A tab's screen in a build without that tab never
 * shows (its URL opens Play), so it counts as a task.
 */
export function shellOf(screen: ScreenKey, tabs: readonly Tab[] = TABS): ShellKind {
  const kind = KINDS[screen];
  return kind === 'tab' && tabOf(screen, tabs) === undefined ? 'task' : kind;
}
