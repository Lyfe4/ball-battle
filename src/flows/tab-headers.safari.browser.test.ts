// The tab screens' headers on a phone (390 x 664, ADR 0081 addendum of 2026-11-24): the avatar,
// the tab's title and the gear last (ADR 0087), with no Back (the tab bar and the browser's Back lead away; Back
// from any tab is Play). Balls keeps its ?, which explains the matchup chart's marks. A screen
// opened from a tab (a ball's page, Profile) keeps its Back.
import { describe, expect, it } from 'vitest';
import { back, visible } from './page-support.ts';
import {
  avatarsShown,
  currentTab,
  follow,
  onScreen,
  openAs,
  tabLink,
} from './shell-routes-support.ts';

/** The header's controls and title on show, in order, by what they are. */
function header(): string[] {
  const head = visible('.screen-header').find(
    (node) => node.getClientRects().length > 0 && node.closest('[hidden]') === null,
  );
  if (head === undefined) return [];
  // The lead slot holds Back or the avatar (ADR 0087): read what it holds in its place.
  return [...head.children]
    .flatMap((node) => (node.matches('.screen-lead') ? [...node.children] : [node]))
    .filter((node) => node instanceof HTMLElement && node.getClientRects().length > 0)
    .map((node) => {
      if (node.matches('.account-toggle')) return 'avatar';
      if (node.matches('.screen-back')) return 'back';
      if (node.matches('.settings-toggle')) return 'gear';
      if (node.matches('.symbol-legend-toggle')) return '?';
      return node.textContent.trim();
    });
}

describe('the tab screens’ headers on a phone', () => {
  it('are the avatar, the title and the gear, with no Back; a screen opened from one has Back', async () => {
    await openAs({ online: true, accounts: true }, '');
    await onScreen('home');
    expect(header()).toStrictEqual(['avatar', 'BallBattle', 'gear']);
    tabLink('Balls').click();
    await onScreen('manual');
    expect(header()).toStrictEqual(['avatar', 'Balls', '?', 'gear']);
    expect(document.title).toBe('Balls · BallBattle');
    tabLink('Friends').click();
    await onScreen('friends');
    expect(header()).toStrictEqual(['avatar', 'Friends', 'gear']);
    tabLink('Ranks').click();
    await onScreen('ranks');
    expect(header()).toStrictEqual(['avatar', 'Ranks', 'gear']);
    // The browser's Back from any tab is Play (ADR 0081).
    await back();
    await onScreen('home');
    expect(currentTab()).toBe('Play');

    // Opened from a tab: a ball's page and Profile keep Back, and the avatar stays on the tabs.
    await follow('?view=manual&ball=vampire');
    expect(header()).toStrictEqual(['back', 'Vampire', '?', 'gear']);
    await back();
    await onScreen('home');
    avatarsShown()[0]?.click();
    await onScreen('profile');
    expect(visible('#online-profile .screen-back')).toHaveLength(1);
    await back();
    await onScreen('home');
  });
});
