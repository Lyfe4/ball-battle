// An account's record (ADR 0088) in one statement: the session's profile (marked seen, as
// `profileOf` does), the read counted against the reader's rate limit, and the record itself, so
// Profile's read is one round trip (`sessionWith`). Read from game.series alone: nothing new is
// stored, and Delete account removes it with the series rows. Only finished series are listed, all
// of which the player's own series read (`viewOf`) shows whole.
import { RECENT_SERIES, type RecordResponse, type RecentSeries } from '../../api/record.ts';
import type { Sql, TransactionSql } from '../db.ts';
import type { Limit } from '../rate-limit.ts';
import { markSeen, type Profile } from './profiles.ts';

type Db = Sql | TransactionSql;

/**
 * The series a record counts (ADR 0088): finished or forfeit (never open or void), between players
 * (never a bot's). `s` is game.series.
 */
export const COUNTED = (db: Db) => db`s.status in ('finished', 'forfeit') and s.bot is null`;

interface Raw {
  readonly me_found: boolean;
  readonly me_name: string | null;
  readonly me_username: string | null;
  readonly me_account: boolean | null;
  readonly spent_count: number | null;
  readonly spent_retry: number | null;
  readonly wins: number;
  readonly played: number;
  readonly favourite: string | null;
  readonly recent: (Omit<RecentSeries, 'finishedAt'> & { readonly finishedAt: string })[];
}

export interface LoadedRecord {
  readonly profile: Profile | undefined;
  /** The reader's count in its rate-limit window. */
  readonly spent: { readonly count: number; readonly retry: number } | undefined;
  /** Undefined for a reader without an account: nothing is read for them. */
  readonly record: RecordResponse | undefined;
}

export async function loadRecord(db: Db, userId: string, limit: Limit): Promise<LoadedRecord> {
  const window = `${String(limit.windowSeconds)} seconds`;
  const [raw] = await db<Raw[]>`
    with seen as (${markSeen(db, userId)}), me as (
      select coalesce(username, display_name) as name, username, account_at is not null as account
      from game.profiles where user_id = ${userId}::uuid
    ), counted as (
      insert into game.rate_limits (subject, bucket, window_start, count)
      select ${userId}::text, ${limit.bucket}::text,
        date_bin(${window}::interval, now(), timestamptz '2000-01-01'), 1
      where exists (select 1 from me)
      on conflict (subject, bucket, window_start)
        do update set count = game.rate_limits.count + 1
      returning count,
        ceil(extract(epoch from (window_start + ${window}::interval - now())))::integer as retry
    ), mine as (
      select s.id, s.ruleset, s.format, s.best_of, s.live, s.status, s.finished_at,
        s.winner = case when s.player_a = ${userId}::uuid then 'a' else 'b' end as won,
        case when s.player_a = ${userId}::uuid then 'a' else 'b' end as you,
        case when s.player_a = ${userId}::uuid then s.player_b else s.player_a end as them,
        case when s.player_a = ${userId}::uuid then s.lineup_a else s.lineup_b end as lineup
      from game.series s
      where (s.player_a = ${userId}::uuid or s.player_b = ${userId}::uuid) and ${COUNTED(db)}
        and exists (select 1 from me where account)
    ), recent as (
      select * from mine order by finished_at desc, id limit ${RECENT_SERIES}
    )
    select exists (select 1 from me) as me_found, (select name from me) as me_name,
      (select username from me) as me_username, (select account from me) as me_account,
      (select count from counted) as spent_count, (select retry from counted) as spent_retry,
      (select count(*)::int from mine) as played,
      (select count(*)::int from mine where won) as wins,
      (select ball from mine, unnest(mine.lineup) as ball
        group by ball order by count(*) desc, max(mine.finished_at) desc, ball limit 1) as favourite,
      coalesce((
        select json_agg(json_build_object(
          'id', r.id,
          'opponent', game.name_seen_by(${userId}::uuid, p.user_id, p.username, p.display_name),
          'live', r.live, 'bestOf', r.best_of, 'format', r.format,
          'won', coalesce(r.won, false), 'forfeit', r.status = 'forfeit',
          'score', json_build_object(
            'you', (select count(*) from game.rounds x where x.series_id = r.id and x.winner = r.you),
            'them', (select count(*) from game.rounds x where x.series_id = r.id and x.winner <> r.you)),
          'finishedAt', to_char(r.finished_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'ruleset', r.ruleset)
          order by r.finished_at desc, r.id)
        from recent r left join game.profiles p on p.user_id = r.them), '[]') as recent`;
  if (!raw?.me_found) {
    return { profile: undefined, spent: undefined, record: undefined };
  }
  const profile: Profile = {
    userId,
    name: raw.me_name ?? '',
    username: raw.me_username,
    account: raw.me_account === true,
  };
  const spent =
    raw.spent_count === null ? undefined : { count: raw.spent_count, retry: raw.spent_retry ?? 1 };
  return {
    profile,
    spent,
    record: profile.account
      ? { wins: raw.wins, played: raw.played, favourite: raw.favourite, recent: raw.recent }
      : undefined,
  };
}
