// game.series and its rows (seeds, picks, rounds): plain SQL, one function per statement. Every
// time in a rule is the database's `now()` (ADR 0052, section 6 item 7): a host clock never decides
// a deadline.
import type { SeriesStatus, Turn } from '../../api/series.ts';
import type {
  BestOf,
  Format,
  Outcome,
  PickRecord,
  RoundRecord,
  SeriesSetup,
  Side,
} from '../../sim/index.ts';
import type { Sql, TransactionSql } from '../db.ts';
import type { SeedRow } from '../view.ts';

type Db = Sql | TransactionSql;

/** How long a player has for each turn. */
export const TURN_HOURS = 24;

export interface SeriesRow {
  readonly id: string;
  readonly ruleset: number;
  readonly format: Format;
  readonly bestOf: BestOf;
  readonly players: Readonly<Record<Side, string | null>>;
  readonly names: Readonly<Record<Side, string | null>>;
  readonly lineups: Readonly<Record<Side, readonly string[]>>;
  readonly keyId: string;
  readonly status: SeriesStatus;
  readonly winner: Side | null;
  readonly version: number;
  readonly turn: Turn | null;
  readonly deadline: Date | null;
  /** The turn ran out by database time (and nobody has settled it yet). */
  readonly expired: boolean;
  readonly final: SeriesSetup | null;
}

interface RawSeries {
  readonly id: string;
  readonly ruleset: number;
  readonly format: Format;
  readonly best_of: BestOf;
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
}

const rowOf = (raw: RawSeries): SeriesRow => ({
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
});

/** A series with its players' names; `lock` holds it for this transaction (`FOR UPDATE`). */
export async function seriesById(db: Db, id: string, lock = false): Promise<SeriesRow | undefined> {
  const forUpdate = lock ? db`for update of s` : db``;
  const [raw] = await db<RawSeries[]>`
    select s.id, s.ruleset, s.format, s.best_of, s.player_a, s.player_b,
      pa.display_name as name_a, pb.display_name as name_b, s.lineup_a, s.lineup_b, s.key_id,
      s.status, s.winner, s.version, s.turn, s.turn_deadline,
      (s.status = 'open' and s.turn_deadline < now()) as expired, s.final_setup
    from game.series s
    left join game.profiles pa on pa.user_id = s.player_a
    left join game.profiles pb on pb.user_id = s.player_b
    where s.id = ${id}
    ${forUpdate}`;
  return raw === undefined ? undefined : rowOf(raw);
}

export interface NewSeries {
  readonly id: string;
  readonly kind: 'friend';
  readonly ruleset: number;
  readonly format: Format;
  readonly bestOf: BestOf;
  readonly players: Readonly<Record<Side, string>>;
  readonly lineups: Readonly<Record<Side, readonly string[]>>;
  readonly keyId: string;
}

export async function insertSeries(db: Db, series: NewSeries): Promise<void> {
  await db`
    insert into game.series (id, kind, ruleset, format, best_of, player_a, player_b, lineup_a,
      lineup_b, key_id)
    values (${series.id}, ${series.kind}, ${series.ruleset}, ${series.format}, ${series.bestOf},
      ${series.players.a}, ${series.players.b}, ${[...series.lineups.a]}, ${[...series.lineups.b]},
      ${series.keyId})`;
}

export async function insertSeeds(db: Db, id: string, seeds: readonly SeedRow[]): Promise<void> {
  for (const seed of seeds) {
    await db`
      insert into game.series_seeds (series_id, purpose, idx, salt, commitment)
      values (${id}, ${seed.purpose}, ${seed.index}, ${Buffer.from(seed.salt, 'hex')},
        ${Buffer.from(seed.commitment, 'hex')})`;
  }
}

export async function seedsOf(db: Db, id: string): Promise<SeedRow[]> {
  const rows = await db<
    {
      purpose: SeedRow['purpose'];
      idx: number;
      salt: Buffer;
      commitment: Buffer;
      seed: number | null;
    }[]
  >`
    select purpose, idx, salt, commitment, seed from game.series_seeds
    where series_id = ${id} order by purpose = 'toss' desc, purpose, idx`;
  return rows.map((row) => ({
    purpose: row.purpose,
    index: row.idx,
    salt: row.salt.toString('hex'),
    commitment: row.commitment.toString('hex'),
    seed: row.seed,
  }));
}

/** Reveals seeds: from now on they and their salts are in every view. */
export async function revealSeeds(
  db: Db,
  id: string,
  seeds: readonly {
    readonly purpose: SeedRow['purpose'];
    readonly index: number;
    readonly seed: number;
  }[],
): Promise<void> {
  for (const { purpose, index, seed } of seeds) {
    await db`
      update game.series_seeds set seed = ${seed}, revealed_at = now()
      where series_id = ${id} and purpose = ${purpose} and idx = ${index} and seed is null`;
  }
}

export async function picksOf(db: Db, id: string): Promise<PickRecord[]> {
  return db<PickRecord[]>`
    select round, side, ball from game.picks where series_id = ${id} order by round, created_at`;
}

/** Locks a pick; false when one is already locked for that round and side (the first wins). */
export async function insertPick(db: Db, id: string, pick: PickRecord): Promise<boolean> {
  const rows = await db`
    insert into game.picks (series_id, round, side, ball)
    values (${id}, ${pick.round}, ${pick.side}, ${pick.ball})
    on conflict (series_id, round, side) do nothing
    returning 1`;
  return rows.length === 1;
}

export async function roundsOf(db: Db, id: string): Promise<RoundRecord[]> {
  const rows = await db<
    {
      round: number;
      a: string;
      b: string;
      seeds: number[];
      outcomes: Outcome[];
      winner: Side;
      sudden_death: boolean;
    }[]
  >`
    select round, a, b, seeds, outcomes, winner, sudden_death from game.rounds
    where series_id = ${id} order by round`;
  return rows.map((row) => ({
    round: row.round,
    a: row.a,
    b: row.b,
    seeds: row.seeds.map(Number),
    outcomes: row.outcomes,
    winner: row.winner,
    suddenDeath: row.sudden_death,
  }));
}

export async function insertRound(db: Db, id: string, round: RoundRecord): Promise<void> {
  await db`
    insert into game.rounds (series_id, round, a, b, seeds, outcomes, winner, sudden_death)
    values (${id}, ${round.round}, ${round.a}, ${round.b}, ${round.seeds.map(String)}::bigint[],
      ${[...round.outcomes]}, ${round.winner}, ${round.suddenDeath})`;
}

/** What changes when a series moves on. The deadline restarts unless `keepDeadline`. */
export interface SeriesChange {
  readonly turn: Turn | null;
  readonly keepDeadline: boolean;
  readonly status: SeriesStatus;
  readonly winner: Side | null;
  readonly final: SeriesSetup | null;
}

export async function updateSeries(db: Db, id: string, change: SeriesChange): Promise<void> {
  const open = change.status === 'open';
  await db`
    update game.series set
      turn = ${change.turn},
      turn_deadline = case
        when ${change.turn}::text is null then null
        when ${change.keepDeadline} then turn_deadline
        else now() + make_interval(hours => ${TURN_HOURS})
      end,
      status = ${change.status},
      winner = ${change.winner},
      finished_at = case when ${open} then null else now() end,
      final_setup = ${change.final === null ? null : db.json(change.final)},
      version = version + 1
    where id = ${id}`;
}

/**
 * Settles every turn that ran out (ADR 0052: 24 hours by database time): the side due forfeits
 * the series; when both were due (Showdown's round 1) nobody wins. `id` limits it to one series.
 */
export async function settleExpired(db: Db, id?: string): Promise<number> {
  const only = id === undefined ? db`` : db`and id = ${id}`;
  const rows = await db`
    update game.series set
      status = 'forfeit',
      winner = case turn when 'a' then 'b' when 'b' then 'a' else null end,
      turn = null, turn_deadline = null, finished_at = now(), version = version + 1
    where status = 'open' and turn_deadline < now() ${only}
    returning 1`;
  return rows.length;
}
