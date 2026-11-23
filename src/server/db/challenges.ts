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
  /** A live link nobody accepted whose sender cancelled it or left the lobby. */
  readonly stopped: boolean;
  readonly requestId: string;
  /** The friend it was sent to (ADR 0079 PR (d)), by name, and whether they said No thanks. */
  readonly invitee: string | null;
  readonly inviteeName: string | null;
  readonly declined: boolean;
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
}

export async function challengeByHash(
  db: Db,
  hash: Buffer,
  lock = false,
): Promise<ChallengeRow | undefined> {
  const forUpdate = lock ? db`for update of c` : db``;
  const [raw] = await db<Raw[]>`
    select c.id, c.creator, coalesce(p.username, p.display_name) as creator_name, c.format, c.best_of, c.lineup,
      c.expires_at, c.expires_at < now() as expired,
      coalesce(c.series_id, st.series_id) as series_id, c.start_id,
      coalesce(st.player_b, s.player_b) as acceptor,
      c.live, c.request_id, c.invitee, coalesce(i.username, i.display_name) as invitee_name,
      c.invitee_declined_at is not null as declined,
      (c.live and c.series_id is null and c.start_id is null and (c.cancelled_at is not null
        or c.creator_seen_at <= now() - make_interval(secs => ${LOBBY_SEEN_MS / 1000}))) as stopped
    from game.challenges c
    left join game.profiles p on p.user_id = c.creator
    left join game.profiles i on i.user_id = c.invitee
    left join game.series s on s.id = c.series_id
    left join game.starts st on st.id = c.start_id
    where c.token_hash = ${hash}
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
 * Links by turns a player has out that nobody has accepted yet and that haven't expired. A live
 * link is one at a time instead (`liveNowOf`), and stops when its sender leaves.
 */
export async function openChallengesOf(db: Db, creator: string): Promise<number> {
  const [row] = await db<{ count: number }[]>`
    select count(*)::int as count from game.challenges
    where creator = ${creator} and not live and series_id is null and start_id is null
      and expires_at > now()`;
  return row?.count ?? 0;
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
