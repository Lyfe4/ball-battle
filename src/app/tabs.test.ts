import { describe, expect, it } from 'vitest';
import type { ScreenKey } from './history-rules.ts';
import { tabOf, tabsFor } from './tabs.ts';

/** Every screen key there is, so a new one must say whether it wears the bar. */
const SCREENS: Readonly<Record<ScreenKey, boolean>> = {
  home: true,
  manual: true,
  friends: true,
  ranks: true,
  'manual-entry': false,
  pick: false,
  match: false,
  'series-rules': false,
  'series-lineup': false,
  series: false,
  outdated: false,
  online: false,
  challenge: false,
  send: false,
  start: false,
  signin: false,
  profile: false,
};

describe('the shell’s tabs (ADR 0081)', () => {
  it('shows Play and Balls always, Friends with online play, Ranks only with accounts', () => {
    const labels = (online: boolean, accounts: boolean) =>
      tabsFor(online, accounts).map((tab) => tab.label);
    expect(labels(false, false)).toStrictEqual(['Play', 'Balls']);
    expect(labels(true, false)).toStrictEqual(['Play', 'Balls', 'Friends']);
    expect(labels(true, true)).toStrictEqual(['Play', 'Balls', 'Friends', 'Ranks']);
  });

  it('wears the bar on the tab screens alone: never a fight, a setup, a lineup or a live room', () => {
    const all = tabsFor(true, true);
    for (const [screen, wears] of Object.entries(SCREENS)) {
      expect(tabOf(screen as ScreenKey, all) !== undefined, screen).toBe(wears);
    }
    expect(tabOf('manual', all)).toBe('balls');
    expect(tabOf('home', all)).toBe('play');
  });

  it('keeps a tab’s screen bare in a build without that tab', () => {
    expect(tabOf('friends', tabsFor(false, false))).toBeUndefined();
    expect(tabOf('ranks', tabsFor(true, false))).toBeUndefined();
  });
});
