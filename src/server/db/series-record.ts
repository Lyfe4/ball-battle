// A series in one query (ADR 0052; the functions run far from the database, so each round trip
// costs ~200 ms): the row with its picks, rounds and seeds as JSON aggregates, and for a live series
// (ADR 0053) its clock: the database's `now()`, when each player was last heard from and each
// round's fight times. A live series' read is its reader's heartbeat, written in the same
// statement, and reads the reader's profile too (`sessionWith`), so a warm read is one round trip
// (cost proposal, decision 4). Every change is written by `writeSeries` (series-write.ts).
import type { SeriesStatus, Turn } from '../../api/series.ts';
import type { PickRecord, RoundRecord, SeriesSetup, Side } from '../../sim/index.ts';
import type { Sql, TransactionSql } from '../db.ts';
import type { EndReason, FightTime } from '../live.ts';
import type { Limit } from '../rate-limit.ts';
import { markSeen, type Profile } from './profiles.ts';
import type { SeedRow } from '../view.ts';
import type { SeriesRow } from './series.ts';

type Db = Sql | TransactionSql;

/** A live series' clock, by the database's time (ms since the epoch). */
export interface LiveClock {
  /** The database's clock when the series was read. */
  readonly now: number;
  readonly createdAt: number;
  readonly startedAt: number | null;
  /** When the current pick phase opened; null before the start and once nothing is due. */
  readonly opensAt: number | null;
  readonly seen: Readonly<Record<Side, number | null>>;
  readonly fights: readonly FightTime[];
  /** The picks the server made at random when their time ran out. */
  readonly auto: readonly { readonly round: number; readonly side: Side }[];
  readonly endReason: EndReason | 'timeout' | null;
}

export interface LoadedSeries extends SeriesRow {
  readonly picks: readonly PickRecord[];
  readonly rounds: readonly RoundRecord[];
  readonly seeds: readonly SeedRow[];
  /** Null for a series by turns. */
  readonly live: LiveClock | null;
  /** The reader's count in its rate-limit window, when the read was counted. */
  readonly spent?: { readonly count: number; readonly retry: number };
}

interface Raw {
  /** Null when there is no such series (the row is the reader's alone). */
  readonly id: string | null;
  readonly ruleset: number;
  readonly format: LoadedSeries['format'];
  readonly best_of: LoadedSeries['bestOf'];
  readonly player_a: string | null;
  readonly player_b: string | null;
  readonly name_a: string | null;
  readonly name_b: string | null;
  readonly lineup_a: string[];
  readonly lineup_b: string[];
  readonly key_id: string;
  readonly status: SeriesStatus;
  readonly winner: Side | null;
  readonly version: number;
  readonly turn: Turn | null;
  readonly turn_deadline: Date | null;
  readonly expired: boolean;
  readonly final_setup: SeriesSetup | null;
  readonly picks: (PickRecord & { readonly auto: boolean })[];
  readonly rounds: (RoundRecord & {
    readonly fightAt: number | null;
    readonly endsAt: number | null;
  })[];
  readonly seeds: SeedRow[];
  readonly live: boolean;
  readonly now: Date;
  readonly created_at: Date;
  readonly started_at: Date | null;
  readonly turn_opens_at: Date | null;
  readonly end_reason: LiveClock['endReason'];
  readonly seen_a: Date | null;
  readonly seen_b: Date | null;
  readonly spent_count: number | null;
  readonly spent_retry: number | null;
  readonly me_found: boolean;
  readonly me_name: string | null;
  readonly me_username: string | null;
  readonly me_account: boolean | null;
}

const msOf = (date: Date | null): number | null => (date === null ? null : date.getTime());

/**
 * The series with everything about it, in one round trip; undefined when there is none. When
 * `reader` plays in an open live series, this read is their heartbeat on it; with `limit`, the read
 * is counted against the reader's rate limit in the same statement (see `spend`).
 */
export async function loadSeries(
  db: Db,
  id: string,
  reader?: string,
  limit?: Limit,
): Promise<LoadedSeries | undefined> {
  return (await loadSeriesAs(db, id, reader, limit)).series;
}

/**
 * `loadSeries`, with the reader's profile from the same statement (undefined when they have none,
 * and then nothing is counted or written for them), marked seen as `profileOf` marks it: the
 * session and the series in one round trip (`sessionWith`).
 */
export async function loadSeriesAs(
  db: Db,
  id: string,
  reader?: string,
  limit?: Limit,
): Promise<{ readonly profile: Profile | undefined; readonly series: LoadedSeries | undefined }> {
  const window = limit === undefined ? null : `${String(limit.windowSeconds)} seconds`;
  const [raw] = await db<Raw[]>`
    with seen as (${markSeen(db, reader ?? null)}), me as (
      select coalesce(username, display_name) as name, username, account_at is not null as account
      from game.profiles where user_id = ${reader ?? null}::uuid
    ), counted as (
      insert into game.rate_limits (subject, bucket, window_start, count)
      select ${reader ?? null}::text, ${limit?.bucket ?? null}::text,
        date_bin(${window}::interval, now(), timestamptz '2000-01-01'), 1
      where ${window}::text is not null and exists (select 1 from me)
      on conflict (subject, bucket, window_start)
        do update set count = game.rate_limits.count + 1
      returning count,
        ceil(extract(epoch from (window_start + ${window}::interval - now())))::integer as retry
    ), beat as (
      insert into game.presence (series_id, side, seen_at)
      select s.id, case when s.player_a = ${reader ?? null}::uuid then 'a' else 'b' end, now()
      from game.series s
      where s.id = ${id} and s.live and s.status = 'open'
        and ${reader ?? null}::uuid in (s.player_a, s.player_b) and exists (select 1 from me)
      on conflict (series_id, side) do update set seen_at = excluded.seen_at
      returning side, seen_at
    )
    select s.id, s.ruleset, s.format, s.best_of, s.player_a, s.player_b,
      coalesce(pa.username, pa.display_name) as name_a,
      coalesce(pb.username, pb.display_name) as name_b, s.lineup_a, s.lineup_b, s.key_id,
      s.status, s.winner, s.version, s.turn, s.turn_deadline,
      (s.status = 'open' and s.turn_deadline < now()) as expired, s.final_setup,
      s.live, now() as now, s.created_at, s.started_at, s.turn_opens_at, s.end_reason,
      (select count from counted) as spent_count, (select retry from counted) as spent_retry,
      exists (select 1 from me) as me_found, (select name from me) as me_name,
      (select username from me) as me_username, (select account from me) as me_account,
      coalesce((select seen_at from beat where side = 'a'),
        (select seen_at from game.presence x where x.series_id = s.id and x.side = 'a')) as seen_a,
      coalesce((select seen_at from beat where side = 'b'),
        (select seen_at from game.presence x where x.series_id = s.id and x.side = 'b')) as seen_b,
      coalesce((
        select json_agg(json_build_object('round', p.round, 'side', p.side, 'ball', p.ball,
          'auto', p.auto)
          order by p.round, p.created_at)
        from game.picks p where p.series_id = s.id), '[]') as picks,
      coalesce((
        select json_agg(json_build_object('round', r.round, 'a', r.a, 'b', r.b, 'seeds', r.seeds,
          'outcomes', r.outcomes, 'winner', r.winner, 'suddenDeath', r.sudden_death,
          'fightAt', (extract(epoch from r.fight_at) * 1000)::bigint,
          'endsAt', (extract(epoch from r.ends_at) * 1000)::bigint)
          order by r.round)
        from game.rounds r where r.series_id = s.id), '[]') as rounds,
      coalesce((
        select json_agg(json_build_object('purpose', x.purpose, 'index', x.idx,
          'salt', encode(x.salt, 'hex'), 'commitment', encode(x.commitment, 'hex'),
          'seed', x.seed)
          order by x.purpose = 'toss' desc, x.purpose, x.idx)
        from game.series_seeds x where x.series_id = s.id), '[]') as seeds
    from (select) as one
    left join game.series s on s.id = ${id}
    left join game.profiles pa on pa.user_id = s.player_a
    left join game.profiles pb on pb.user_id = s.player_b`;
  const profile =
    raw?.me_found === true && reader !== undefined
      ? {
          userId: reader,
          name: raw.me_name ?? '',
          username: raw.me_username,
          account: raw.me_account === true,
        }
      : undefined;
  if (raw?.id == null) return { profile, series: undefined };
  return { profile, series: seriesOf(raw, raw.id) };
}

function seriesOf(raw: Raw, id: string): LoadedSeries {
  const spent =
    raw.spent_count === null
      ? {}
      : { spent: { count: raw.spent_count, retry: raw.spent_retry ?? 1 } };
  return {
    ...spent,
    id,
    ruleset: raw.ruleset,
    format: raw.format,
    bestOf: raw.best_of,
    players: { a: raw.player_a, b: raw.player_b },
    names: { a: raw.name_a, b: raw.name_b },
    lineups: { a: raw.lineup_a, b: raw.lineup_b },
    keyId: raw.key_id,
    status: raw.status,
    winner: raw.winner,
    version: raw.version,
    turn: raw.turn,
    deadline: raw.turn_deadline,
    // A live turn never forfeits for time: its pick is made at random (live.ts).
    expired: raw.expired && !raw.live,
    final: raw.final_setup,
    picks: raw.picks.map(({ round, side, ball }) => ({ round, side, ball })),
    rounds: raw.rounds.map(({ round, a, b, seeds, outcomes, winner, suddenDeath }) => ({
      round,
      a,
      b,
      seeds,
      outcomes,
      winner,
      suddenDeath,
    })),
    seeds: raw.seeds,
    live: raw.live ? clockOf(raw) : null,
  };
}

function clockOf(raw: Raw): LiveClock {
  return {
    now: raw.now.getTime(),
    createdAt: raw.created_at.getTime(),
    startedAt: msOf(raw.started_at),
    opensAt: msOf(raw.turn_opens_at),
    seen: { a: msOf(raw.seen_a), b: msOf(raw.seen_b) },
    fights: raw.rounds.flatMap(({ round, fightAt, endsAt }) =>
      fightAt === null || endsAt === null ? [] : [{ round, fightAt, endsAt }],
    ),
    auto: raw.picks.filter((p) => p.auto).map(({ round, side }) => ({ round, side })),
    endReason: raw.end_reason,
  };
}
