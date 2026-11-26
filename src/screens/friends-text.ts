// The Friends tab's words (ADR 0079, PR (c); ADR 0081): pure, so every state is tested without a
// DOM.
import type {
  AddFriendResponse,
  ReportReason,
  FriendStatus,
  FriendsResponse,
  Ending,
  GameWaiting,
  InboxResponse,
  TurnWaiting,
} from '../api/friends.ts';
import { TURN_HOURS } from '../api/series.ts';

/** One group of the list: its heading, and what each row's actions say. */
export interface FriendGroup {
  readonly key: 'incoming' | 'friends' | 'outgoing' | 'blocked';
  readonly title: string;
}

/** What waits on the player first, then friends, then the requests sent (ADR 0081). */
export const FRIEND_GROUPS: readonly FriendGroup[] = [
  { key: 'incoming', title: 'Waiting for you' },
  { key: 'friends', title: 'Friends' },
  { key: 'outgoing', title: 'Sent' },
  { key: 'blocked', title: 'Blocked' },
];

/** What the list says when it holds nobody. */
export const NO_FRIENDS = 'No friends yet. Share your code, or add theirs.';

/** The friends list's failure card (ADR 0087): its section, named as on the guest's card. */
export const FRIENDS_FAILED_TITLE = 'Your friends';

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
export const REPORT_CHOICES: readonly { readonly reason: ReportReason; readonly text: string }[] = [
  { reason: 'offensive', text: 'Rude or hurtful' },
  { reason: 'impersonation', text: 'Pretends to be someone' },
  { reason: 'other', text: 'Something else' },
];

/** What the list says after a block or a report. */
export const BLOCKED_LINE = (name: string) => `${name} is blocked. Unblock them under Blocked.`;
export const REPORTED_LINE = 'Thanks: we’ll look at that name. You won’t see it again.';

/** A confirm step's words (sheet.ts): a title, what it does, the action. */
export interface StepWords {
  readonly title: string;
  readonly text: string;
  readonly action: string;
}

/** Remove, confirmed in the friend's sheet (ADR 0086): what it does, and that it can be undone. */
export const REMOVE_STEP = (name: string): StepWords => ({
  title: `Remove ${name}?`,
  text: `You stop being friends. ${name} isn’t told, and you can add them again later.`,
  action: `Remove ${name}`,
});

/** Block, confirmed in the person's sheet (ADR 0086): what it does, never what they are told. */
export const BLOCK_STEP = (name: string): StepWords => ({
  title: `Block ${name}?`,
  text: `${name} is removed from your friends and can’t add or challenge you. They aren’t told; unblock them under Blocked.`,
  action: `Block ${name}`,
});

/** Report name's title in the sheet: why, in a tap. */
export const reportTitle = (name: string) => `Report the name ${name}?`;

/** The person's sheet's words (friend-sheet.ts). */
export const SHEET_LINES = {
  challenge: 'Challenge · live',
  turns: 'Play by turns',
  /** Under Play by turns: what it asks of the two of them (the server's turn, ADR 0085). */
  turnsHint: `No need to be online together · up to ${String(TURN_HOURS)} h a move`,
  remove: 'Remove friend',
  report: 'Report name',
  block: 'Block',
  sendReport: 'Send report',
  cancelRequest: 'Cancel request',
  alsoBlock: (name: string) => `Also block ${name}`,
  removed: (name: string) => `${name} is no longer your friend.`,
  blocked: BLOCKED_LINE,
  reported: REPORTED_LINE,
} as const;

/**
 * What a person's row and sheet say of them: a friend's status (one who waits on you in their lobby
 * is "Waiting for you", never "In a match"), or what kind of request they are.
 */
export function personStatus(
  person: { readonly status?: FriendStatus },
  kind: 'friend' | 'incoming' | 'outgoing' | 'blocked',
  waiting = false,
): string {
  if (kind === 'incoming') return 'Wants to be friends';
  if (kind === 'outgoing') return 'Request sent';
  if (kind === 'blocked') return 'Blocked: can’t add or challenge you';
  if (waiting) return 'Waiting for you';
  return STATUS_WORDS[person.status ?? 'offline'];
}

/**
 * Why a friend's Challenge · live can't be taken now, and the way that works, as one line under it
 * (the sheet keeps one shape, ADR 0086 as changed 2026-11-26): undefined when it can (online, and
 * not waiting on you). `turns` where the build plays by turns, which works any time.
 */
export function liveUnavailable(
  person: { readonly name: string; readonly status?: FriendStatus },
  waiting: boolean,
  turns: boolean,
): string | undefined {
  if (waiting) return `${person.name} is waiting for you · Accept in Waiting for you`;
  if (person.status === 'online') return undefined;
  if (person.status === 'in_a_match') {
    return `${person.name} is in a match · ${turns ? 'Play by turns instead' : 'Try again after it'}`;
  }
  return `${person.name} is offline · ${turns ? 'Play by turns instead' : 'Try again when they’re online'}`;
}

/**
 * A person's @username for their sheet's head, or nothing for a name the server made up ("Player
 * 1234": no username chosen yet, ADR 0079).
 */
export function handleOf(name: string): string | undefined {
  return /^Player \d+$/.test(name) ? undefined : `@${name}`;
}

/** A friend's status in words, beside its dot (PR (d)). */
export const STATUS_WORDS: Readonly<Record<FriendStatus, string>> = {
  online: 'Online',
  in_a_match: 'In a match',
  offline: 'Offline',
};

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

/**
 * The friends list's title (ADR 0086): how many, then how many are online, the one place the page
 * says who is online (Play shows nothing social). Never "0 online": in a match or offline isn't.
 */
export function friendsTitle(
  title: string,
  friends: readonly Readonly<{ status?: string | undefined }>[],
): string {
  const online = friends.filter((friend) => friend.status === 'online').length;
  const count = `${title} · ${String(friends.length)}`;
  return online === 0 ? count : `${count} · ${String(online)} online`;
}

/** What waits on the player, for the Friends tab's badge: turns, challenges and friend requests. */
export function waitingCount(inbox: InboxResponse): number {
  return inbox.turns.length + inbox.invites.length + inbox.requests;
}

/** The Friends tab's accessible name, with what waits in it (ADR 0081). */
export function friendsTabLabel(waiting: number): string {
  return waiting === 0 ? 'Friends' : `Friends, ${String(waiting)} waiting`;
}

/** A friend's challenge in Waiting for you: who asks. */
export const challengesYou = (name: string) => `${name} challenges you`;

/** A series by turns waiting on the player's pick (ADR 0085): "Your turn vs Sam". */
export const turnName = (turn: Pick<TurnWaiting, 'opponent'>): string =>
  turn.opponent === null ? 'Your turn' : `Your turn vs ${turn.opponent}`;

/** The section of games by turns on Friends (ADR 0086). */
export const YOUR_GAMES = 'Your games';

/** A game by turns waiting on the other player: "Sam’s turn". */
export const gameName = (game: Pick<GameWaiting, 'opponent'>): string =>
  game.opponent === null ? 'Their turn' : `${game.opponent}’s turn`;

/** How a game by turns ended, said to its player until seen (ADR 0086). */
export function endingLine(ending: Pick<Ending, 'opponent' | 'outcome'>): string {
  const they = ending.opponent ?? 'a deleted player';
  switch (ending.outcome) {
    case 'won':
      return `You won vs ${they}`;
    case 'lost':
      return `${ending.opponent ?? 'They'} won`;
    case 'won-ran-out':
      return `You won vs ${they}: their turn ran out`;
    case 'lost-ran-out':
      return 'You lost: your turn ran out';
  }
}
