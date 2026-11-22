// game.profiles: one row per player (ADR 0052, section 5).
import type { Sql, TransactionSql } from '../db.ts';

type Db = Sql | TransactionSql;

export interface Profile {
  readonly userId: string;
  readonly name: string;
  /** Signed in to an account (ADR 0079): `account_at` is set. Never read from a token. */
  readonly account: boolean;
}

/** "Player 4821": four random digits, never anything the player typed. */
export function generatedName(): string {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1));
  return `Player ${String(1000 + (value % 9000))}`;
}

/** Makes a guest's profile, recording the 16+ confirmation at database time. */
export async function createProfile(sql: Db, userId: string): Promise<Profile> {
  const name = generatedName();
  await sql`
    insert into game.profiles (user_id, display_name, adult_confirmed_at)
    values (${userId}, ${name}, now())
    on conflict (user_id) do nothing`;
  const profile = await profileOf(sql, userId);
  if (profile === undefined) throw new Error('A profile just made is missing');
  return profile;
}

/**
 * The player's profile, if they still have one, marking them seen (at most once a day, so reads
 * don't write on every request). The inactive-guest cleanup reads `last_seen_at`.
 */
export async function profileOf(sql: Db, userId: string): Promise<Profile | undefined> {
  const [row] = await sql<{ readonly display_name: string; readonly account: boolean }[]>`
    with seen as (
      update game.profiles set last_seen_at = now()
      where user_id = ${userId} and last_seen_at < now() - interval '1 day'
    )
    select display_name, account_at is not null as account
    from game.profiles where user_id = ${userId}`;
  return row === undefined ? undefined : { userId, name: row.display_name, account: row.account };
}

/**
 * Makes `userId` an account (ADR 0079), with a profile if it has none yet (an account new to this
 * game, whose player confirmed they are 16 or older on this device). Kept from the first time.
 */
export async function markAccount(db: Db, userId: string): Promise<void> {
  await db`
    insert into game.profiles (user_id, display_name, adult_confirmed_at, account_at)
    values (${userId}, ${generatedName()}, now(), now())
    on conflict (user_id) do update
      set account_at = coalesce(game.profiles.account_at, now()), last_seen_at = now()`;
}

/**
 * Players not seen for long enough to be deleted, the longest gone first, at most `limit`: guests
 * after `guestDays` (ADR 0052, 0068), accounts after `accountDays` (ADR 0079). Seen means any
 * request of theirs, written at most once a day.
 */
export async function inactivePlayers(
  sql: Sql,
  guestDays: number,
  accountDays: number,
  limit: number,
): Promise<string[]> {
  const rows = await sql<{ readonly user_id: string }[]>`
    select user_id from game.profiles
    where last_seen_at < now() - make_interval(days => (case when account_at is null
      then ${guestDays} else ${accountDays} end)::int)
    order by last_seen_at
    limit ${limit}`;
  return rows.map((row) => row.user_id);
}
