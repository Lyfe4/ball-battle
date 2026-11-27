// Live friend matches' own rows and reads (ADR 0053): presence, a sender's lobby, the one live match
// a player may be in, and the live series the sweep settles. Times are the database's `now()`.
import { AWAY_AFTER_MS, GRACE_MS, LOBBY_SEEN_MS, START_WINDOW_MS } from '../../api/live.ts';
import type { BestOf, Format, Side } from '../../sim/index.ts';
import type { Sql, TransactionSql } from '../db.ts';

type Db = Sql | TransactionSql;

/** `side` of a live series has arrived, now (the friend, as they accept). */
export async function markPresent(db: Db, seriesId: string, side: Side): Promise<void> {
  await db`
    insert into game.presence (series_id, side, seen_at) values (${seriesId}, ${side}, now())
    on conflict (series_id, side) do update set seen_at = excluded.seen_at`;
}

/**
 * Where a player is live right now: an open live series, a lobby still waiting, or lineups being
 * picked together (ADR 0080; until made into a series, so past its deadline too until settled).
 */
export type LiveNow =
  | { readonly kind: 'series'; readonly id: string }
  | {
      readonly kind: 'start';
      readonly id: string;
      readonly format: Format;
      readonly bestOf: BestOf;
    }
  | {
      readonly kind: 'lobby';
      readonly requestId: string;
      readonly format: Format;
      readonly bestOf: BestOf;
    };

/**
 * The player's live match or waiting lobby, if any (one at a time, ADR 0053). A lobby waits while
 * its sender has asked within LOBBY_SEEN_MS and nobody has accepted or cancelled it. A match or
 * lineups come before any lobby: they are what the player is in.
 */
export async function liveNowOf(db: Db, player: string): Promise<LiveNow | undefined> {
  const [row] = await db<
    { kind: 'series' | 'lobby' | 'start'; ref: string; format: Format; best_of: BestOf }[]
  >`
    select kind, ref, format, best_of from (
    (select 'series' as kind, id::text as ref, format, best_of, created_at from game.series
      where live and status = 'open' and (player_a = ${player} or player_b = ${player}))
    union all
    (select 'lobby', request_id::text, format, best_of, created_at from game.challenges
      where creator = ${player} and live and series_id is null and start_id is null
        and cancelled_at is null
        and creator_seen_at > now() - make_interval(secs => ${LOBBY_SEEN_MS / 1000}))
    union all
    (select 'start', id::text, format, best_of, agreed_at from game.starts
      where series_id is null and (player_a = ${player} or player_b = ${player}))
    ) live
    order by kind = 'lobby', created_at desc
    limit 1`;
  if (row === undefined) return undefined;
  if (row.kind === 'series') return { kind: 'series', id: row.ref };
  if (row.kind === 'start') {
    return { kind: 'start', id: row.ref, format: row.format, bestOf: row.best_of };
  }
  return { kind: 'lobby', requestId: row.ref, format: row.format, bestOf: row.best_of };
}

/** Who `creator`'s lobby (by its request id) waits for, by name; null for a link to anyone. */
export async function lobbyInvitee(
  db: Db,
  creator: string,
  requestId: string,
): Promise<{ readonly invitee: string | null; readonly stopsInMs: number }> {
  const [row] = await db<{ name: string | null; stops_in_ms: number }[]>`
    select coalesce(i.username, i.display_name) as name,
      greatest(0, ceil(extract(epoch from (c.creator_seen_at
        + make_interval(secs => ${LOBBY_SEEN_MS / 1000}) - now())) * 1000))::int as stops_in_ms
    from game.challenges c
    left join game.profiles i on i.user_id = c.invitee
    where c.creator = ${creator} and c.request_id = ${requestId}`;
  return { invitee: row?.name ?? null, stopsInMs: row?.stops_in_ms ?? 0 };
}

/**
 * The sender's lobby page asked about their live link: it stays open. Only a link still waiting
 * is kept alive; one that stopped (silent past LOBBY_SEEN_MS, or cancelled) stays stopped.
 */
export async function lobbySeen(db: Db, challengeId: string): Promise<void> {
  await db`
    update game.challenges set creator_seen_at = now()
    where id = ${challengeId} and live and series_id is null and start_id is null
      and cancelled_at is null
      and creator_seen_at > now() - make_interval(secs => ${LOBBY_SEEN_MS / 1000})`;
}

/** Open live series whose clock may have decided something nobody has written yet (the sweep). */
export async function liveSeriesToSettle(sql: Sql, limit = 100): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    select s.id from game.series s
    where s.live and s.status = 'open' and (
      (s.started_at is null and s.created_at < now() - make_interval(secs => ${START_WINDOW_MS / 1000}))
      or s.turn_deadline < now()
      or exists (select 1 from game.presence p where p.series_id = s.id
        and p.seen_at < now() - make_interval(secs => ${(AWAY_AFTER_MS + GRACE_MS) / 1000})))
    order by s.created_at
    limit ${limit}`;
  return rows.map((row) => row.id);
}

/** The sender cancels their waiting live link: it stops at once (nobody can accept it). */
export async function cancelLobby(db: Db, challengeId: string, creator: string): Promise<void> {
  await db`
    update game.challenges set cancelled_at = now()
    where id = ${challengeId} and creator = ${creator} and live and series_id is null
      and start_id is null and cancelled_at is null`;
}
