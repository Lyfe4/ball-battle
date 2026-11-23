// What Profile says (ADR 0081): who the player is, a stats card marked "Coming soon", then the
// account's own actions, or for a guest what signing in unlocks. Pure, so every state is tested
// without a DOM; the stats card and the legal links are parts the screen draws itself.
import type { NoticeButton, NoticeContent } from '../ui/notice-content.ts';

/** The stats Profile will show once the server keeps them; until then, dashes. */
export const PROFILE_STATS = ['Online wins', 'Matches', 'Favourite ball'] as const;

/** What signing in unlocks, said on a guest's Profile and Friends tab. */
export const SIGN_IN_UNLOCKS =
  'Sign in to keep a name your friends see, your own friend code, and challenges that reach you anywhere.';

export interface AccountProfile {
  readonly username: string | null;
  readonly stats: object;
  readonly change: () => void;
  /** Log out and Delete account; absent where the screen offers neither. */
  readonly logOut?: () => Promise<unknown>;
  readonly deleteAccount?: () => void;
  /** Why the last Log out or Delete didn't work. */
  readonly problem?: string;
}

/** An account's Profile: its name and @username, the stats to come, then its actions. */
export function accountProfile(profile: AccountProfile): NoticeContent {
  const more: NoticeButton[] = [];
  if (profile.logOut !== undefined) more.push({ text: 'Log out', onClick: profile.logOut });
  if (profile.deleteAccount !== undefined) {
    more.push({ text: 'Delete account', onClick: profile.deleteAccount });
  }
  return {
    title: profile.username ?? 'Your profile',
    body: [
      profile.username === null
        ? 'Opponents see you as “Player” and a number until you choose a username.'
        : `@${profile.username} · Opponents see you as ${profile.username}.`,
    ],
    part: profile.stats,
    buttons: [
      {
        text: profile.username === null ? 'Choose a username' : 'Change username',
        onClick: profile.change,
      },
    ],
    more,
    ...(profile.problem === undefined ? {} : { note: profile.problem }),
  };
}

export interface GuestProfile {
  readonly stats: object;
  readonly signIn: () => void;
  /** A guest on this device can be forgotten; nobody has nothing to forget. */
  readonly forgetMe?: () => void;
}

/** A guest's (or nobody's) Profile: playing on this device, and what signing in unlocks. */
export function guestProfile(profile: GuestProfile): NoticeContent {
  return {
    title: 'Guest',
    body: ['Playing on this device.', SIGN_IN_UNLOCKS],
    part: profile.stats,
    buttons: [{ text: 'Sign in', onClick: profile.signIn }],
    ...(profile.forgetMe === undefined
      ? {}
      : { more: [{ text: 'Forget me on this device', onClick: profile.forgetMe }] }),
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
