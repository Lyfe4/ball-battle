// What an online screen says when a request fails (ADR 0052). "You're offline" only when the device
// is offline or the request got no response at all; a server too slow to answer, a failing one and
// a refusal each say so, and every one offers Try again. Pure words, no DOM.
import type { ErrorCode } from '../api/errors.ts';
import type { FailureKind } from '../app/api.ts';

export interface FailureText {
  readonly title: string;
  readonly body: string;
}

/**
 * The challenge flow's refusals in the game's words (ADR 0086): a page never shows the server's
 * sentence for these. Every 4xx the challenge services can answer has one (a test reads them).
 */
export const CHALLENGE_REFUSALS: Readonly<Partial<Record<ErrorCode, FailureText>>> = {
  in_a_match: { title: 'You’re in a match already', body: 'One live match at a time.' },
  their_challenge_waiting: {
    title: 'They challenged you already',
    body: 'Answer their challenge in Friends, under Waiting for you.',
  },
  playing_together: {
    title: 'You have a game together',
    body: 'Finish your game by turns first, then challenge them again.',
  },
  challenge_taken: {
    title: 'Someone got there first',
    body: 'Another player took this challenge.',
  },
  challenge_stopped: {
    title: 'They stopped waiting',
    body: 'Send them a challenge of your own.',
  },
  challenge_expired: {
    title: 'This challenge ran out',
    body: 'A link lasts 7 days. Ask your friend for a new one.',
  },
  own_challenge: { title: 'This is your own link', body: 'Send it to a friend to play.' },
  too_many_series: {
    title: 'You have enough games going',
    body: 'Finish one, or let a link run out, then try again.',
  },
  friend_blocked: {
    title: 'You blocked this player',
    body: 'Unblock them in Friends to play them.',
  },
  not_found: {
    title: 'That challenge is gone',
    body: 'The link may be mistyped, or that friend is gone.',
  },
  not_an_account: { title: 'Sign in first', body: 'Challenging a friend needs your account.' },
  accounts_off: { title: 'Friends are on the way', body: 'Until then, a link works for anyone.' },
  bad_request: {
    title: 'That didn’t work',
    body: 'Something about this challenge wasn’t right. Try again from the start.',
  },
};

/**
 * A failure's notice in place of a screen. A refusal says the game's own words where its code has
 * them (`CHALLENGE_REFUSALS`), else the server's reason, under a title of ours.
 */
export function failureText(kind: FailureKind, reason?: string, code?: ErrorCode): FailureText {
  const known = kind === 'refused' && code !== undefined ? CHALLENGE_REFUSALS[code] : undefined;
  if (known !== undefined) return known;
  switch (kind) {
    case 'offline':
      return {
        title: 'You’re offline',
        body: 'Online play needs a connection. Your series are safe on the server until you’re back.',
      };
    case 'timeout':
      return {
        title: 'No answer yet',
        body: 'The server is taking too long to answer. Try again in a moment.',
      };
    case 'error':
      return {
        title: 'Something went wrong',
        body: 'The server couldn’t answer just now. Try again in a moment.',
      };
    case 'refused':
      return { title: 'That didn’t work', body: reason ?? 'The server turned this down.' };
  }
}

/** One line for a failure where a whole notice won't fit (settings' Forget me). */
export function failureLine(kind: FailureKind, reason?: string): string {
  switch (kind) {
    case 'offline':
      return 'You’re offline: try again when you’re back.';
    case 'timeout':
      return 'The server is taking too long to answer: try again in a moment.';
    case 'error':
      return 'The server couldn’t answer just now: try again in a moment.';
    case 'refused':
      return reason ?? 'The server turned this down.';
  }
}
