// The shell's tab bar (ADR 0081) through the real page, in a build with accounts (all four tabs):
// on the tab screens alone, never over a fight, a setup, a lineup or a live room; real links with
// the tab on show marked for screen readers; a tap, a key and Back as the rules say.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { settle, until } from './page-support.ts';
import {
  currentTab,
  follow,
  LINKS,
  onScreen,
  openAs,
  screenOn,
  tabBar,
  tabLabels,
  tabLink,
} from './shell-routes-support.ts';

describe('the tab bar', () => {
  it('is real links in a named nav, the tab on show marked, each with an empty badge slot', async () => {
    await openAs({ online: true, accounts: true }, '');
    await onScreen('home');
    const nav = tabBar();
    expect(nav?.getAttribute('aria-label')).toBe('Main');
    expect(tabLabels()).toStrictEqual(['Play', 'Balls', 'Friends', 'Ranks']);
    expect(currentTab()).toBe('Play');
    for (const label of tabLabels()) {
      const link = tabLink(label);
      expect(link.getAttribute('href'), label).not.toBeNull();
      expect(link.querySelector('.tab-bar-badge')?.hasAttribute('hidden'), label).toBe(true);
    }
    expect(tabLink('Balls').href).toMatch(/\?view=manual$/);
    expect(tabLink('Play').href).not.toContain('?');
  });

  it('moves by tap and by key, marks each tab, and Back from any tab lands on Play', async () => {
    tabLink('Balls').click();
    await onScreen('manual');
    expect(currentTab()).toBe('Balls');
    tabLink('Friends').click();
    await onScreen('friends');
    expect(currentTab()).toBe('Friends');
    // The keyboard: a tab is focusable and Enter follows it.
    tabLink('Ranks').focus();
    expect(document.activeElement).toBe(tabLink('Ranks'));
    await userEvent.keyboard('{Enter}');
    await onScreen('ranks');
    expect(currentTab()).toBe('Ranks');
    // Tabs above Play are one step: Back from any of them goes to Play.
    history.back();
    await until(() => screenOn() === 'home', 5_000, 'Play after Back', false);
    expect(currentTab()).toBe('Play');
  });

  it('never shows over a fight, a setup, a lineup, a ball’s page or a live room', async () => {
    const bare = [
      '?view=manual&ball=vampire',
      '?view=pick&a=storm&b=frost',
      '?a=storm&b=frost&seed=4',
      '?mode=bo3',
      '?mode=bo3&fmt=reveal&step=lineup',
      '?view=profile',
      '?view=signin',
      LINKS.send,
      LINKS.challenge,
      LINKS.start,
      LINKS.online,
    ];
    for (const search of bare) {
      await follow(search);
      await settle();
      expect(tabBar(), search).toBeUndefined();
      expect(document.body.hasAttribute('data-tabs'), search).toBe(false);
    }
    // And back on a tab screen, it returns.
    await follow('?view=manual&tab=chart');
    expect(currentTab()).toBe('Balls');
    expect(document.body.hasAttribute('data-tabs')).toBe(true);
  });
});
