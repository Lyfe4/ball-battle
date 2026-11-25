import { describe, expect, it } from 'vitest';
import { accountProfile, guestProfile, unknownProfile } from './profile-text.ts';

const nothing = () => undefined;
const words = (buttons: readonly { text: string }[] | undefined) => buttons?.map((b) => b.text);

describe('Profile’s words (ADR 0081, 0087)', () => {
  it('names an account by its username; Change username and Log out as rows, Delete account apart', () => {
    const card = accountProfile({
      username: 'robin_b',
      change: nothing,
      logOut: () => Promise.resolve(),
      deleteAccount: nothing,
    });
    expect(card.title).toBe('robin_b');
    expect(card.body).toStrictEqual(['@robin_b · Opponents see you as robin_b.']);
    // No stats card until it has one real number, and no yellow primary for the name (ADR 0087).
    expect(card.part).toBeUndefined();
    expect(card.buttons).toStrictEqual([]);
    expect(words(card.more)).toStrictEqual(['Change username', 'Log out']);
    expect(words(card.danger)).toStrictEqual(['Delete account']);
  });

  it('asks an account without a username to choose one, and says why the last action failed', () => {
    const card = accountProfile({ username: null, change: nothing, problem: 'You’re offline' });
    expect(card.title).toBe('Your profile');
    expect(words(card.more)).toStrictEqual(['Choose a username']);
    expect(card.danger).toStrictEqual([]);
    expect(card.note).toBe('You’re offline');
  });

  it('tells a guest what signing in unlocks, with Sign in, and Forget me in the danger zone', () => {
    const guest = guestProfile({ signIn: nothing, forgetMe: nothing });
    expect(guest.title).toBe('Guest');
    expect(guest.body[0]).toBe('Playing on this device.');
    expect(guest.body[1]).toContain('Sign in to keep a name your friends see');
    expect(words(guest.buttons)).toStrictEqual(['Sign in']);
    expect(words(guest.danger)).toStrictEqual(['Forget me on this device']);
    // Nobody on this device: nothing to forget.
    expect(guestProfile({ signIn: nothing }).danger).toBeUndefined();
  });

  it('claims nothing while who this is isn’t known, and offers Try again', () => {
    const card = unknownProfile(() => Promise.resolve());
    expect(words(card.buttons)).toStrictEqual(['Try again']);
    expect(card.title).toBe('Your profile');
  });
});
