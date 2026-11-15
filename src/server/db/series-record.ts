// A series in one query, and every change to it in one statement (ADR 0052; the functions run far
// from the database, so each round trip costs ~200 ms). `loadSeries` reads the row with its picks,
// rounds and seeds as JSON aggregates. `writeSeries` applies a whole move (the series row, a new
// pick, rounds played, seeds revealed) as data-modifying CTEs that all hang off one guarded
// update: `where version = $version`. A request that raced another one writes nothing and gets
// undefined, so it reloads and tries again: the same one-at-a-time guarantee a row lock gave,
// without holding a transaction open across the network.
import type { SeriesStatus, Turn } from '../../api/series.ts';
import type { PickRecord, RoundRecord, SeriesSetup, Side } from '../../sim/index.ts';
import type { Sql, TransactionSql } from '../db.ts';
import type { SeedRow } from '../view.ts';
import { TURN_HOURS, type SeriesRow } from './series.ts';

type Db = Sql | TransactionSql;

export interface LoadedSeries extends SeriesRow {
  readonly picks: readonly PickRecord[];
  readonly rounds: readonly RoundRecord[];
  readonly seeds: readonly SeedRow[];
}

interface Raw {
  readonly id: string;
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
  readonly picks: PickRecord[];
  readonly rounds: RoundRecord[];
  readonly seeds: SeedRow[];
}

/** The series with everything about it, in one round trip; undefined when there is none. */
export async function loadSeries(db: Db, id: string): Promise<LoadedSeries | undefined> {
  const [raw] = await db<Raw[]>`
    select s.id, s.ruleset, s.format, s.best_of, s.player_a, s.player_b,
      pa.display_name as name_a, pb.display_name as name_b, s.lineup_a, s.lineup_b, s.key_id,
      s.status, s.winner, s.version, s.turn, s.turn_deadline,
      (s.status = 'open' and s.turn_deadline < now()) as expired, s.final_setup,
      coalesce((
        select json_agg(json_build_object('round', p.round, 'side', p.side, 'ball', p.ball)
          order by p.round, p.created_at)
        from game.picks p where p.series_id = s.id), '[]') as picks,
      coalesce((
        select json_agg(json_build_object('round', r.round, 'a', r.a, 'b', r.b, 'seeds', r.seeds,
          'outcomes', r.outcomes, 'winner', r.winner, 'suddenDeath', r.sudden_death)
          order by r.round)
        from game.rounds r where r.series_id = s.id), '[]') as rounds,
      coalesce((
        select json_agg(json_build_object('purpose', x.purpose, 'index', x.idx,
          'salt', encode(x.salt, 'hex'), 'commitment', encode(x.commitment, 'hex'),
          'seed', x.seed)
          order by x.purpose = 'toss' desc, x.purpose, x.idx)
        from game.series_seeds x where x.series_id = s.id), '[]') as seeds
    from game.series s
    left join game.profiles pa on pa.user_id = s.player_a
    left join game.profiles pb on pb.user_id = s.player_b
    where s.id = ${id}`;
  if (raw === undefined) return undefined;
  return {
    id: raw.id,
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
    expired: raw.expired,
    final: raw.final_setup,
    picks: raw.picks,
    rounds: raw.rounds,
    seeds: raw.seeds,
  };
}

/** One move of a series: what the row becomes, and the rows it adds or reveals. */
export interface SeriesMove {
  readonly turn: Turn | null;
  /** Keep the current turn's deadline (Showdown's opener, locked by one side first). */
  readonly keepDeadline: boolean;
  readonly status: SeriesStatus;
  readonly winner: Side | null;
  readonly final: SeriesSetup | null;
  readonly picks: readonly PickRecord[];
  readonly rounds: readonly RoundRecord[];
  readonly reveals: readonly {
    readonly purpose: string;
    readonly index: number;
    readonly seed: number;
  }[];
}

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
  const rounds = move.rounds.map((round) => ({
    round: round.round,
    a: round.a,
    b: round.b,
    seeds: round.seeds,
    outcomes: round.outcomes,
    winner: round.winner,
    sudden_death: round.suddenDeath,
  }));
  const [row] = await db<{ readonly version: number; readonly turn_deadline: Date | null }[]>`
    with moved as (
      update game.series set
        turn = ${move.turn},
        turn_deadline = case
          when ${move.turn}::text is null then null
          when ${move.keepDeadline} then turn_deadline
          else now() + make_interval(hours => ${TURN_HOURS})
        end,
        status = ${move.status},
        winner = ${move.winner},
        finished_at = case when ${open} then null else now() end,
        final_setup = ${move.final === null ? null : db.json(move.final)},
        version = version + 1
      where id = ${id} and version = ${version}
      returning id, version, turn_deadline
    ), picked as (
      insert into game.picks (series_id, round, side, ball)
      select moved.id, x.round, x.side, x.ball
      from moved, jsonb_to_recordset(${db.json(move.picks)}::jsonb)
        as x(round integer, side text, ball text)
      on conflict (series_id, round, side) do nothing
    ), played as (
      insert into game.rounds (series_id, round, a, b, seeds, outcomes, winner, sudden_death)
      select moved.id, x.round, x.a, x.b,
        array(select jsonb_array_elements_text(x.seeds)::bigint),
        array(select jsonb_array_elements_text(x.outcomes)),
        x.winner, x.sudden_death
      from moved, jsonb_to_recordset(${db.json(rounds)}::jsonb)
        as x(round integer, a text, b text, seeds jsonb, outcomes jsonb, winner text,
          sudden_death boolean)
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
