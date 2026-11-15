// Every change to a series in one statement (ADR 0052): data-modifying CTEs that all hang off one
// guarded update, `where version = $version`. A request that raced another one writes nothing and
// gets undefined, so it reloads and tries again: the same one-at-a-time guarantee a row lock gave,
// without holding a transaction open across the network.
import type { SeriesStatus, Turn } from '../../api/series.ts';
import type { PickRecord, RoundRecord, SeriesSetup, Side } from '../../sim/index.ts';
import type { Sql, TransactionSql } from '../db.ts';
import type { EndReason, FightTime } from '../live.ts';
import { TURN_HOURS } from './series.ts';

type Db = Sql | TransactionSql;

/** A live series' times for a move (ADR 0053), by the database's clock (ms since the epoch). */
export interface LiveTiming {
  /** The next pick phase, when one is due. */
  readonly opensAt: number | null;
  readonly deadline: number | null;
  /** Set once, when both players have arrived. */
  readonly startedAt: number | null;
  /** The fights of the rounds this move plays. */
  readonly fights: readonly FightTime[];
}

/** One move of a series: what the row becomes, and the rows it adds or reveals. */
export interface SeriesMove {
  readonly turn: Turn | null;
  /** Keep the current turn's deadline (Showdown's opener, locked by one side first). */
  readonly keepDeadline: boolean;
  readonly status: SeriesStatus;
  readonly winner: Side | null;
  readonly final: SeriesSetup | null;
  readonly picks: readonly (PickRecord & { readonly auto?: boolean })[];
  readonly rounds: readonly RoundRecord[];
  readonly reveals: readonly {
    readonly purpose: string;
    readonly index: number;
    readonly seed: number;
  }[];
  /** A live series' times; absent for a series by turns (24 hours a turn). */
  readonly live?: LiveTiming;
}

// ISO text, sent as `unknown` and cast, keeps the write one round trip (db.ts).
const at = (ms: number | null | undefined): string | null =>
  ms == null ? null : new Date(ms).toISOString();

/**
 * Applies `move` if the series is still at `version`: the new version and deadline, or undefined
 * when another request moved the series first (nothing was written).
 */
export async function writeSeries(
  db: Db,
  id: string,
  version: number,
  move: SeriesMove,
): Promise<{ readonly version: number; readonly deadline: Date | null } | undefined> {
  const open = move.status === 'open';
  const live = move.live;
  const fightOf = (round: number) => live?.fights.find((f) => f.round === round);
  const rounds = move.rounds.map((round) => ({
    round: round.round,
    a: round.a,
    b: round.b,
    seeds: round.seeds,
    outcomes: round.outcomes,
    winner: round.winner,
    sudden_death: round.suddenDeath,
    fight_at: fightOf(round.round)?.fightAt ?? null,
    ends_at: fightOf(round.round)?.endsAt ?? null,
  }));
  const picks = move.picks.map(({ round, side, ball, auto }) => ({
    round,
    side,
    ball,
    auto: auto === true,
  }));
  const [row] = await db<{ readonly version: number; readonly turn_deadline: Date | null }[]>`
    with moved as (
      update game.series set
        turn = ${move.turn},
        turn_deadline = case
          when ${move.turn}::text is null then null
          when ${move.keepDeadline} then turn_deadline
          when ${live !== undefined} then ${at(live?.deadline)}::timestamptz
          else now() + make_interval(hours => ${TURN_HOURS})
        end,
        turn_opens_at = case
          when ${move.turn}::text is null or not live then null
          when ${move.keepDeadline} then turn_opens_at
          else ${at(live?.opensAt)}::timestamptz
        end,
        started_at = coalesce(started_at, ${at(live?.startedAt)}::timestamptz),
        status = ${move.status},
        winner = ${move.winner},
        finished_at = case when ${open} then null else now() end,
        final_setup = ${move.final === null ? null : db.json(move.final)},
        version = version + 1
      where id = ${id} and version = ${version}
      returning id, version, turn_deadline
    ), picked as (
      insert into game.picks (series_id, round, side, ball, auto)
      select moved.id, x.round, x.side, x.ball, x.auto
      from moved, jsonb_to_recordset(${db.json(picks)}::jsonb)
        as x(round integer, side text, ball text, auto boolean)
      on conflict (series_id, round, side) do nothing
    ), played as (
      insert into game.rounds (series_id, round, a, b, seeds, outcomes, winner, sudden_death,
        fight_at, ends_at)
      select moved.id, x.round, x.a, x.b,
        array(select jsonb_array_elements_text(x.seeds)::bigint),
        array(select jsonb_array_elements_text(x.outcomes)),
        x.winner, x.sudden_death,
        to_timestamp(x.fight_at / 1000.0), to_timestamp(x.ends_at / 1000.0)
      from moved, jsonb_to_recordset(${db.json(rounds)}::jsonb)
        as x(round integer, a text, b text, seeds jsonb, outcomes jsonb, winner text,
          sudden_death boolean, fight_at float8, ends_at float8)
    ), revealed as (
      update game.series_seeds s set seed = x.seed, revealed_at = now()
      from moved, jsonb_to_recordset(${db.json(move.reveals)}::jsonb)
        as x(purpose text, index integer, seed bigint)
      where s.series_id = moved.id and s.purpose = x.purpose and s.idx = x.index
        and s.seed is null
    )
    select version, turn_deadline from moved`;
  return row === undefined ? undefined : { version: row.version, deadline: row.turn_deadline };
}

/**
 * Ends an open live series by forfeit (ADR 0053) if it is still at `version`: to `winner`, or to
 * nobody when neither player arrived. Reveals nothing more (as a forfeit by turns). False when
 * another request moved the series first.
 */
export async function forfeitSeries(
  db: Db,
  id: string,
  version: number,
  winner: Side | null,
  reason: EndReason,
): Promise<boolean> {
  const rows = await db`
    update game.series set
      status = 'forfeit', winner = ${winner}, end_reason = ${reason}, turn = null,
      turn_deadline = null, turn_opens_at = null, finished_at = now(), version = version + 1
    where id = ${id} and version = ${version} and status = 'open'
    returning 1`;
  return rows.length > 0;
}
