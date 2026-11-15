// A rematch's row (ADR 0055) and the facts of the series it follows, read in one query with the
// database's clock. Writes are single statements guarded by the state they move from, so a raced
// answer changes nothing it shouldn't; the service locks the series row for every move.
import type { BestOf, Format, Side } from '../../sim/index.ts';
import type { Sql, TransactionSql } from '../db.ts';

type Db = Sql | TransactionSql;

export interface RematchRow {
  readonly players: Readonly<Record<Side, string | null>>;
  readonly live: boolean;
  readonly status: string;
  readonly format: Format;
  readonly bestOf: BestOf;
  /** When the series ended (ms since the epoch); null while open. */
  readonly finished: number | null;
  readonly askedBy: Side | null;
  readonly asked: number | null;
  readonly agreed: number | null;
  readonly declinedBy: Side | null;
  readonly lineups: Readonly<Record<Side, readonly string[] | null>>;
  readonly newSeriesId: string | null;
  /** The database's clock at the read. */
  readonly now: number;
}

/** The series and its rematch, if any; `lock` first holds the series row for the transaction. */
export async function rematchRow(
  db: Db,
  seriesId: string,
  lock = false,
): Promise<RematchRow | undefined> {
  // The lock is its own statement: under read committed a `for update` that waited reads the
  // locked row afresh but a joined row from before the wait, so the rematch another host just
  // asked would be missed. The read after it sees everything committed before the lock was got.
  if (lock) await db`select 1 from game.series where id = ${seriesId} for update`;
  const [row] = await db<
    {
      player_a: string | null;
      player_b: string | null;
      live: boolean;
      status: string;
      format: Format;
      best_of: BestOf;
      finished: number | null;
      asked_by: Side | null;
      asked: number | null;
      agreed: number | null;
      declined_by: Side | null;
      lineup_a: string[] | null;
      lineup_b: string[] | null;
      new_series_id: string | null;
      now: number;
    }[]
  >`
    select s.player_a, s.player_b, s.live, s.status, s.format, s.best_of,
      (extract(epoch from s.finished_at) * 1000)::float8 as finished,
      r.asked_by, (extract(epoch from r.asked_at) * 1000)::float8 as asked,
      (extract(epoch from r.agreed_at) * 1000)::float8 as agreed,
      r.declined_by, r.lineup_a, r.lineup_b, r.new_series_id,
      (extract(epoch from now()) * 1000)::float8 as now
    from game.series s left join game.rematches r on r.series_id = s.id
    where s.id = ${seriesId}`;
  if (row === undefined) return undefined;
  return {
    players: { a: row.player_a, b: row.player_b },
    live: row.live,
    status: row.status,
    format: row.format,
    bestOf: row.best_of,
    finished: row.finished,
    askedBy: row.asked_by,
    asked: row.asked,
    agreed: row.agreed,
    declinedBy: row.declined_by,
    lineups: { a: row.lineup_a, b: row.lineup_b },
    newSeriesId: row.new_series_id,
    now: row.now,
  };
}

/** `side` asks for a rematch: the first ask makes the row; a second changes nothing. */
export async function askRematch(db: Db, seriesId: string, side: Side): Promise<void> {
  await db`
    insert into game.rematches (series_id, asked_by) values (${seriesId}, ${side})
    on conflict (series_id) do nothing`;
}

/** The other player says yes. */
export async function agreeRematch(db: Db, seriesId: string): Promise<void> {
  await db`
    update game.rematches set agreed_at = now()
    where series_id = ${seriesId} and agreed_at is null and declined_by is null`;
}

/** `side` says no (or takes back their own ask). */
export async function declineRematch(db: Db, seriesId: string, side: Side): Promise<void> {
  await db`
    update game.rematches set declined_by = ${side}
    where series_id = ${seriesId} and agreed_at is null and declined_by is null`;
}

/** `side`'s new lineup is in. */
export async function setRematchLineup(
  db: Db,
  seriesId: string,
  side: Side,
  lineup: readonly string[],
): Promise<void> {
  if (side === 'a') {
    await db`update game.rematches set lineup_a = ${[...lineup]} where series_id = ${seriesId}`;
  } else {
    await db`update game.rematches set lineup_b = ${[...lineup]} where series_id = ${seriesId}`;
  }
}

/** The new match started. */
export async function startedRematch(db: Db, seriesId: string, newSeriesId: string): Promise<void> {
  await db`
    update game.rematches set new_series_id = ${newSeriesId}
    where series_id = ${seriesId} and new_series_id is null`;
}
