// A rematch's row (ADR 0055) and the facts of the series it follows, read in one query with the
// database's clock. Writes are single statements guarded by the state they move from, so a raced
// answer changes nothing it shouldn't; the service locks the series row for every move.
import type { BestOf, Format, Side } from '../../sim/index.ts';
import { REMATCH_ANSWER_MS } from '../../api/rematch.ts';
import type { Sql, TransactionSql } from '../db.ts';

type Db = Sql | TransactionSql;

export interface RematchRow {
  readonly players: Readonly<Record<Side, string | null>>;
  readonly live: boolean;
  readonly status: string;
  readonly format: Format;
  readonly bestOf: BestOf;
  /**
   * When both players saw the series end (ms since the epoch): its last fight's end, or the moment
   * it was decided when that came later (a forfeit). Null while open.
   */
  readonly finished: number | null;
  readonly askedBy: Side | null;
  readonly asked: number | null;
  readonly agreed: number | null;
  readonly declinedBy: Side | null;
  /** The lineups picked together once both said yes (ADR 0080): its id, deadline, who is in. */
  readonly start: {
    readonly id: string;
    readonly deadline: number;
    readonly locked: Readonly<Record<Side, boolean>>;
  } | null;
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
      start_id: string | null;
      deadline: number | null;
      locked_a: boolean;
      locked_b: boolean;
      new_series_id: string | null;
      now: number;
    }[]
  >`
    select s.player_a, s.player_b, s.live, s.status, s.format, s.best_of,
      (extract(epoch from greatest(s.finished_at,
        (select max(f.ends_at) from game.rounds f where f.series_id = s.id))) * 1000)::float8
        as finished,
      r.asked_by, (extract(epoch from r.asked_at) * 1000)::float8 as asked,
      (extract(epoch from r.agreed_at) * 1000)::float8 as agreed,
      r.declined_by, st.id as start_id,
      (extract(epoch from st.deadline_at) * 1000)::float8 as deadline,
      st.locked_a is not null as locked_a, st.locked_b is not null as locked_b,
      coalesce(st.series_id, r.new_series_id) as new_series_id,
      (extract(epoch from now()) * 1000)::float8 as now
    from game.series s left join game.rematches r on r.series_id = s.id
    left join game.starts st on st.rematch_of = s.id
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
    start:
      row.start_id === null || row.deadline === null
        ? null
        : {
            id: row.start_id,
            deadline: row.deadline,
            locked: { a: row.locked_a, b: row.locked_b },
          },
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

/**
 * The rematch `from` asked of `to` that still waits for an answer (ADR 0089 addendum of
 * 2026-11-28: one live invitation per pair), by its series' id; read with both players' locks held.
 */
export async function rematchAskedOf(
  db: Db,
  from: string,
  to: string,
): Promise<string | undefined> {
  const [row] = await db<{ series_id: string }[]>`
    select r.series_id from game.rematches r join game.series s on s.id = r.series_id
    where r.agreed_at is null and r.declined_by is null and r.new_series_id is null
      and r.asked_at > now() - make_interval(secs => ${REMATCH_ANSWER_MS / 1000})
      and ((r.asked_by = 'a' and s.player_a = ${from} and s.player_b = ${to})
        or (r.asked_by = 'b' and s.player_b = ${from} and s.player_a = ${to}))
    order by r.asked_at desc
    limit 1`;
  return row?.series_id;
}

/**
 * Takes back every rematch `player` asked that still waits, but the one after `keep` (one live
 * invitation out at a time, as `supersedeOutgoing`). Each change pokes both of its players.
 */
export async function withdrawRematchAsks(db: Db, player: string, keep?: string): Promise<void> {
  await db`
    update game.rematches r set declined_by = r.asked_by
    from game.series s
    where s.id = r.series_id and r.agreed_at is null and r.declined_by is null
      and r.asked_at > now() - make_interval(secs => ${REMATCH_ANSWER_MS / 1000})
      and ((r.asked_by = 'a' and s.player_a = ${player}) or (r.asked_by = 'b' and s.player_b = ${player}))
      ${keep === undefined ? db`` : db`and r.series_id <> ${keep}`}`;
}

/**
 * Ends every rematch offer between `x` and `y` still waiting for an answer, as a No thanks from
 * the one asked (a block, ADR 0079: the blocked player never reaches the blocker again).
 */
export async function declineRematchesBetween(db: Db, x: string, y: string): Promise<void> {
  await db`
    update game.rematches r set declined_by = case when r.asked_by = 'a' then 'b' else 'a' end
    from game.series s
    where s.id = r.series_id and r.asked_by is not null and r.agreed_at is null
      and r.declined_by is null
      and ((s.player_a = ${x} and s.player_b = ${y}) or (s.player_a = ${y} and s.player_b = ${x}))`;
}

/** The two players of a series (fixed once made), read before their locks are taken. */
export async function seriesPlayers(
  db: Db,
  seriesId: string,
): Promise<readonly string[] | undefined> {
  const [row] = await db<{ player_a: string | null; player_b: string | null }[]>`
    select player_a, player_b from game.series where id = ${seriesId}`;
  if (row === undefined) return undefined;
  return [row.player_a, row.player_b].filter((one): one is string => one !== null);
}
