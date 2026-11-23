// game.starts (ADR 0080): both lineups picked at once after a live challenge or rematch was agreed.
// Every time is the database's: the deadline is written at the agreement and read against `now()`.
// Writes are single statements guarded by the state they move from (not made yet, not locked, an
// older draft), so a raced or retried request changes nothing it shouldn't; making the series locks
// the row first.
import type { BestOf, Format, Side } from '../../sim/index.ts';
import type { Sql, TransactionSql } from '../db.ts';

type Db = Sql | TransactionSql;

export interface StartRow {
  readonly id: string;
  readonly players: Readonly<Record<Side, string>>;
  readonly names: Readonly<Record<Side, string | null>>;
  readonly format: Format;
  readonly bestOf: BestOf;
  readonly rematchOf: string | null;
  /** The deadline and the database's clock at the read, ms since the epoch. */
  readonly deadline: number;
  readonly now: number;
  readonly opened: Readonly<Record<Side, boolean>>;
  readonly drafts: Readonly<Record<Side, readonly string[]>>;
  readonly seqs: Readonly<Record<Side, number>>;
  readonly locked: Readonly<Record<Side, boolean>>;
  readonly seriesId: string | null;
}

interface Raw {
  readonly id: string;
  readonly player_a: string;
  readonly player_b: string;
  readonly name_a: string | null;
  readonly name_b: string | null;
  readonly format: Format;
  readonly best_of: BestOf;
  readonly rematch_of: string | null;
  readonly deadline: number;
  readonly now: number;
  readonly opened_a: boolean;
  readonly opened_b: boolean;
  readonly draft_a: string[];
  readonly draft_b: string[];
  readonly draft_seq_a: number;
  readonly draft_seq_b: number;
  readonly locked_a: boolean;
  readonly locked_b: boolean;
  readonly series_id: string | null;
}

const rowOf = (raw: Raw): StartRow => ({
  id: raw.id,
  players: { a: raw.player_a, b: raw.player_b },
  names: { a: raw.name_a, b: raw.name_b },
  format: raw.format,
  bestOf: raw.best_of,
  rematchOf: raw.rematch_of,
  deadline: raw.deadline,
  now: raw.now,
  opened: { a: raw.opened_a, b: raw.opened_b },
  drafts: { a: raw.draft_a, b: raw.draft_b },
  seqs: { a: raw.draft_seq_a, b: raw.draft_seq_b },
  locked: { a: raw.locked_a, b: raw.locked_b },
  seriesId: raw.series_id,
});

/**
 * The start, as of now. `lock` first holds its row for the transaction, in a statement of its own:
 * under read committed a waiting `for update` reads joined rows from before the wait.
 */
export async function startRow(db: Db, id: string, lock = false): Promise<StartRow | undefined> {
  if (lock) await db`select 1 from game.starts where id = ${id} for update`;
  const [raw] = await db<Raw[]>`
    select st.id, st.player_a, st.player_b, st.format, st.best_of, st.rematch_of,
      coalesce(pa.username, pa.display_name) as name_a,
      coalesce(pb.username, pb.display_name) as name_b,
      (extract(epoch from st.deadline_at) * 1000)::float8 as deadline,
      (extract(epoch from now()) * 1000)::float8 as now,
      st.opened_a is not null as opened_a, st.opened_b is not null as opened_b,
      st.draft_a, st.draft_b, st.draft_seq_a, st.draft_seq_b,
      st.locked_a is not null as locked_a, st.locked_b is not null as locked_b, st.series_id
    from game.starts st
    left join game.profiles pa on pa.user_id = st.player_a
    left join game.profiles pb on pb.user_id = st.player_b
    where st.id = ${id}`;
  return raw === undefined ? undefined : rowOf(raw);
}

export interface NewStart {
  readonly players: Readonly<Record<Side, string>>;
  readonly format: Format;
  readonly bestOf: BestOf;
  readonly lineupMs: number;
  readonly rematchOf?: string;
}

/** A new start; returns its id. A rematch's second start is refused by its unique key. */
export async function insertStart(db: Db, start: NewStart): Promise<string> {
  const [row] = await db<{ id: string }[]>`
    insert into game.starts (player_a, player_b, format, best_of, rematch_of, deadline_at)
    values (${start.players.a}, ${start.players.b}, ${start.format}, ${start.bestOf},
      ${start.rematchOf ?? null}, now() + make_interval(secs => ${start.lineupMs / 1000}))
    returning id`;
  if (row === undefined) throw new Error('A start just made is missing');
  return row.id;
}

/**
 * `side` read the start: it has opened the lineup (the first time is kept). Only before the
 * deadline: a lineup first opened after time ran out was never opened in time.
 */
export async function markOpened(db: Db, id: string, side: Side): Promise<void> {
  if (side === 'a') {
    await db`update game.starts set opened_a = coalesce(opened_a, now())
      where id = ${id} and series_id is null and deadline_at > now()`;
  } else {
    await db`update game.starts set opened_b = coalesce(opened_b, now())
      where id = ${id} and series_id is null and deadline_at > now()`;
  }
}

/**
 * `side`'s lineup so far, or locked in: written only before the deadline, while the start is not
 * made and that side not locked, and (a draft) newer than the one held.
 */
export async function writeDraft(
  db: Db,
  id: string,
  side: Side,
  move: { readonly lineup: readonly string[]; readonly lock: boolean; readonly seq: number },
): Promise<void> {
  const lineup = [...move.lineup];
  const lockedAt = move.lock ? db`now()` : db`null`;
  if (side === 'a') {
    await db`
      update game.starts set draft_a = ${lineup}, draft_seq_a = greatest(draft_seq_a, ${move.seq}),
        locked_a = ${lockedAt}, opened_a = coalesce(opened_a, now())
      where id = ${id} and series_id is null and locked_a is null and deadline_at > now()
        and (${move.lock} or draft_seq_a < ${move.seq})`;
  } else {
    await db`
      update game.starts set draft_b = ${lineup}, draft_seq_b = greatest(draft_seq_b, ${move.seq}),
        locked_b = ${lockedAt}, opened_b = coalesce(opened_b, now())
      where id = ${id} and series_id is null and locked_b is null and deadline_at > now()
        and (${move.lock} or draft_seq_b < ${move.seq})`;
  }
}

/** The start made its series: both lineups as they went in (a draft finished at random, too). */
export async function markMade(
  db: Db,
  id: string,
  seriesId: string,
  lineups: Readonly<Record<Side, readonly string[]>>,
): Promise<void> {
  await db`
    update game.starts set series_id = ${seriesId}, draft_a = ${[...lineups.a]},
      draft_b = ${[...lineups.b]}
    where id = ${id} and series_id is null`;
}

/** The player's start not yet made into a series, if any (one live match at a time). */
export async function openStartOf(db: Db, player: string): Promise<string | undefined> {
  const [row] = await db<{ id: string }[]>`
    select id from game.starts
    where series_id is null and (player_a = ${player} or player_b = ${player})
    order by agreed_at desc limit 1`;
  return row?.id;
}

/** Starts whose clock has run out and nobody has made into a series yet (the sweep). */
export async function startsToSettle(sql: Sql, limit = 100): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    select id from game.starts where series_id is null and deadline_at <= now()
    order by deadline_at limit ${limit}`;
  return rows.map((row) => row.id);
}

/** The start a rematch of `seriesId` made, if any. */
export async function startOfRematch(db: Db, seriesId: string): Promise<string | undefined> {
  const [row] = await db<{ id: string }[]>`
    select id from game.starts where rematch_of = ${seriesId}`;
  return row?.id;
}
