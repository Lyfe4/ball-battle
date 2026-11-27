// game.profiles: one row per player (ADR 0052, section 5).
import type { Sql, TransactionSql } from '../db.ts';

type Db = Sql | TransactionSql;

export interface Profile {
  readonly userId: string;
  /** The name others see: the username, else the generated "Player 1234". */
  readonly name: string;
  /** An account's chosen name (ADR 0079), null until chosen and always for a guest. */
  readonly username: string | null;
  /** Signed in to an account (ADR 0079): `account_at` is set. Never read from a token. */
  readonly account: boolean;
}

/** Who a request reads as: the token's player and its Auth session (`Verified`, auth.ts). */
export interface Reader {
  readonly userId: string;
  readonly sessionId: string | undefined;
}

/**
 * True while the token's Auth session is still signed in (`game.session_live`, migration
 * 20261128120000): every statement that reads the session's profile ands it in, so a token kept
 * after Log out finds no profile and is refused, in the same round trip.
 */
export function sessionLive(sql: Db, sessionId: string | undefined) {
  return sql`game.session_live(${sessionId ?? null}::uuid)`;
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
 * Marks `userId` seen (at most once a day, so reads don't write on every request): the
 * inactive-guest cleanup reads `last_seen_at`. An account is also marked active at most every 30 s
 * (`active_at`, ADR 0079 PR (d)): its friends see it online for 150 s after. A guest never writes
 * it. A part of a statement (`profileOf`, and the series read that is also the session's).
 */
export function markSeen(sql: Db, userId: string | null) {
  return sql`
      update game.profiles
      set last_seen_at = case when last_seen_at < now() - interval '1 day' then now()
          else last_seen_at end,
        active_at = case when account_at is not null then now() else active_at end
      where user_id = ${userId}::uuid and (last_seen_at < now() - interval '1 day'
        or (account_at is not null
          and (active_at is null or active_at < now() - interval '30 seconds')))`;
}

/** The player's profile, if they still have one, marking them seen (`markSeen`). */
export async function profileOf(
  sql: Db,
  userId: string,
  sessionId?: string,
): Promise<Profile | undefined> {
  const [row] = await sql<
    { readonly name: string; readonly username: string | null; readonly account: boolean }[]
  >`
    with seen as (${markSeen(sql, userId)})
    select coalesce(username, display_name) as name, username, account_at is not null as account
    from game.profiles where user_id = ${userId} and ${sessionLive(sql, sessionId)}`;
  return row === undefined
    ? undefined
    : { userId, name: row.name, username: row.username, account: row.account };
}

/**
 * `/me`'s read in one statement (ADR 0090 addendum): the player's profile as `profileOf` reads it
 * (marking them seen), and whether an account has finished an online series (a counted one: played
 * out or forfeited, never a bot's), so a device it signs in on skips the guided first series.
 */
export async function meOf(
  sql: Db,
  userId: string,
  sessionId?: string,
): Promise<{ readonly profile: Profile | undefined; readonly played: boolean }> {
  const [row] = await sql<
    {
      readonly name: string;
      readonly username: string | null;
      readonly account: boolean;
      readonly played: boolean;
    }[]
  >`
    with seen as (${markSeen(sql, userId)})
    select coalesce(p.username, p.display_name) as name, p.username,
      p.account_at is not null as account,
      p.account_at is not null and exists (
        select 1 from game.series s
        where (s.player_a = p.user_id or s.player_b = p.user_id)
          and s.status in ('finished', 'forfeit') and s.bot is null
      ) as played
    from game.profiles p where p.user_id = ${userId} and ${sessionLive(sql, sessionId)}`;
  return row === undefined
    ? { profile: undefined, played: false }
    : {
        profile: { userId, name: row.name, username: row.username, account: row.account },
        played: row.played,
      };
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

/** Auth users the game never made a player, made over `hours` ago, oldest first (inactive.ts). */
export async function orphanUsers(sql: Sql, hours: number, limit: number): Promise<string[]> {
  if (limit <= 0) return [];
  const rows = await sql<{ readonly id: string }[]>`
    select id from game.orphan_users(make_interval(hours => ${hours}::int), ${limit}::int) as id`;
  return rows.map((row) => row.id);
}

/** Days a username stays before it may change again (ADR 0079). */
export const USERNAME_DAYS = 30;

export type UsernameChange =
  | { readonly kind: 'set' | 'same' | 'taken' }
  | { readonly kind: 'too_soon'; readonly days: number };

const isTaken = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: unknown }).code === '23505' &&
  (error as { constraint_name?: unknown }).constraint_name === 'profiles_username_key';

/**
 * Gives `userId` the username `name` (already checked by `username-rules.ts`): kept as typed,
 * unique ignoring case (the index decides between two claims at once), and at most one change per
 * USERNAME_DAYS by the database's clock. A name the owner cleared in SQL may be chosen again at once.
 */
export async function setUsername(sql: Sql, userId: string, name: string): Promise<UsernameChange> {
  try {
    return await sql.begin(async (db): Promise<UsernameChange> => {
      const [row] = await db<{ readonly username: string | null; readonly days: number | null }[]>`
        select username, ceil(extract(epoch from (username_set_at
          + make_interval(days => ${USERNAME_DAYS}) - now())) / 86400)::int as days
        from game.profiles where user_id = ${userId} for update`;
      if (row?.username === name) return { kind: 'same' };
      if (row?.username != null && row.days !== null && row.days > 0) {
        return { kind: 'too_soon', days: row.days };
      }
      await db`
        update game.profiles set username = ${name}, username_set_at = now()
        where user_id = ${userId}`;
      return { kind: 'set' };
    });
  } catch (error) {
    if (isTaken(error)) return { kind: 'taken' };
    throw error;
  }
}
