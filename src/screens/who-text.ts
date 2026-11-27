// What "Who do you want to play?" says (ADR 0089, its addendum of 2026-11-27): the rules it sends
// on, its groups, each friend's line (what picking them starts, or why they can't be picked), the
// way to anyone with a link, the one button's words for what is picked, and the empty state. Pure,
// so every state is tested without a DOM. Accounts code: a build without accounts holds none.
import type { FriendEntry } from '../api/friends.ts';
import type { FriendSetup } from '../app/modes.ts';
import { setupLine } from '../ui/modes-text.ts';

export const WHO_TITLE = 'Who do you want to play?';
/** How many friends not online show before "Show all". */
export const OTHERS_SHOWN = 3;
export const LINK_ROW = 'Send a link instead';
export const LINK_ROW_LINE = 'Anyone with it can join';
export const NO_FRIENDS = 'No friends yet. Add one by username or code, or send anyone a link.';
export const ADD_FRIEND = 'Add a friend';
export const SIGN_IN = 'Sign in';
export const SIGN_IN_LINE = 'to challenge friends in the game.';
/** The button with nothing picked yet: it says what to do, and does nothing. */
export const PICK_FIRST = 'Choose who to play';

/** How a pick is played: live now, or by turns (ADR 0085). */
export type How = 'live' | 'turns';

/** What the sheet sends: a friend (live or by turns), or a link to anyone. */
export type WhoPick =
  | { readonly kind: 'friend'; readonly friend: FriendEntry; readonly how: How }
  | { readonly kind: 'link' };

/** The rules the challenge goes on, from Play's box: "Live · Best of 3 · Reveal". */
export function rulesLine(setup: FriendSetup): string {
  return `${setup.turns ? 'By turns' : 'Live'} · ${setupLine(setup.format, setup.bestOf)}`;
}

/** The online group's title: "Online · 2". */
export const onlineTitle = (count: number): string => `Online · ${String(count)}`;

/** The rest's title: "Not online" under the online ones, else "Friends · 3". */
export function othersTitle(anyOnline: boolean, count: number): string {
  return anyOnline ? 'Not online' : `Friends · ${String(count)}`;
}

export const showAll = (count: number): string => `Show all ${String(count)} friends`;

/**
 * How a friend can be played on these rules, or undefined when they can't now. By turns works any
 * time; live needs them online, else by turns where the build plays by turns (`turns`).
 */
export function howFor(
  friend: Pick<FriendEntry, 'status'>,
  setup: FriendSetup,
  turns: boolean,
): How | undefined {
  if (turns && setup.turns) return 'turns';
  if (friend.status === 'online') return 'live';
  return turns ? 'turns' : undefined;
}

/** A friend's line in the sheet: their status and what picking them starts, or why not. */
export function friendLine(
  friend: Pick<FriendEntry, 'status'>,
  how: How | undefined,
  setup: FriendSetup,
): string {
  const status =
    friend.status === 'online'
      ? 'Online'
      : friend.status === 'in_a_match'
        ? 'In a match'
        : 'Not online';
  if (how === undefined) {
    return friend.status === 'in_a_match' ? `${status} · try again after it` : status;
  }
  // Live asked for, but they aren't online: said, so by turns is never a surprise.
  if (how === 'turns' && !setup.turns) return `${status} · by turns instead`;
  return `${status} · ${how === 'live' ? 'live' : 'by turns'}`;
}

/** The one button's words for what is picked (nothing picked: what to do). */
export function sendWords(pick: WhoPick | undefined): string {
  if (pick === undefined) return PICK_FIRST;
  if (pick.kind === 'link') return 'Send a link';
  return pick.how === 'live'
    ? `Challenge ${pick.friend.name}`
    : `Play ${pick.friend.name} by turns`;
}

/** The button's name for a screen reader: what it does, on which rules. */
export function sendSpoken(pick: WhoPick | undefined, setup: FriendSetup): string {
  if (pick === undefined) return `${PICK_FIRST}: pick a friend or a link first`;
  const rules = setupLine(setup.format, setup.bestOf);
  if (pick.kind === 'link') return `Send a link, ${rulesLine(setup)}`;
  return pick.how === 'live'
    ? `Challenge ${pick.friend.name} live, ${rules}`
    : `Play ${pick.friend.name} by turns, ${rules}`;
}

/**
 * The friends in the sheet's order: the online ones first, then the rest; in each, the friend
 * last picked first (`first`), then as the inbox lists them.
 */
export function whoOrder(
  friends: readonly FriendEntry[],
  first: string | undefined,
): { readonly online: FriendEntry[]; readonly others: FriendEntry[] } {
  const ordered = [...friends].sort((a, b) => Number(b.id === first) - Number(a.id === first));
  return {
    online: ordered.filter((friend) => friend.status === 'online'),
    others: ordered.filter((friend) => friend.status !== 'online'),
  };
}
