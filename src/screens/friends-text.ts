// The Friends section's words (ADR 0079, PR (c)): pure, so every state is tested without a DOM.
import type { AddFriendResponse, FriendStatus, FriendsResponse, Invite } from '../api/friends.ts';
import { challengeLine } from './online-text.ts';

/** One group of the list: its heading, and what each row's actions say. */
export interface FriendGroup {
  readonly key: 'incoming' | 'friends' | 'outgoing';
  readonly title: string;
}

/** Requests first (they wait on the player), then friends, then requests sent. */
export const FRIEND_GROUPS: readonly FriendGroup[] = [
  { key: 'incoming', title: 'Requests' },
  { key: 'friends', title: 'Your friends' },
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
