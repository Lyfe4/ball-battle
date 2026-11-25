import { describe, expect, it } from 'vitest';
import type { ScreenKey } from './history-rules.ts';
import { shellOf, tabOf, tabsFor, type ShellKind } from './tabs.ts';

/**
 * Every screen key there is and its shell (ADR 0087), so a new one must say: the bar on a phone for
 * a tab or browse screen, the rail beside and on a desktop for all but a fight.
 */
const SCREENS: Readonly<Record<ScreenKey, ShellKind>> = {
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
  'series-lineup': 'task',
  start: 'task',
  match: 'fight',
  series: 'fight',
  online: 'fight',
};

describe('the shell’s tabs (ADR 0081)', () => {
  it('shows Play and Balls always, Friends with online play, Ranks only with accounts', () => {
    const labels = (online: boolean, accounts: boolean) =>
      tabsFor(online, accounts).map((tab) => tab.label);
    expect(labels(false, false)).toStrictEqual(['Play', 'Balls']);
    expect(labels(true, false)).toStrictEqual(['Play', 'Balls', 'Friends']);
    expect(labels(true, true)).toStrictEqual(['Play', 'Balls', 'Friends', 'Ranks']);
  });

  it('gives every screen its shell: tab, browse, task or fight', () => {
    const all = tabsFor(true, true);
    for (const [screen, kind] of Object.entries(SCREENS)) {
      expect(tabOf(screen as ScreenKey, all) !== undefined, screen).toBe(kind === 'tab');
      expect(shellOf(screen as ScreenKey, all), screen).toBe(kind);
    }
    expect(tabOf('manual', all)).toBe('balls');
    expect(tabOf('home', all)).toBe('play');
  });

  it('makes a fight’s screen a task while it shows a notice instead of its fight', () => {
    const all = tabsFor(true, true);
    expect(shellOf('online', all, true)).toBe('task');
    expect(shellOf('online', all, false)).toBe('fight');
    // Only a fight changes: a notice on a tab or a task is that screen's own.
    expect(shellOf('home', all, true)).toBe('tab');
    expect(shellOf('signin', all, true)).toBe('task');
  });

  it('keeps a tab’s screen bare in a build without that tab', () => {
    expect(tabOf('friends', tabsFor(false, false))).toBeUndefined();
    expect(tabOf('ranks', tabsFor(true, false))).toBeUndefined();
    expect(shellOf('ranks', tabsFor(true, false))).toBe('task');
  });
});
