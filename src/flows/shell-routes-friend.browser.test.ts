// The shell's URLs (ADR 0081) in production with vs Friend on and accounts off: Friends opens its
// screen, Profile and Ranks open home, and every online link keeps its screen.
import { describe, expect, it } from 'vitest';
import {
  expectHome,
  follow,
  LINKS,
  onScreen,
  openAs,
  placeholderTitle,
  pressPlaceholder,
  tabLabels,
} from './shell-routes-support.ts';

describe('the shell’s URLs online without accounts (production with vs Friend on)', () => {
  it('opens Friends, falls back to home for Profile and Ranks, and keeps every online link', async () => {
    await openAs({ online: true, accounts: false }, '?view=friends');
    await onScreen('friends');
    expect(placeholderTitle()).toBe('Friends');
    // Friends is a tab here; Ranks is not until accounts are on.
    expect(tabLabels()).toStrictEqual(['Play', 'Balls', 'Friends']);
    expect(document.title).toBe('Friends · BallBattle');
    // Its way on: challenging a friend with a link, which needs no account.
    await pressPlaceholder('Challenge a friend');
    await onScreen('send');
    for (const search of ['?view=profile', '?view=ranks', LINKS.google]) {
      await follow(search);
      await expectHome();
    }
    await follow(LINKS.challenge);
    await onScreen('challenge');
    await follow(LINKS.start);
    await onScreen('start');
    await follow(LINKS.online);
    await onScreen('online');
    expect(location.search).toBe(LINKS.online);
  });
});
