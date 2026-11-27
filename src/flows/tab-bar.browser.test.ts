// The shell's tab bar (ADR 0081) through the real page, in a build with accounts (all four tabs):
// on the tab screens and the screens browsed to from them, never over a task or a fight on a phone
// (ADR 0087); real links with
// the tab on show marked for screen readers; a tap, a key and Back as the rules say.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { RULESET_VERSION } from '../sim/ruleset.ts';
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

  it('shows on a screen browsed to, never on a task or a fight (a phone held upright)', async () => {
    // Browsed to from a tab (ADR 0087): the bar stays, the opener's tab lit.
    await follow('?view=manual&ball=vampire');
    expect(currentTab(), 'a ball').toBe('Balls');
    expect(document.body.dataset['shell']).toBe('browse');
    await follow('?view=profile');
    expect(tabBar(), 'Profile').toBeDefined();
    // Tasks and fights take the whole phone.
    const bare: readonly (readonly [string, string])[] = [
      ['?view=pick&a=storm&b=frost', 'task'],
      ['?mode=bo3', 'task'],
      ['?view=signin', 'task'],
      [LINKS.challenge, 'task'],
      // A match link made before versions: the older-link notice, a task.
      ['?a=storm&b=frost&seed=4', 'task'],
      [`?a=storm&b=frost&seed=4&v=${String(RULESET_VERSION)}`, 'fight'],
      // A lineup is a task (ADR 0087 addendum of 2026-11-26): no bar on a phone, the rail on a PC.
      ['?mode=bo3&fmt=reveal&step=lineup', 'task'],
      [LINKS.start, 'task'],
      // An online series the server refuses here: its notice in the fight's place, a task (a PC
      // keeps the rail; the arena never took over).
      [LINKS.online, 'task'],
    ];
    for (const [search, kind] of bare) {
      await follow(search);
      await settle();
      expect(tabBar(), search).toBeUndefined();
      expect(document.body.dataset['shell'], search).toBe(kind);
    }
    // And back on a tab screen, it returns.
    await follow('?view=manual&tab=chart');
    expect(currentTab()).toBe('Balls');
    expect(document.body.dataset['shell']).toBe('tab');
  });
});
