// The Friends tab's words (ADR 0079, PR (c); ADR 0081): pure, so every state is tested without a
// DOM.
import type {
  AddFriendResponse,
  FriendStatus,
  FriendsResponse,
  InboxResponse,
  Invite,
} from '../api/friends.ts';
import { challengeLine } from './online-text.ts';

/** One group of the list: its heading, and what each row's actions say. */
export interface FriendGroup {
  readonly key: 'incoming' | 'friends' | 'outgoing';
  readonly title: string;
}

/** What waits on the player first, then friends, then the requests sent (ADR 0081). */
export const FRIEND_GROUPS: readonly FriendGroup[] = [
  { key: 'incoming', title: 'Waiting for you' },
  { key: 'friends', title: 'Friends' },
  { key: 'outgoing', title: 'Sent' },
];

/** What the list says when it holds nobody. */
export const NO_FRIENDS = 'No friends yet. Share your code, or add theirs.';

/** The line under Add after a request: sent, or friends at once. */
export function addedLine(answer: AddFriendResponse): string {
  return answer.outcome === 'friends'
    ? `You and ${answer.name} are friends now.`
    : `Request sent to ${answer.name}.`;
}

/** Whether the list holds anybody. */
export function hasAnyone(list: FriendsResponse): boolean {
  return list.friends.length + list.incoming.length + list.outgoing.length > 0;
}

/** Remove, asked in place: the row's question. */
export const removeQuestion = (name: string) => `Remove ${name}?`;

/** A friend's status in words, beside its dot (PR (d)). */
export const STATUS_WORDS: Readonly<Record<FriendStatus, string>> = {
  online: 'Online',
  in_a_match: 'In a match',
  offline: 'Offline',
};

/** A friend's live challenge on the floating card: who, and what is played. */
export function inviteLine(invite: Invite): string {
  return `${invite.from} challenges you · ${challengeLine(invite)} · live`;
}

/** The tab's way to play anyone, with or without an account (ADR 0081). */
export const LINK_CARD = {
  title: 'Play a friend with a link',
  body: 'Send a link; they open it and you pick lineups together. No account needed.',
  button: 'Challenge with a link',
} as const;

/** A guest's card: what signing in unlocks, with Sign in (never a wall: the link card leads). */
export const SIGN_IN_CARD = {
  title: 'Sign in to keep friends',
  unlocks: [
    'Your own friend code',
    'See who’s online',
    'Challenges that reach you anywhere in the game',
  ],
  button: 'Sign in',
  note: 'Free. Your games so far stay yours.',
} as const;

/** A build with online play and no accounts (production today). */
export const FRIENDS_SOON = {
  title: 'Friends lists are on the way',
  body: 'Soon you can add friends by a code and see who’s online. Until then, a link works for anyone.',
} as const;

const counted = (count: number, one: string, many: string) =>
  `${String(count)} ${count === 1 ? one : many}`;

/**
 * The Play tab's status strip (ADR 0081): what waits on the player first, then who is online;
 * nothing at all when there is nothing to say (never "0 friends online").
 */
export function statusLine(inbox: InboxResponse): string | undefined {
  const online = inbox.friends.filter((friend) => friend.status === 'online').length;
  const parts = [
    inbox.invites.length > 0
      ? `${counted(inbox.invites.length, 'challenge', 'challenges')} waiting`
      : '',
    inbox.requests > 0 ? counted(inbox.requests, 'friend request', 'friend requests') : '',
    online > 0 ? `${counted(online, 'friend', 'friends')} online` : '',
  ].filter((part) => part !== '');
  return parts.length === 0 ? undefined : parts.join(' · ');
}

/** What waits on the player, for the Friends tab's badge: challenges and friend requests. */
export function waitingCount(inbox: InboxResponse): number {
  return inbox.invites.length + inbox.requests;
}

/** The Friends tab's accessible name, with what waits in it (ADR 0081). */
export function friendsTabLabel(waiting: number): string {
  return waiting === 0 ? 'Friends' : `Friends, ${String(waiting)} waiting`;
}

/** A friend's challenge in Waiting for you: who asks. */
export const challengesYou = (name: string) => `${name} challenges you`;
