// What Profile says (ADR 0081, 0087): who the player is, then the account's own actions as rows and,
// apart, the danger zone; for a guest, what signing in unlocks. The record (the stats card and
// Recent matches, ADR 0088) is a part the screen draws itself (profile-record.ts), as are the legal
// links. Pure, so every state is tested without a DOM.
import type { NoticeButton, NoticeContent } from '../ui/notice-content.ts';

/** What signing in unlocks, said on a guest's Profile and Friends tab. */
export const SIGN_IN_UNLOCKS =
  'Sign in to keep a name your friends see, your own friend code, and challenges that reach you anywhere.';

export interface AccountProfile {
  readonly username: string | null;
  readonly change: () => void;
  /** Log out and Delete account; absent where the screen offers neither. */
  readonly logOut?: () => Promise<unknown>;
  readonly deleteAccount?: () => void;
  /** Why the last Log out or Delete didn't work. */
  readonly problem?: string;
}

/**
 * The identity block's lines under the disc (profile.ts draws them): the @username and what
 * opponents see, or, before a username is chosen, what they see until then.
 */
export function identityLines(username: string | null): readonly string[] {
  return username === null
    ? ['Opponents see you as “Player” and a number until you choose a username.']
    : [`@${username}`, `Opponents see you as ${username}.`];
}

/**
 * An account's Profile: its name as the title, the identity block (the screen draws it from
 * `identityLines`), its actions as rows, then the danger zone.
 */
export function accountProfile(profile: AccountProfile): NoticeContent {
  // Rows (ADR 0087): changing the name is not the screen's primary, Log out a row; Delete account
  // apart in the danger zone. The stats card is the record's (ADR 0088), drawn by the screen.
  const more: NoticeButton[] = [
    {
      text: profile.username === null ? 'Choose a username' : 'Change username',
      onClick: profile.change,
      opens: true,
    },
  ];
  if (profile.logOut !== undefined) more.push({ text: 'Log out', onClick: profile.logOut });
  const danger: NoticeButton[] =
    profile.deleteAccount === undefined
      ? []
      : [{ text: 'Delete account', onClick: profile.deleteAccount }];
  return {
    title: profile.username ?? 'Your profile',
    body: [],
    buttons: [],
    more,
    danger,
    ...(profile.problem === undefined ? {} : { note: profile.problem }),
  };
}

export interface GuestProfile {
  readonly signIn: () => void;
  /** A guest on this device can be forgotten; nobody has nothing to forget. */
  readonly forgetMe?: () => void;
}

/** A guest's (or nobody's) Profile: playing on this device, and what signing in unlocks. */
export function guestProfile(profile: GuestProfile): NoticeContent {
  return {
    title: 'Guest',
    body: ['Playing on this device.', SIGN_IN_UNLOCKS],
    buttons: [{ text: 'Sign in', onClick: profile.signIn }],
    ...(profile.forgetMe === undefined
      ? {}
      : { danger: [{ text: 'Forget me on this device', onClick: profile.forgetMe }] }),
  };
}

/** `/me` didn't answer (offline, failing): nothing is claimed, and Try again asks again. */
export function unknownProfile(retry: () => Promise<unknown>): NoticeContent {
  return {
    title: 'Your profile',
    body: ['We couldn’t reach the server to see who you are. Check your connection and try again.'],
    buttons: [{ text: 'Try again', onClick: retry }],
  };
}
