// The shell's URLs (ADR 0081) in a build with accounts (previews, staging): Friends, Profile and
// Ranks open their screens, each with a way on and Back to Play, and every older URL keeps its
// screen, Google's sign-in return included.
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
  screenOn,
} from './shell-routes-support.ts';

describe('the shell’s URLs with accounts (previews, staging)', () => {
  it('opens each shell screen, and Back from one reached by a link puts Play in its place', async () => {
    await openAs({ online: true, accounts: true }, '?view=ranks');
    await onScreen('ranks');
    expect(placeholderTitle()).toBe('Ranks');
    button('Back').click();
    await expectHome();

    // Profile (PR 5): nobody on this device, so the guest's Profile, with Sign in.
    await follow('?view=profile');
    await onScreen('profile');
    await until(() => visible('#online-profile h1')[0]?.textContent === 'Guest', 5_000, 'Profile');
    expect(placeholderTitle()).toBeUndefined();
    button('Sign in').click();
    await onScreen('signin');

    await follow('?view=friends');
    await onScreen('friends');
    expect(placeholderTitle()).toBe('Friends');
    await follow('?view=ranks');
    await pressPlaceholder('Play');
    await expectHome();
  });

  it('keeps every older URL: Google’s return, a challenge, a start and a series', async () => {
    await follow(LINKS.google);
    expect(screenOn()).toBe('signin');
    // The result is read once and dropped from the address (sign-in.ts).
    await until(
      () => new URLSearchParams(location.search).get('google') === null,
      5_000,
      'Google’s result to be read',
      false,
    );
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
