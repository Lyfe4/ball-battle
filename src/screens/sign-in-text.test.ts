import { describe, expect, it } from 'vitest';
import type { NoticeContent, NoticeField } from '../ui/notice-content.ts';
import {
  adultSignInCard,
  chooseCard,
  codeCard,
  googleNote,
  signInOffCard,
  switchCard,
} from './sign-in-text.ts';

const nothing = () => Promise.resolve();
const none = () => undefined;
const email: NoticeField = { kind: 'email', label: 'Your email', onInput: none };
const code: NoticeField = { kind: 'code', label: 'The code', onInput: none };
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1';
const INSTAGRAM = `${SAFARI} Instagram 300.0`;

const choose = (google: boolean, emailCodes = true, userAgent = SAFARI) =>
  chooseCard({
    google,
    emailCodes,
    userAgent,
    email,
    sendCode: nothing,
    withGoogle: nothing,
    cancel: none,
  });

const codeSent = (resend: (() => Promise<unknown>) | undefined) =>
  codeCard({ email: 'a@b.co', code, verify: nothing, anotherEmail: none, resend });

const texts = (card: NoticeContent) => card.buttons.map((button) => button.text);

describe('the sign-in screen’s cards (ADR 0079)', () => {
  it('each has a way on (ADR 0027)', () => {
    const cards = [
      adultSignInCard(nothing, none),
      choose(true),
      choose(false),
      choose(true, false),
      codeSent(undefined),
      switchCard('email', nothing, nothing),
      signInOffCard(none),
    ];
    for (const card of cards) expect(card.buttons.length, card.title).toBeGreaterThan(0);
  });

  it('offers Google where it works, and says why not where it doesn’t', () => {
    expect(texts(choose(true))).toStrictEqual(['Email me a code', 'Continue with Google']);
    expect(texts(choose(false))).toStrictEqual(['Email me a code']);
    expect(choose(false).note).toMatch(/isn’t set up on this test copy/);
    expect(texts(choose(true, true, INSTAGRAM))).toStrictEqual(['Email me a code']);
    expect(googleNote(true, INSTAGRAM)).toBe(
      'Google sign-in doesn’t work inside Instagram: open this page in Safari to use it, or use an email code.',
    );
    expect(googleNote(true, SAFARI)).toBeUndefined();
  });

  it('offers only Google while email codes are off', () => {
    const card = choose(true, false);
    expect(card.field).toBeUndefined();
    expect(texts(card)).toStrictEqual(['Continue with Google', 'Not now']);
  });

  it('offers a new code only once a minute has passed', () => {
    expect(codeSent(undefined).quiet).toBeUndefined();
    expect(codeSent(undefined).note).toBe('You can ask for a new code in a minute.');
    expect(codeSent(nothing).quiet?.text).toBe('Send a new code');
  });

  it('says switching deletes the guest and merges nothing', () => {
    const card = switchCard('google', nothing, nothing);
    expect(card.title).toBe('This Google account has an account');
    expect(card.body.join(' ')).toMatch(/guest is deleted.*nothing moves to the account/);
    expect(texts(card)).toStrictEqual(['Switch to it', 'Stay as guest']);
  });
});

describe('a guest’s Forget me on the account screen (ADR 0079 addendum of 2026-11-22)', () => {
  it('ends the ways in with Forget me only for a guest, with codes on or off', () => {
    for (const emailCodes of [true, false]) {
      const guest = chooseCard({
        google: true,
        emailCodes,
        userAgent: SAFARI,
        email,
        sendCode: nothing,
        withGoogle: nothing,
        cancel: none,
        forgetMe: none,
      });
      expect(guest.more?.map((action) => action.text)).toStrictEqual(['Forget me']);
      expect(choose(true, emailCodes).more).toBeUndefined();
    }
  });
});
