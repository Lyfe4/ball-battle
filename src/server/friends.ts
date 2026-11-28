// Friends (ADR 0079, PR (c)): accounts add each other by username or friend code, and answer
// requests. The rules live here, the SQL in db/friends.ts.
//
// Abuse: only accounts ask or are asked (guests have neither a username nor a code); a lookup names
// one exact username or code and is counted first, per account and per network, so nobody can list
// who plays; new requests are capped per account a day, and how many may wait; a declined request
// keeps its row for 30 days and still reads as sent to its sender, so sending it again does
// nothing. Two requests at once, or a double tap, meet on the pair's one row.
import {
  FRIEND_CODE_ALPHABET,
  FRIEND_CODE_LENGTH,
  normalFriendCode,
  type AddFriendResponse,
  type FriendsResponse,
} from '../api/friends.ts';
import type { TransactionSql } from './db.ts';
import {
  acceptRow,
  claimFriendCode,
  declineRow,
  deleteRow,
  findAccount,
  friendCodeOf,
  friendCounts,
  friendRows,
  insertRequest,
  otherOf,
  ownRow,
  pairRow,
  renewRequest,
  withdrawRow,
  type FriendCounts,
} from './db/friends.ts';
import { callOffBetween } from './db/challenges.ts';
import { friendStatuses } from './db/inbox.ts';
import { ApiError, type Deps } from './http.ts';
import { LIMITS, spend } from './rate-limit.ts';

/** The most a player may have: friends, requests sent and waiting, requests waiting on them. */
export const FRIEND_CAPS = { friends: 200, outgoing: 50, incoming: 100 } as const;

/** A random friend code: each byte's low 5 bits pick one of 32 characters, evenly. */
export function newFriendCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(FRIEND_CODE_LENGTH));
  return [...bytes].map((byte) => FRIEND_CODE_ALPHABET[byte % 32] ?? '0').join('');
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';

/** The account's friend code, made the first time it is asked for. */
async function ensureFriendCode(deps: Deps, userId: string): Promise<string> {
  const code = await friendCodeOf(deps.sql, userId);
  if (code !== null) return code;
  // 32^8 codes: a clash is near impossible, and a second try settles it.
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await claimFriendCode(deps.sql, userId, newFriendCode());
    } catch (error) {
      if (!isUniqueViolation(error) || attempt >= 3) throw error;
    }
  }
}

/** The player's friends and requests, with their code. */
export async function listFriends(deps: Deps, userId: string): Promise<FriendsResponse> {
  const code = await ensureFriendCode(deps, userId);
  const rows = await friendRows(deps.sql, userId);
  const entry = ({ id, name }: { id: string; name: string }) => ({ id, name });
  return {
    code,
    // With each one's status (PR (d)) and the player's record against them (ADR 0088), read in the
    // one statement joined on accepted friendships.
    friends: await friendStatuses(deps.sql, userId, true),
    incoming: rows.filter((row) => !row.accepted && !row.mine && !row.declined).map(entry),
    // Declined or not, a request the player sent reads as sent (ADR 0079): a "no" is never told,
    // nor a block (blocks.ts).
    outgoing: rows.filter((row) => !row.accepted && row.mine && !row.withdrawn).map(entry),
    blocked: rows.filter((row) => row.blockedByMe).map(entry),
  };
}

const full = (message: string) => new ApiError(409, 'friend_limit', message);

/** Refuses a request past either side's caps. */
function checkCaps(mine: FriendCounts, theirs: FriendCounts, accepting: boolean): void {
  if (mine.friends >= FRIEND_CAPS.friends) {
    throw full(`You have ${String(FRIEND_CAPS.friends)} friends, the most there’s room for`);
  }
  if (accepting) {
    if (theirs.friends >= FRIEND_CAPS.friends) throw full('They have no room for more friends');
    return;
  }
  if (mine.outgoing >= FRIEND_CAPS.outgoing) {
    throw full(`${String(FRIEND_CAPS.outgoing)} requests are waiting: cancel some first`);
  }
  if (theirs.incoming >= FRIEND_CAPS.incoming) {
    throw full('They have too many requests waiting: try again later');
  }
}

/** A new request from `me` (counted against the day's), after both sides' caps. */
async function request<T>(
  db: TransactionSql,
  me: string,
  them: string,
  send: () => Promise<T>,
): Promise<T> {
  checkCaps(await friendCounts(db, me), await friendCounts(db, them), false);
  await spend(db, me, LIMITS.friendRequests);
  return send();
}

/** Accepts the pair's request, after both sides' caps. */
async function accept(db: TransactionSql, me: string, them: string, id: string): Promise<void> {
  checkCaps(await friendCounts(db, me), await friendCounts(db, them), true);
  await acceptRow(db, id);
}

/**
 * A request from `me` to the account `to` names (a username or a friend code): sent, or friends
 * at once when they had asked `me`. Sending it again, or to someone who declined it, does nothing.
 */
export async function addFriend(deps: Deps, me: string, to: string): Promise<AddFriendResponse> {
  const target = await findAccount(deps.sql, normalFriendCode(to), to);
  if (target === undefined) {
    throw new ApiError(404, 'friend_not_found', 'No account has that username or friend code');
  }
  if (target.userId === me) {
    throw new ApiError(400, 'friend_self', 'That’s you: share your code with a friend instead');
  }
  const them = target.userId;
  const [low, high] = me < them ? [me, them] : [them, me];
  const outcome = await deps.sql.begin(async (db): Promise<AddFriendResponse['outcome']> => {
    let row = await pairRow(db, low, high);
    if (row === undefined) {
      if (await request(db, me, them, () => insertRequest(db, low, high, me))) return 'requested';
      // Their request reached the pair first: this one answers it.
      row = await pairRow(db, low, high);
      if (row === undefined) throw new Error('A friendship row that clashed is gone');
    }
    if (row.blockedBy === me) {
      throw new ApiError(409, 'friend_blocked', 'You blocked this player: unblock them first');
    }
    // Blocked by them: it reads as sent, as a decline does, and never arrives (blocks.ts).
    if (row.blockedBy !== null) {
      await withdrawRow(db, row.id, false);
      return 'requested';
    }
    if (row.accepted) return 'friends';
    if (row.requestedBy !== me) {
      // They asked first (or asked and were declined, and `me` changed their mind): friends.
      await accept(db, me, them, row.id);
      return 'friends';
    }
    // Asked again: waiting, or declined within its 30 days, it stays as it is (shown as sent again
    // if the sender had cancelled it).
    if (!row.declined) return 'requested';
    if (row.declinedRecently) {
      await withdrawRow(db, row.id, false);
      return 'requested';
    }
    const id = row.id;
    await request(db, me, them, () => renewRequest(db, id, me));
    return 'requested';
  });
  return { ...(await listFriends(deps, me)), outcome, name: target.name };
}

/** Accepts a request sent to `me`; a friend already, or one of `me`'s own, is left as it is. */
export async function acceptFriend(deps: Deps, me: string, id: string): Promise<FriendsResponse> {
  await deps.sql.begin(async (db) => {
    const row = await ownRow(db, me, id);
    // Gone, or blocked either way: a block is undone only by Unblock.
    if (row?.blockedBy !== null) {
      throw new ApiError(404, 'not_found', 'That request is gone');
    }
    if (row.accepted || row.requestedBy === me) return;
    await accept(db, me, otherOf(row, me), row.id);
  });
  return listFriends(deps, me);
}

/**
 * Removes a friend, cancels a request `me` sent, or declines one sent to `me` (kept 30 days, so it
 * can't be sent again). Gone already: nothing to do (a double tap).
 */
export async function removeFriend(deps: Deps, me: string, id: string): Promise<FriendsResponse> {
  await deps.sql.begin(async (db) => {
    const row = await ownRow(db, me, id);
    if (row === undefined) return;
    // A block is undone only by Unblock; blocked, cancelling hides the request and keeps the row.
    if (row.blockedBy === me) return;
    if (row.blockedBy !== null) await withdrawRow(db, row.id, true);
    else if (row.accepted) {
      await deleteRow(db, row.id);
      // No longer friends: a challenge either way that hasn't started ends, as with a block.
      await callOffBetween(db, me, otherOf(row, me));
    } else if (row.requestedBy !== me) await declineRow(db, row.id);
    // A declined request stays until its 30 days are up, so cancelling it can't clear the way.
    else if (row.declinedRecently) await withdrawRow(db, row.id, true);
    else await deleteRow(db, row.id);
  });
  return listFriends(deps, me);
}
