// The shell's URLs (ADR 0081) in production with vs Friend on and accounts off: Friends opens its
// tab (the link card, and friends lists on the way, with no Sign in), Profile and Ranks open home,
// and every online link keeps its screen.
import { describe, expect, it } from 'vitest';
import {
  avatarsShown,
  expectHome,
  follow,
  LINKS,
  onScreen,
  openAs,
  placeholderTitle,
  tabLabels,
} from './shell-routes-support.ts';
import { button, visible } from './page-support.ts';

describe('the shell’s URLs online without accounts (production with vs Friend on)', () => {
  it('opens Friends, falls back to home for Profile and Ranks, and keeps every online link', async () => {
    await openAs({ online: true, accounts: false }, '?view=friends');
    await onScreen('friends');
    expect(placeholderTitle()).toBeUndefined();
    expect(visible('#online-friends .friends-card-title').map((t) => t.textContent)).toStrictEqual([
      'Play a friend with a link',
      'Friends lists are on the way',
    ]);
    expect(visible('#online-friends button').map((b) => b.textContent)).not.toContain('Sign in');
    // Friends is a tab here; Ranks is not until accounts are on.
    expect(tabLabels()).toStrictEqual(['Play', 'Balls', 'Friends']);
    expect(document.title).toBe('Friends · BallBattle');
    // No accounts, no avatar: not in the header, not on the rail (ADR 0081).
    expect(document.querySelectorAll('.account-toggle')).toHaveLength(0);
    expect(avatarsShown()).toHaveLength(0);
    // Its way on: challenging a friend with a link, which needs no account.
    button('Challenge with a link').click();
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
