// The sign-in screen's words (ADR 0079), as notices: pure, so every state is tested without a DOM.
// Every card has a way on (ADR 0027). Nothing here says whether an address has an account until
// its code is checked.
import type { GoogleResult } from '../api/accounts.ts';
import { inAppBrowserOf } from '../app/in-app-browser.ts';
import type { NoticeButton, NoticeContent, NoticeField } from '../ui/notice-content.ts';
import { LEGAL_LINKS } from './online-challenge-text.ts';

/** The 16+ question on a device without a guest, before any sign-in (ADR 0052 section 6). */
export function adultSignInCard(confirm: () => unknown, cancel: () => void): NoticeContent {
  return {
    title: 'Sign in',
    body: [
      'Online play is for players 16 and over.',
      'Signing in keeps your games with your account, on any device. We keep your email address ' +
        '(and, with Google, your Google account id), your games, when you confirmed your age and ' +
        'the IP address you signed in from.',
      'By signing in you agree to the terms.',
    ],
    links: LEGAL_LINKS,
    buttons: [
      { text: 'I’m 16 or older', onClick: confirm },
      { text: 'Not now', onClick: cancel },
    ],
  };
}

/** Why Google isn't offered as a button here, if it isn't. */
export function googleNote(available: boolean, userAgent: string): string | undefined {
  if (!available) {
    return 'Google sign-in isn’t set up on this test copy of the game: use an email code.';
  }
  const app = inAppBrowserOf(userAgent);
  if (app === undefined) return undefined;
  const where = app.app === 'an app' ? 'inside an app' : `inside ${app.app}`;
  return `Google sign-in doesn’t work ${where}: open this page in ${app.ios ? 'Safari' : 'your browser'} to use it, or use an email code.`;
}

/** What a Google sign-in that didn't finish says, back on the sign-in screen. */
export const GOOGLE_PROBLEMS: Readonly<Partial<Record<GoogleResult, string>>> = {
  cancelled: 'Google sign-in was cancelled.',
  expired: 'That Google sign-in took too long or was interrupted: try again.',
  failed: 'Google sign-in didn’t work: try again, or use an email code.',
};

export interface ChooseCard {
  readonly google: boolean;
  readonly emailCodes: boolean;
  readonly userAgent: string;
  readonly email: NoticeField;
  readonly sendCode: () => Promise<unknown>;
  readonly withGoogle: () => Promise<unknown>;
  readonly cancel: () => void;
  /** Why the last try didn't work (a Google sign-in), above the choices. */
  readonly problem?: string;
  /** A guest's Forget me, quietly at the end (ADR 0079 addendum of 2026-11-22). */
  readonly forgetMe?: () => void;
  /**
   * The check's box under the email field, reserved at the widget's size (ADR 0079 addendum of
   * 2026-11-28): an element, typed opaquely as a notice's part is.
   */
  readonly captcha?: object;
}

/** The ways in: an email code, and Google where it works. */
export function chooseCard(card: ChooseCard): NoticeContent {
  const note = googleNote(card.google, card.userAgent);
  const google: NoticeButton[] =
    note === undefined ? [{ text: 'Continue with Google', onClick: card.withGoogle }] : [];
  const body = [
    ...(card.problem === undefined ? [] : [card.problem]),
    'Keep your games, and play as you on any device.',
  ];
  const more =
    card.forgetMe === undefined ? {} : { danger: [{ text: 'Forget me', onClick: card.forgetMe }] };
  if (!card.emailCodes) {
    return {
      title: 'Sign in',
      body: [...body, 'Email codes are off for now.'],
      buttons: [...google, { text: 'Not now', onClick: card.cancel }],
      ...(note === undefined ? {} : { note }),
      ...more,
    };
  }
  return {
    title: 'Sign in',
    body,
    field: card.email,
    ...(card.captcha === undefined ? {} : { part: card.captcha }),
    buttons: [{ text: 'Email me a code', onClick: card.sendCode }, ...google],
    ...(note === undefined ? {} : { note }),
    quiet: { text: 'Not now', onClick: card.cancel },
    ...more,
  };
}

export interface CodeCard {
  readonly email: string;
  readonly code: NoticeField;
  readonly verify: () => Promise<unknown>;
  readonly anotherEmail: () => void;
  /** Sending again, once a minute has passed (Auth sends at most one a minute). */
  readonly resend: (() => Promise<unknown>) | undefined;
}

/** The code just sent. */
export function codeCard(card: CodeCard): NoticeContent {
  return {
    title: 'Check your email',
    body: [
      `We sent a 6-digit code to ${card.email}. It works for 10 minutes.`,
      'No email? Look in spam or promotions.',
    ],
    field: card.code,
    buttons: [
      { text: 'Sign in', onClick: card.verify },
      { text: 'Use another email', onClick: card.anotherEmail },
    ],
    ...(card.resend === undefined
      ? { note: 'You can ask for a new code in a minute.' }
      : { quiet: { text: 'Send a new code', onClick: card.resend } }),
  };
}

/**
 * The check before a first code didn't load, or Cloudflare refused this browser (ADR 0079 addendum
 * of 2026-11-28): the one failure card, Try again back to the ways in with a new check.
 */
export function captchaFailedCard(
  retry: () => Promise<unknown>,
  cancel: () => void,
): NoticeContent {
  return {
    title: 'We couldn’t check you’re a person',
    body: ['The check before sending a code didn’t work. Try again, or continue with Google.'],
    buttons: [
      { text: 'Try again', onClick: retry },
      { text: 'Not now', onClick: cancel },
    ],
  };
}

/** An email or a Google account that already has an account: switch to it, or stay. */
export function switchCard(
  via: 'email' | 'google',
  switchTo: () => Promise<unknown>,
  stay: () => Promise<unknown>,
): NoticeContent {
  return {
    title: via === 'email' ? 'This email has an account' : 'This Google account has an account',
    body: [
      'Switch to it? This device’s guest is deleted: its finished games stay in your opponents’ ' +
        'history as “Deleted player”, and nothing moves to the account.',
    ],
    buttons: [
      { text: 'Switch to it', onClick: switchTo },
      { text: 'Stay as guest', onClick: stay },
    ],
  };
}

/** Accounts aren't on here (the switch went off after the page loaded). */
export function signInOffCard(home: () => void): NoticeContent {
  return {
    title: 'Sign-in isn’t on here',
    body: [
      'Signing in isn’t switched on for this copy of the game. You can still play as a guest.',
    ],
    buttons: [{ text: 'Home', onClick: home }],
  };
}
