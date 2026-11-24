// game.friendships and the friend code (ADR 0079, PR (c)): the SQL alone; the rules are in
// friends.ts. One row per pair, `low` < `high`; names are the ones everyone sees.
import type { Sql, TransactionSql } from '../db.ts';

type Db = Sql | TransactionSql;

/** How long a declined request keeps its row, so the sender can't send it again. */
export const DECLINE_DAYS = 30;

/** A friendship or request of the player's, as the player sees it. */
export interface FriendRow {
  readonly id: string;
  /** The other player's name: the username, else "Player 1234". */
  readonly name: string;
  readonly accepted: boolean;
  /** The player sent it. */
  readonly mine: boolean;
  /** The other player declined it (or, for one the player was sent, the player did). */
  readonly declined: boolean;
  /** The player cancelled their request after it was declined: hidden from them, still kept. */
  readonly withdrawn: boolean;
  /** The player blocked the other (never told to the other). */
  readonly blockedByMe: boolean;
}

/** Every friendship and request of `userId`, by name. */
export async function friendRows(db: Db, userId: string): Promise<FriendRow[]> {
  return db<FriendRow[]>`
    select f.id, game.name_seen_by(${userId}, p.user_id, p.username, p.display_name) as name,
      f.accepted_at is not null as accepted, f.requested_by = ${userId} as mine,
      f.declined_at is not null as declined, f.withdrawn_at is not null as withdrawn,
      coalesce(f.blocked_by = ${userId}, false) as "blockedByMe"
    from game.friendships f
    join game.profiles p on p.user_id = case when f.low = ${userId} then f.high else f.low end
    where ${userId} in (f.low, f.high)
    order by lower(coalesce(p.username, p.display_name)), f.created_at`;
}

/** The account's friend code, if it has one yet. */
export async function friendCodeOf(db: Db, userId: string): Promise<string | null> {
  const [row] = await db<{ readonly friend_code: string | null }[]>`
    select friend_code from game.profiles where user_id = ${userId}`;
  return row?.friend_code ?? null;
}

/** Gives the account `code` unless it has one already; the code it has after. */
export async function claimFriendCode(db: Db, userId: string, code: string): Promise<string> {
  const [row] = await db<{ readonly friend_code: string }[]>`
    update game.profiles set friend_code = coalesce(friend_code, ${code})
    where user_id = ${userId} returning friend_code`;
  if (row === undefined) throw new Error('A friend code for a player with no profile');
  return row.friend_code;
}

/**
 * The account a friend code or a username names (ignoring case), the code first. Guests have
 * neither, and are never found.
 */
export async function findAccount(
  db: Db,
  code: string | undefined,
  username: string,
): Promise<{ readonly userId: string; readonly name: string } | undefined> {
  const [row] = await db<{ readonly user_id: string; readonly name: string }[]>`
    select user_id, coalesce(username, display_name) as name from game.profiles
    where account_at is not null
      and (friend_code = ${code ?? null} or lower(username) = lower(${username}))
    order by friend_code = ${code ?? null} desc nulls last
    limit 1`;
  return row === undefined ? undefined : { userId: row.user_id, name: row.name };
}

/** One pair's row, locked for the rest of the transaction. */
export interface PairRow {
  readonly id: string;
  readonly requestedBy: string;
  readonly accepted: boolean;
  /** Declined within DECLINE_DAYS: the sender may not send it again yet. */
  readonly declinedRecently: boolean;
  readonly declined: boolean;
  /** Who blocked the other, if either did: the row is then a declined request for good. */
  readonly blockedBy: string | null;
  readonly low: string;
  readonly high: string;
}

const PAIR_COLUMNS = (db: Db) => db`
  id, low, high, requested_by as "requestedBy", accepted_at is not null as accepted,
  declined_at is not null as declined, blocked_by as "blockedBy",
  coalesce(declined_at > now() - make_interval(days => ${DECLINE_DAYS}), false)
    as "declinedRecently"`;

export async function pairRow(db: Db, low: string, high: string): Promise<PairRow | undefined> {
  const [row] = await db<PairRow[]>`
    select ${PAIR_COLUMNS(db)} from game.friendships
    where low = ${low} and high = ${high} for update`;
  return row;
}

/** A row of the player's by its id, locked; undefined if it isn't theirs or is gone. */
export async function ownRow(db: Db, userId: string, id: string): Promise<PairRow | undefined> {
  const [row] = await db<PairRow[]>`
    select ${PAIR_COLUMNS(db)} from game.friendships
    where id = ${id} and ${userId} in (low, high) for update`;
  return row;
}

/** A new request from `by`; false when the pair already has a row (two requests at once). */
export async function insertRequest(
  db: Db,
  low: string,
  high: string,
  by: string,
): Promise<boolean> {
  const rows = await db`
    insert into game.friendships (low, high, requested_by) values (${low}, ${high}, ${by})
    on conflict (low, high) do nothing returning 1`;
  return rows.length === 1;
}

/** A request sent again after its decline ran out: a fresh request from `by`. */
export async function renewRequest(db: Db, id: string, by: string): Promise<void> {
  await db`
    update game.friendships
    set requested_by = ${by}, created_at = now(), declined_at = null, withdrawn_at = null,
      accepted_at = null
    where id = ${id}`;
}

export async function acceptRow(db: Db, id: string): Promise<void> {
  await db`
    update game.friendships
    set accepted_at = now(), declined_at = null, withdrawn_at = null where id = ${id}`;
}

export async function declineRow(db: Db, id: string): Promise<void> {
  await db`
    update game.friendships set declined_at = coalesce(declined_at, now()) where id = ${id}`;
}

/** The sender cancels a request that was declined: kept (it still blocks), hidden from them. */
export async function withdrawRow(db: Db, id: string, withdrawn: boolean): Promise<void> {
  await db`
    update game.friendships set withdrawn_at = ${withdrawn ? db`now()` : null} where id = ${id}`;
}

export async function deleteRow(db: Db, id: string): Promise<void> {
  await db`delete from game.friendships where id = ${id}`;
}

/** What a player has: friends, requests sent and waiting, and requests waiting for their answer. */
export interface FriendCounts {
  readonly friends: number;
  readonly outgoing: number;
  readonly incoming: number;
}

export async function friendCounts(db: Db, userId: string): Promise<FriendCounts> {
  const [row] = await db<FriendCounts[]>`
    select
      count(*) filter (where accepted_at is not null)::int as friends,
      count(*) filter (where accepted_at is null and requested_by = ${userId})::int as outgoing,
      count(*) filter (where accepted_at is null and declined_at is null
        and requested_by <> ${userId})::int as incoming
    from game.friendships where ${userId} in (low, high)`;
  return row ?? { friends: 0, outgoing: 0, incoming: 0 };
}

/** Drops declines older than DECLINE_DAYS (the sweep): the sender may ask again. Never a block. */
export async function purgeDeclines(sql: Sql): Promise<number> {
  const rows = await sql`
    delete from game.friendships
    where declined_at <= now() - make_interval(days => ${DECLINE_DAYS}) and blocked_by is null
    returning 1`;
  return rows.length;
}
