// What an online screen says when a request fails (ADR 0052). "You're offline" only when the device
// is offline or the request got no response at all; a server too slow to answer, a failing one and
// a refusal each say so, and every one offers Try again. Pure words, no DOM.
import type { FailureKind } from '../app/api.ts';

export interface FailureText {
  readonly title: string;
  readonly body: string;
}

/** A failure's notice in place of a screen; a refusal shows the server's own reason. */
export function failureText(kind: FailureKind, reason?: string): FailureText {
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
