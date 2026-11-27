// The Friends tab's words (ADR 0079, PR (c); ADR 0081): pure, so every state is tested without a
// DOM.
import type {
  AddFriendResponse,
  ReportReason,
  FriendEntry,
  FriendStatus,
  FriendsResponse,
  Ending,
  GameWaiting,
  InboxResponse,
  TurnWaiting,
} from '../api/friends.ts';
import type { CurrentMatch } from '../api/live.ts';

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
  /** "Who do you want to play?" with them picked, on Play's box's rules (ADR 0089 addendum). */
  challenge: 'Challenge',
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
 * Why a friend's Challenge can't be taken now, and the way that works, as one line under it (the
 * sheet keeps one shape, ADR 0086 as changed 2026-11-26): undefined when it can. Live needs them
 * online; `turns` where the build plays by turns, which works any time ("Who do you want to play?"
 * says which, ADR 0089 addendum of 2026-11-27). Never over a challenge of theirs waiting on you,
 * nor while the player is in a game (`inGame`, or with this friend).
 */
export function challengeUnavailable(
  person: { readonly name: string; readonly status?: FriendStatus },
  waiting: boolean,
  turns: boolean,
  inGame = false,
): string | undefined {
  // One game at a time (ADR 0089 addendum of 2026-11-27): no new challenge while in one.
  if (person.status === 'with_you') return `${person.name} is in a game with you · Finish it first`;
  if (inGame) return 'You’re in a game · Finish it first';
  if (waiting) return `${person.name} is waiting for you · Accept in Waiting for you`;
  if (person.status === 'online' || turns) return undefined;
  if (person.status === 'in_a_match') return `${person.name} is in a match · Try again after it`;
  return `${person.name} is offline · Try again when they’re online`;
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
  with_you: 'In a game with you',
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

/**
 * The section of games by turns on Friends (ADR 0086): by turns only, said in its name (2026-11-27:
 * read beside a live lineup, "Your games" seemed to mean that match). A live game is never listed.
 */
export const YOUR_GAMES = 'Your games by turns';

/** A game by turns or a turn still running at `now`: one whose time ran out leaves at once. */
export const stillRunning = (row: { readonly deadline: string }, now: number): boolean =>
  Date.parse(row.deadline) > now;

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

/**
 * A friend's head-to-head under their name in their sheet (ADR 0088): "You 3 – 2 Jo", and the same
 * in words for a screen reader. Series won by each side, as Profile counts them.
 */
export function headToHead(
  record: { readonly wins: number; readonly losses: number },
  name: string,
): { readonly shown: string; readonly said: string } {
  return {
    shown: `You ${String(record.wins)} – ${String(record.losses)} ${name}`,
    said: `Your record with ${name}: you won ${String(record.wins)}, ${name} won ${String(record.losses)}`,
  };
}

/**
 * Whether the inbox says something the Friends list hasn't drawn (ADR 0089 addendum of
 * 2026-11-27): a request waiting that it doesn't show, or a friend it doesn't list (or one gone).
 */
export function missesNews(
  list: Pick<FriendsResponse, 'incoming' | 'friends'>,
  requests: number,
  friends: readonly Pick<FriendEntry, 'id'>[],
): boolean {
  const drawn = new Set(list.friends.map((one) => one.id));
  return (
    list.incoming.length !== requests ||
    friends.length !== drawn.size ||
    friends.some((one) => !drawn.has(one.id))
  );
}

/** The way back to the game the player is in (ADR 0089 addendum of 2026-11-27, the setup phase). */
export const BACK_TO_IT = 'Back to it';

/** The live game (lineups or match) the player is in, and with whom when it's known. */
export interface InGame {
  readonly name?: string;
}

/**
 * The game the player is in, from the inbox's friends (one in a game with them) and what this page
 * knows (live-memory.ts: a lineup or match it showed, or `/me/match` said); a lobby of one's own
 * isn't one (a new challenge calls it off). Undefined: not in one, as far as this page knows.
 */
export function inGameWith(
  friends: readonly Pick<FriendEntry, 'name' | 'status'>[],
  known: CurrentMatch | null | undefined,
): InGame | undefined {
  const friend = friends.find((one) => one.status === 'with_you');
  if (friend !== undefined) return { name: friend.name };
  if (known?.kind === 'series') return known.opponent === null ? {} : { name: known.opponent };
  if (known?.kind === 'start') return {};
  return undefined;
}

/** "You're in a game with Robin": the one line that stands for any new challenge while in one. */
export const inGameLine = (game: InGame): string =>
  game.name === undefined ? 'You’re in a game' : `You’re in a game with ${game.name}`;
