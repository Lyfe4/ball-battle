// The inbox's SQL (ADR 0079, PR (d)): accepted friends' status, and live challenges sent to the
// player that still wait. Status is read in one statement joined on accepted friendships only, so
// a stranger, a request or a removed friend never learns anything.
import type { FriendEntry, FriendStatus } from '../../api/friends.ts';
import { AWAY_AFTER_MS, GRACE_MS, LOBBY_SEEN_MS } from '../../api/live.ts';
import type { BestOf, Format } from '../../sim/index.ts';
import type { Sql, TransactionSql } from '../db.ts';
import { COUNTED } from './record.ts';

type Db = Sql | TransactionSql;

/**
 * Online: a request of theirs within this long. The inbox asks every 30 s while visible, or every
 * 120 s with the poke socket up (ADR 0082), so a friend idle on an open page stays online.
 */
export const ONLINE_MS = 150_000;

interface StatusRow {
  readonly id: string;
  readonly name: string;
  readonly status: FriendStatus;
  readonly played?: number;
  readonly wins?: number;
  readonly losses?: number;
}

/**
 * Each accepted friend's status: in a game with the reader (a live series or lineups of the two,
 * ADR 0089 addendum of 2026-11-27), else in a match (a live series they are still heard from on,
 * lineups, or a lobby waiting), else online (active within ONLINE_MS), else offline. With `headToHead` (the Friends
 * list, ADR 0088; never the inbox, read every 30 s), the player's record against each, from their
 * series together that count (`COUNTED`), in the same statement; absent where they never played.
 */
export async function friendStatuses(
  db: Db,
  userId: string,
  headToHead = false,
): Promise<FriendEntry[]> {
  const rows = await db<StatusRow[]>`
    select f.id, game.name_seen_by(${userId}, o.user_id, o.username, o.display_name) as name,
      ${headToHead ? db`h.played, h.wins, h.losses,` : db``}
      case
        when exists (
          select 1 from game.series s
          where s.live and s.status = 'open'
            and ((s.player_a = o.user_id and s.player_b = ${userId}::uuid)
              or (s.player_b = o.user_id and s.player_a = ${userId}::uuid)))
          or exists (
          select 1 from game.starts st
          where st.series_id is null
            and ((st.player_a = o.user_id and st.player_b = ${userId}::uuid)
              or (st.player_b = o.user_id and st.player_a = ${userId}::uuid)))
          then 'with_you'
        when exists (
          select 1 from game.series s
          join game.presence pr on pr.series_id = s.id
            and pr.side = case when s.player_a = o.user_id then 'a' else 'b' end
          where s.live and s.status = 'open' and o.user_id in (s.player_a, s.player_b)
            and pr.seen_at > now() - make_interval(secs => ${(AWAY_AFTER_MS + GRACE_MS) / 1000}))
          or exists (
          select 1 from game.challenges c
          where c.creator = o.user_id and c.live and c.series_id is null and c.start_id is null
            and c.cancelled_at is null and c.expires_at > now()
            and c.creator_seen_at > now() - make_interval(secs => ${LOBBY_SEEN_MS / 1000}))
          or exists (
          select 1 from game.starts st
          where st.series_id is null and st.deadline_at > now()
            and o.user_id in (st.player_a, st.player_b))
          then 'in_a_match'
        when o.active_at > now() - make_interval(secs => ${ONLINE_MS / 1000}) then 'online'
        else 'offline'
      end as status
    from game.friendships f
    join game.profiles o on o.user_id = case when f.low = ${userId} then f.high else f.low end
    ${
      headToHead
        ? db`cross join lateral (
            select count(*)::int as played,
              (count(*) filter (where s.winner = case when s.player_a = o.user_id then 'b' else 'a' end))::int as wins,
              (count(*) filter (where s.winner = case when s.player_a = o.user_id then 'a' else 'b' end))::int as losses
            from game.series s
            where ((s.player_a = ${userId}::uuid and s.player_b = o.user_id)
              or (s.player_b = ${userId}::uuid and s.player_a = o.user_id)) and ${COUNTED(db)}
          ) h`
        : db``
    }
    where ${userId} in (f.low, f.high) and f.accepted_at is not null
    order by lower(coalesce(o.username, o.display_name)), f.created_at`;
  return rows.map(({ id, name, status, played, wins, losses }) =>
    played === undefined || played === 0
      ? { id, name, status }
      : { id, name, status, record: { wins: wins ?? 0, losses: losses ?? 0 } },
  );
}

/**
 * A challenge sent to the player, not declined: live, while its sender's lobby waits; by turns
 * (ADR 0085), until it is accepted or expires.
 */
export interface InviteRow {
  readonly creator: string;
  readonly requestId: string;
  readonly from: string;
  /** The friendship it comes through: what Block and Report name. */
  readonly friend: string | null;
  readonly format: Format;
  readonly bestOf: BestOf;
  readonly live: boolean;
  /** Live: ms from now until the sender's lobby stops unless they're heard from again. */
  readonly stopsInMs: number | null;
}

export async function invitesFor(db: Db, userId: string): Promise<InviteRow[]> {
  return db<InviteRow[]>`
    select c.creator, c.request_id::text as "requestId",
      game.name_seen_by(${userId}, p.user_id, p.username, p.display_name) as "from",
      (select f.id from game.friendships f
        where f.low = least(c.creator, ${userId}::uuid) and f.high = greatest(c.creator, ${userId}::uuid)
      ) as friend,
      c.format, c.best_of as "bestOf", c.live,
      case when c.live then greatest(0, ceil(extract(epoch from (least(c.creator_seen_at
        + make_interval(secs => ${LOBBY_SEEN_MS / 1000}), c.expires_at) - now())) * 1000))::int end as "stopsInMs"
    from game.challenges c
    join game.profiles p on p.user_id = c.creator
    where c.invitee = ${userId} and c.series_id is null and c.start_id is null
      and c.cancelled_at is null
      and c.invitee_declined_at is null and c.expires_at > now()
      and (not c.live or c.creator_seen_at > now() - make_interval(secs => ${LOBBY_SEEN_MS / 1000}))
    order by c.created_at desc`;
}

/** A series by turns waiting on the player's pick (ADR 0085). */
/** How long an ending of a series by turns waits to be seen in Friends (ADR 0086). */
export const ENDING_DAYS = 7;

/**
 * Every series by turns of the player's that Friends lists (ADR 0086), in one statement: open ones
 * (`yours`: the player's turn), and those that ended within ENDING_DAYS that the player hasn't
 * seen (`game.series_seen`). Open first by deadline, then endings, the latest first.
 */
export interface GameRow {
  readonly seriesId: string;
  readonly opponent: string | null;
  readonly open: boolean;
  readonly yours: boolean;
  readonly deadline: Date | null;
  readonly status: 'open' | 'finished' | 'forfeit' | 'void';
  readonly won: boolean;
}

export async function gamesFor(db: Db, userId: string): Promise<GameRow[]> {
  return db<GameRow[]>`
    select s.id as "seriesId", s.status = 'open' as open, s.turn_deadline as deadline, s.status,
      game.name_seen_by(${userId}, p.user_id, p.username, p.display_name) as opponent,
      (s.status = 'open' and (s.turn = 'both'
        or s.turn = case when s.player_a = ${userId} then 'a' else 'b' end)) as yours,
      coalesce(s.winner = case when s.player_a = ${userId} then 'a' else 'b' end, false) as won
    from game.series s
    left join game.profiles p
      on p.user_id = case when s.player_a = ${userId} then s.player_b else s.player_a end
    where not s.live and ${userId} in (s.player_a, s.player_b) and (
      (s.status = 'open' and s.turn_deadline is not null)
      or (s.status in ('finished', 'forfeit')
        and s.finished_at > now() - make_interval(days => ${ENDING_DAYS})
        and not exists (select 1 from game.series_seen v
          where v.series_id = s.id and v.player = ${userId})))
    order by s.status <> 'open', s.turn_deadline, s.finished_at desc`;
}

/**
 * The player saw how series `seriesId` ended (ADR 0086): Friends stops listing it. A write the
 * player makes by viewing; nobody else reads it, so nothing pokes.
 */
export async function markSeen(db: Db, seriesId: string, userId: string): Promise<void> {
  await db`
    insert into game.series_seen (series_id, player) values (${seriesId}, ${userId})
    on conflict do nothing`;
}

/** Requests waiting for the player's answer. */
export async function waitingRequests(db: Db, userId: string): Promise<number> {
  const [row] = await db<{ readonly count: number }[]>`
    select count(*)::int as count from game.friendships
    where ${userId} in (low, high) and requested_by <> ${userId}
      and accepted_at is null and declined_at is null`;
  return row?.count ?? 0;
}

/** The accepted friendship `id` of `userId`'s: the other account, if there is one. */
export async function friendOf(db: Db, userId: string, id: string): Promise<string | undefined> {
  const [row] = await db<{ readonly other: string }[]>`
    select case when low = ${userId} then high else low end as other from game.friendships
    where id = ${id} and ${userId} in (low, high) and accepted_at is not null`;
  return row?.other;
}
