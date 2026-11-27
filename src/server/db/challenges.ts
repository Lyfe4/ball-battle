// game.challenges: friend links (ADR 0052). Times are the database's: a link expires 7 days after
// it was made, by `now()`; a live link (ADR 0053) stops once its sender's lobby has been silent for
// LOBBY_SEEN_MS, or is cancelled.
import { LOBBY_SEEN_MS } from '../../api/live.ts';
import type { BestOf, Format } from '../../sim/index.ts';
import type { Sql, TransactionSql } from '../db.ts';

type Db = Sql | TransactionSql;

export interface ChallengeRow {
  readonly id: string;
  readonly creator: string;
  readonly creatorName: string | null;
  readonly format: Format;
  readonly bestOf: BestOf;
  /** The sender's lineup: a series by turns' (a live link has none, ADR 0080). */
  readonly lineup: readonly string[] | null;
  readonly expiresAt: Date;
  readonly expired: boolean;
  readonly seriesId: string | null;
  /** The lineups picked together once a live link was accepted (ADR 0080). */
  readonly startId: string | null;
  /** Someone accepted it: it has a start or a series. */
  readonly accepted: boolean;
  /** Who accepted it: side B of its start or series. */
  readonly acceptor: string | null;
  readonly live: boolean;
  /**
   * Nobody accepted it and it was called off (cancelled, a No thanks to a live one, or a newer
   * challenge from its sender), or it is live and its sender left the lobby.
   */
  readonly stopped: boolean;
  readonly requestId: string;
  /** The friend it was sent to (ADR 0079 PR (d)), by name, and whether they said No thanks. */
  readonly invitee: string | null;
  readonly inviteeName: string | null;
  readonly declined: boolean;
  /** Called off by a newer challenge from the same sender (one outgoing at a time). */
  readonly superseded: boolean;
}

interface Raw {
  readonly id: string;
  readonly creator: string;
  readonly creator_name: string | null;
  readonly format: Format;
  readonly best_of: BestOf;
  readonly lineup: string[] | null;
  readonly expires_at: Date;
  readonly expired: boolean;
  readonly series_id: string | null;
  readonly start_id: string | null;
  readonly acceptor: string | null;
  readonly live: boolean;
  readonly stopped: boolean;
  readonly request_id: string;
  readonly invitee: string | null;
  readonly invitee_name: string | null;
  readonly declined: boolean;
  readonly superseded: boolean;
}

export async function challengeByHash(
  db: Db,
  hash: Buffer,
  lock = false,
): Promise<ChallengeRow | undefined> {
  return challengeWhere(db, { hash }, lock);
}

/** A challenge by its row id (a crossed lobby found by `lobbyWaitingFor`). */
export async function challengeById(
  db: Db,
  id: string,
  lock = false,
): Promise<ChallengeRow | undefined> {
  return challengeWhere(db, { id }, lock);
}

async function challengeWhere(
  db: Db,
  key: { readonly hash: Buffer } | { readonly id: string },
  lock: boolean,
): Promise<ChallengeRow | undefined> {
  const forUpdate = lock ? db`for update of c` : db``;
  const where = 'hash' in key ? db`c.token_hash = ${key.hash}` : db`c.id = ${key.id}`;
  const [raw] = await db<Raw[]>`
    select c.id, c.creator, coalesce(p.username, p.display_name) as creator_name, c.format, c.best_of, c.lineup,
      c.expires_at, c.expires_at < now() as expired,
      coalesce(c.series_id, st.series_id) as series_id, c.start_id,
      coalesce(st.player_b, s.player_b) as acceptor,
      c.live, c.request_id, c.invitee, coalesce(i.username, i.display_name) as invitee_name,
      c.invitee_declined_at is not null as declined, c.superseded_by is not null as superseded,
      (c.series_id is null and c.start_id is null and (c.cancelled_at is not null
        or (c.live and c.creator_seen_at <= now() - make_interval(secs => ${LOBBY_SEEN_MS / 1000})))) as stopped
    from game.challenges c
    left join game.profiles p on p.user_id = c.creator
    left join game.profiles i on i.user_id = c.invitee
    left join game.series s on s.id = c.series_id
    left join game.starts st on st.id = c.start_id
    where ${where}
    ${forUpdate}`;
  return raw === undefined
    ? undefined
    : {
        id: raw.id,
        creator: raw.creator,
        creatorName: raw.creator_name,
        format: raw.format,
        bestOf: raw.best_of,
        lineup: raw.lineup,
        expiresAt: raw.expires_at,
        expired: raw.expired,
        seriesId: raw.series_id,
        startId: raw.start_id,
        accepted: raw.series_id !== null || raw.start_id !== null,
        acceptor: raw.acceptor,
        live: raw.live,
        stopped: raw.stopped,
        requestId: raw.request_id,
        invitee: raw.invitee,
        inviteeName: raw.invitee_name,
        declined: raw.declined,
        superseded: raw.superseded,
      };
}

export interface NewChallenge {
  readonly tokenHash: Buffer;
  readonly creator: string;
  readonly ruleset: number;
  readonly format: Format;
  readonly bestOf: BestOf;
  readonly lineup: readonly string[] | null;
  readonly requestId: string;
  readonly live: boolean;
  /** The friend it is for, if any (ADR 0079 PR (d)). */
  readonly invitee?: string;
}

export async function insertChallenge(db: Db, challenge: NewChallenge): Promise<void> {
  await db`
    insert into game.challenges (token_hash, creator, ruleset, format, best_of, lineup,
      request_id, expires_at, live, creator_seen_at, invitee)
    values (${challenge.tokenHash}, ${challenge.creator}, ${challenge.ruleset}, ${challenge.format},
      ${challenge.bestOf}, ${challenge.lineup === null ? null : [...challenge.lineup]},
      ${challenge.requestId},
      now() + interval '7 days', ${challenge.live},
      case when ${challenge.live} then now() end, ${challenge.invitee ?? null})
    on conflict (creator, request_id) do nothing`;
}

export async function markAccepted(db: Db, id: string, seriesId: string): Promise<void> {
  await db`update game.challenges set series_id = ${seriesId} where id = ${id} and series_id is null`;
}

/** A live link accepted into lineups picked together (ADR 0080). */
export async function markStarted(db: Db, id: string, startId: string): Promise<void> {
  await db`update game.challenges set start_id = ${startId}
    where id = ${id} and series_id is null and start_id is null`;
}

/**
 * One outgoing challenge per player (ADR 0089 addendum of 2026-11-27): calls off every challenge
 * of `creator`'s nobody has accepted or called off yet, but `keep` (the one just sent; none when
 * the send became an accept; `liveOnly` when accepting a live match, which leaves challenges by
 * turns alone). A live one stops at once; its friend's inbox loses it by the poke `cancelled_at`
 * sends (20261124120000_poke.sql). The sender's lock is held (`lockPlayer`).
 */
export async function supersedeOutgoing(
  db: Db,
  creator: string,
  keep: string | undefined,
  liveOnly = false,
): Promise<number> {
  const rows = await db`
    update game.challenges set cancelled_at = now(), superseded_by = ${keep ?? null}
    where creator = ${creator} and series_id is null and start_id is null
      and cancelled_at is null and expires_at > now()
      ${keep === undefined ? db`` : db`and id <> ${keep}`}
      ${liveOnly ? db`and live` : db``}
    returning 1`;
  return rows.length;
}

/** Open series by turns a player is in (live ones finish in minutes and have their own rule). */
export async function openSeriesOf(db: Db, player: string): Promise<number> {
  const [row] = await db<{ count: number }[]>`
    select count(*)::int as count from game.series
    where status = 'open' and not live and (player_a = ${player} or player_b = ${player})`;
  return row?.count ?? 0;
}

/**
 * Holds `player`'s starting of live matches until the transaction ends, on every host: a challenge
 * sent and one accepted at the same moment can't both pass the one-match check (ADR 0053).
 */
export async function lockPlayer(db: TransactionSql, player: string): Promise<void> {
  await db`select pg_advisory_xact_lock(hashtextextended(${`live:${player}`}, 0))`;
}

/**
 * Holds several players' starting of live matches, always in one order (by id), so two players
 * accepting each other's challenge at once (ADR 0086) wait in turn instead of deadlocking. One at
 * a time on the connection, never pipelined.
 */
export async function lockPlayers(db: TransactionSql, players: readonly string[]): Promise<void> {
  for (const player of [...new Set(players)].sort()) await lockPlayer(db, player);
}

/** `creator`'s live lobby still waiting for `invitee`, if any: a crossed challenge (ADR 0086). */
export async function lobbyWaitingFor(
  db: Db,
  creator: string,
  invitee: string,
): Promise<string | undefined> {
  const [row] = await db<{ id: string }[]>`
    select id from game.challenges
    where creator = ${creator} and invitee = ${invitee} and live and series_id is null
      and start_id is null and cancelled_at is null
      and creator_seen_at > now() - make_interval(secs => ${LOBBY_SEEN_MS / 1000})
    order by created_at desc
    limit 1`;
  return row?.id;
}

/** The lineups `a` and `b` are picking together now (ADR 0080), if any. */
export async function startBetween(db: Db, a: string, b: string): Promise<string | undefined> {
  const [row] = await db<{ id: string }[]>`
    select id from game.starts
    where series_id is null
      and ((player_a = ${a} and player_b = ${b}) or (player_a = ${b} and player_b = ${a}))
    order by agreed_at desc
    limit 1`;
  return row?.id;
}

/**
 * The pair's row when `viewer` blocked `other` (blocks.ts): its id, for Unblock; else undefined.
 * Only the viewer's own block: being blocked reads as nothing at all.
 */
export async function blockedBy(
  db: Db,
  viewer: string,
  other: string,
): Promise<string | undefined> {
  const [row] = await db<{ id: string }[]>`
    select id from game.friendships
    where low = least(${viewer}::uuid, ${other}::uuid) and high = greatest(${viewer}::uuid, ${other}::uuid)
      and blocked_by = ${viewer}`;
  return row?.id;
}
