// The shell's URLs (ADR 0081) in a build with accounts (previews, staging): Friends, Profile and
// Ranks open their screens, each with a way on and the tab bar back to Play, and every older URL
// keeps its screen, Google's sign-in return included.
import { describe, expect, it } from 'vitest';
import { button, until, visible } from './page-support.ts';
import {
  expectHome,
  follow,
  LINKS,
  onScreen,
  openAs,
  placeholderTitle,
  pressPlaceholder,
  tabLink,
} from './shell-routes-support.ts';

describe('the shell’s URLs with accounts (previews, staging)', () => {
  it('opens each shell screen, and Back from one reached by a link puts Play in its place', async () => {
    await openAs({ online: true, accounts: true }, '?view=ranks');
    await onScreen('ranks');
    // Ranks (PR 9, ADR 0090 D5): one card, coming soon, plainly, with a way on.
    expect(placeholderTitle()).toBe('Ranks');
    expect(visible('#shell-screen .soon-card-title').map((t) => t.textContent)).toStrictEqual([
      'Ranked is coming',
    ]);
    expect(visible('#shell-screen .soon-sticker')).toHaveLength(1);
    expect(visible('#shell-screen .soon-card-line')[0]?.textContent).toBe(
      'Until then, play a friend.',
    );
    // A tab has no Back of its own (ADR 0081 addendum of 2026-11-24): the Play tab leads home.
    expect(visible('#shell-screen .screen-back')).toHaveLength(0);
    tabLink('Play').click();
    await expectHome();

    // Profile (PR 5): nobody on this device, so the guest's Profile, with Sign in.
    await follow('?view=profile');
    await onScreen('profile');
    await until(() => visible('#online-profile h1')[0]?.textContent === 'Guest', 5_000, 'Profile');
    expect(placeholderTitle()).toBeUndefined();
    button('Sign in').click();
    await onScreen('signin');

    // Friends (PR 6): nobody on this device, so the link card first, then Sign in's card.
    await follow('?view=friends');
    await onScreen('friends');
    await until(
      () => visible('#online-friends .friends-card-title').length === 2,
      5_000,
      'the Friends tab',
    );
    expect(visible('#online-friends .friends-card-title').map((t) => t.textContent)).toStrictEqual([
      'Play a friend with a link',
      'Sign in to keep friends',
    ]);
    await follow('?view=ranks');
    await pressPlaceholder('Play a friend now');
    // The one vs Friend path (ADR 0089 addendum): Play, its box on vs Friend, nothing sent.
    await onScreen('home');
    expect(visible('.play-box-who')[0]?.textContent).toBe('vs Friend');
  });

  it('keeps every older URL: Google’s return, a challenge, a start and a series', async () => {
    // Google's return opens sign-in, which reads the result once and drops it from the address
    // (sign-in.ts); signed in, the player lands on the Friends tab (ADR 0081).
    await follow(LINKS.google);
    await onScreen('friends');
    expect(new URLSearchParams(location.search).get('google')).toBeNull();
    await follow(LINKS.challenge);
    await onScreen('challenge');
    await follow(LINKS.start);
    await onScreen('start');
    await follow(LINKS.online);
    await onScreen('online');
    await follow('?view=manual');
    await onScreen('manual');
  });
});
