// game.series and its rows (seeds, picks, rounds): plain SQL, one function per statement. Every
// time in a rule is the database's `now()` (ADR 0052, section 6 item 7): a host clock never decides
// a deadline.
import type { SeriesStatus, Turn } from '../../api/series.ts';
import type { BestOf, Format, SeriesSetup, Side } from '../../sim/index.ts';
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

export interface NewSeries extends Omit<SeriesRow, 'names' | 'expired'> {
  readonly kind: 'friend';
  /** Played live (ADR 0053). */
  readonly live: boolean;
}

/** A new series and its committed seeds (salts and commitments, no seed yet), in one statement. */
export async function insertSeriesWithSeeds(
  db: Db,
  series: NewSeries,
  seeds: readonly SeedRow[],
): Promise<void> {
  const rows = seeds.map(({ purpose, index, salt, commitment }) => ({
    purpose,
    idx: index,
    salt,
    commitment,
  }));
  await db`
    with made as (
      insert into game.series (id, kind, ruleset, format, best_of, player_a, player_b, lineup_a,
        lineup_b, key_id, live)
      values (${series.id}, ${series.kind}, ${series.ruleset}, ${series.format}, ${series.bestOf},
        ${series.players.a}, ${series.players.b}, ${[...series.lineups.a]},
        ${[...series.lineups.b]}, ${series.keyId}, ${series.live})
      returning id
    )
    insert into game.series_seeds (series_id, purpose, idx, salt, commitment)
    select made.id, x.purpose, x.idx, decode(x.salt, 'hex'), decode(x.commitment, 'hex')
    from made, jsonb_to_recordset(${db.json(rows)}::jsonb)
      as x(purpose text, idx integer, salt text, commitment text)`;
}

/**
 * Settles every turn by turns that ran out (ADR 0052: 24 hours by database time): the side due
 * forfeits the series; when both were due (Showdown's round 1) nobody wins. `id` limits it to one
 * series. A live series never forfeits for time (its pick is made at random, live-service.ts).
 */
export async function settleExpired(db: Db, id?: string): Promise<number> {
  const only = id === undefined ? db`` : db`and id = ${id}`;
  const rows = await db`
    update game.series set
      status = 'forfeit',
      winner = case turn when 'a' then 'b' when 'b' then 'a' else null end, end_reason = 'timeout',
      turn = null, turn_deadline = null, finished_at = now(), version = version + 1
    where status = 'open' and not live and turn_deadline < now() ${only}
    returning 1`;
  return rows.length;
}
