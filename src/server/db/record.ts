// An account's record (ADR 0088, 0089) in one statement: the session's profile (marked seen, as
// `profileOf` does), the read counted against the reader's rate limit, and the record itself, so
// Profile's read is one round trip (`sessionWith`). All matches' later pages are one statement the
// same way (`loadMatches`). Read from game.series alone: nothing new is stored, and Delete account
// removes it with the series rows. Only finished series are listed, all of which the player's own
// series read (`viewOf`) shows whole.
import {
  RECENT_SERIES,
  type MatchesPage,
  type RecentSeries,
  type RecordResponse,
  type RecordStats,
} from '../../api/record.ts';
import type { Sql, TransactionSql } from '../db.ts';
import { countedAs, type ReadCount } from '../read-count.ts';
import { markSeen, sessionLive, type Profile } from './profiles.ts';

type Db = Sql | TransactionSql;

/**
 * The series a record counts (ADR 0088): finished or forfeit (never open or void), between players
 * (never a bot's). `s` is game.series.
 */
export const COUNTED = (db: Db) => db`s.status in ('finished', 'forfeit') and s.bot is null`;

/** Where All matches carries on: the last row's `finished_at` (to the microsecond) and id. */
export interface Cursor {
  readonly finishedAt: string;
  readonly id: string;
}

const CURSOR =
  /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z)_([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/;

/** A cursor from a page's `next`, or undefined when it isn't one (never throws). */
export function cursorOf(text: string | null): Cursor | undefined {
  const match = text === null ? null : CURSOR.exec(text);
  if (match?.[1] === undefined || match[2] === undefined) return undefined;
  if (Number.isNaN(Date.parse(match[1]))) return undefined;
  return { finishedAt: match[1], id: match[2] };
}

interface Raw {
  readonly me_found: boolean;
  readonly me_name: string | null;
  readonly me_username: string | null;
  readonly me_account: boolean | null;
  readonly spent_count: number | null;
  readonly spent_retry: number | null;
}

interface RawRecord extends Raw {
  readonly wins: number;
  readonly played: number;
  readonly favourite: string | null;
  readonly stats: RecordStats;
  readonly rows: RecentSeries[];
  readonly next: string | null;
}

interface RawPage extends Raw {
  readonly rows: RecentSeries[];
  readonly next: string | null;
}

export interface Loaded<T> {
  readonly profile: Profile | undefined;
  /** The reader's count in its rate-limit window. */
  readonly spent: { readonly count: number; readonly retry: number } | undefined;
  /** Undefined for a reader without an account: nothing is read for them. */
  readonly answer: T | undefined;
}

/** The session's profile, marked seen, and the read counted, as CTEs `me` and `spent`. */
function reader(db: Db, userId: string, count: ReadCount, sessionId: string | undefined) {
  return db`
    seen as (${markSeen(db, userId)}), me as (
      select coalesce(username, display_name) as name, username, account_at is not null as account
      from game.profiles where user_id = ${userId}::uuid and ${sessionLive(db, sessionId)}
    ), ${countedAs(db, userId, count, () => db`exists (select 1 from me)`)}, mine as (
      select s.id, s.ruleset, s.format, s.best_of, s.live, s.status, s.end_reason, s.finished_at,
        coalesce(s.winner = case when s.player_a = ${userId}::uuid then 'a' else 'b' end, false)
          as won,
        case when s.player_a = ${userId}::uuid then 'a' else 'b' end as you,
        case when s.player_a = ${userId}::uuid then s.player_b else s.player_a end as them,
        case when s.player_a = ${userId}::uuid then s.lineup_a else s.lineup_b end as lineup
      from game.series s
      where (s.player_a = ${userId}::uuid or s.player_b = ${userId}::uuid) and ${COUNTED(db)}
        and exists (select 1 from me where account)
    )`;
}

const READER_COLUMNS = (db: Db) => db`
  exists (select 1 from me) as me_found, (select name from me) as me_name,
  (select username from me) as me_username, (select account from me) as me_account,
  (select count from spent) as spent_count, (select retry from spent) as spent_retry`;

/**
 * The first RECENT_SERIES rows of `page` (a CTE of `mine`'s columns, one more than a page) as
 * JSON, the latest first, and the cursor after them when there is more. How a forfeit ended is
 * said from the reader's side (ADR 0089): a turn or a lineup that ran out is time (`timeout`,
 * `start_missed`; a forfeit both sides missed is the reader's own time), anything else a player who
 * left (`left`, `disconnected`, or none: the deleted player forfeits, game.forfeit_open_series).
 */
function rowsOf(db: Db, userId: string) {
  return db`coalesce((
    select json_agg(json_build_object(
      'id', r.id,
      'opponent', game.name_seen_by(${userId}::uuid, p.user_id, p.username, p.display_name),
      'live', r.live, 'bestOf', r.best_of, 'format', r.format,
      'won', r.won, 'forfeit', r.status = 'forfeit',
      'ending', case
        when r.status <> 'forfeit' then null
        when r.end_reason in ('timeout', 'start_missed') then
          case when r.won then 'theirTime' else 'yourTime' end
        when r.end_reason is null and not r.won then 'yourTime'
        else case when r.won then 'theyLeft' else 'youLeft' end
      end,
      'score', json_build_object(
        'you', (select count(*) from game.rounds x where x.series_id = r.id and x.winner = r.you),
        'them', (select count(*) from game.rounds x where x.series_id = r.id and x.winner <> r.you)),
      'finishedAt', to_char(r.finished_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'ruleset', r.ruleset)
      order by r.finished_at desc, r.id)
    from (select * from page order by finished_at desc, id limit ${RECENT_SERIES}) r
      left join game.profiles p on p.user_id = r.them), '[]') as rows,
  case when (select count(*) from page) > ${RECENT_SERIES} then (
    select to_char(l.finished_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '_' || l.id
    from page l order by l.finished_at desc, l.id offset ${RECENT_SERIES - 1} limit 1
  ) end as next`;
}

function loaded<T>(userId: string, raw: Raw | undefined, answer: () => T): Loaded<T> {
  if (!raw?.me_found) return { profile: undefined, spent: undefined, answer: undefined };
  const profile: Profile = {
    userId,
    name: raw.me_name ?? '',
    username: raw.me_username,
    account: raw.me_account === true,
  };
  const spent =
    raw.spent_count === null ? undefined : { count: raw.spent_count, retry: raw.spent_retry ?? 1 };
  return { profile, spent, answer: profile.account ? answer() : undefined };
}

const tally = (db: Db, where: ReturnType<typeof COUNTED>) => db`json_build_object(
  'wins', (select count(*)::int from mine where won and ${where}),
  'played', (select count(*)::int from mine where ${where}))`;

/** Profile's read: the record, its stats and the first page of matches (one page and one more). */
export async function loadRecord(
  db: Db,
  userId: string,
  count: ReadCount,
  sessionId?: string,
): Promise<Loaded<RecordResponse>> {
  const [raw] = await db<RawRecord[]>`
    with ${reader(db, userId, count, sessionId)}, page as (
      select * from mine order by finished_at desc, id limit ${RECENT_SERIES + 1}
    ), runs as (
      -- Each loss starts a new run; a run's wins are its streak.
      select won, count(*) filter (where not won) over (order by finished_at, id) as run from mine
    ), favourite as (
      select ball, count(*)::int as times from mine, unnest(mine.lineup) as ball
      group by ball order by count(*) desc, max(mine.finished_at) desc, ball limit 1
    )
    select ${READER_COLUMNS(db)},
      (select count(*)::int from mine) as played,
      (select count(*)::int from mine where won) as wins,
      (select ball from favourite) as favourite,
      json_build_object(
        'live', ${tally(db, db`live`)}, 'turns', ${tally(db, db`not live`)},
        'bestOf3', ${tally(db, db`best_of = 3`)}, 'bestOf5', ${tally(db, db`best_of = 5`)},
        'bestStreak', coalesce((
          select max(wins) from (select count(*) filter (where won) as wins from runs group by run) x
        ), 0),
        'favouriteIn', coalesce((select times from favourite), 0)) as stats,
      ${rowsOf(db, userId)}`;
  return loaded(userId, raw, () => ({
    wins: raw?.wins ?? 0,
    played: raw?.played ?? 0,
    favourite: raw?.favourite ?? null,
    stats: raw?.stats ?? EMPTY_STATS,
    recent: raw?.rows ?? [],
    next: raw?.next ?? null,
  }));
}

const EMPTY_STATS: RecordStats = {
  live: { wins: 0, played: 0 },
  turns: { wins: 0, played: 0 },
  bestOf3: { wins: 0, played: 0 },
  bestOf5: { wins: 0, played: 0 },
  bestStreak: 0,
  favouriteIn: 0,
};

/** All matches' next page (ADR 0089): the RECENT_SERIES finished after `after`, by keyset. */
export async function loadMatches(
  db: Db,
  userId: string,
  count: ReadCount,
  after: Cursor,
  sessionId?: string,
): Promise<Loaded<MatchesPage>> {
  const [raw] = await db<RawPage[]>`
    with ${reader(db, userId, count, sessionId)}, page as (
      select * from mine
      where finished_at < ${after.finishedAt}::timestamptz
        or (finished_at = ${after.finishedAt}::timestamptz and id > ${after.id}::uuid)
      order by finished_at desc, id limit ${RECENT_SERIES + 1}
    )
    select ${READER_COLUMNS(db)}, ${rowsOf(db, userId)}`;
  return loaded(userId, raw, () => ({ matches: raw?.rows ?? [], next: raw?.next ?? null }));
}
