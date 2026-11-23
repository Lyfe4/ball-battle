// The inbox's SQL (ADR 0079, PR (d)): accepted friends' status, and live challenges sent to the
// player that still wait. Status is read in one statement joined on accepted friendships only, so
// a stranger, a request or a removed friend never learns anything.
import type { FriendEntry, FriendStatus } from '../../api/friends.ts';
import { AWAY_AFTER_MS, GRACE_MS, LOBBY_SEEN_MS } from '../../api/live.ts';
import type { BestOf, Format } from '../../sim/index.ts';
import type { Sql, TransactionSql } from '../db.ts';

type Db = Sql | TransactionSql;

/** Online: a request of theirs within this long (the inbox asks every 30 s while visible). */
export const ONLINE_MS = 75_000;

/**
 * Each accepted friend's status: in a match (a live series they are still heard from on, or a lobby
 * waiting), else online (active within ONLINE_MS), else offline.
 */
export async function friendStatuses(db: Db, userId: string): Promise<FriendEntry[]> {
  return db<{ readonly id: string; readonly name: string; readonly status: FriendStatus }[]>`
    select f.id, coalesce(o.username, o.display_name) as name,
      case
        when exists (
          select 1 from game.series s
          join game.presence pr on pr.series_id = s.id
            and pr.side = case when s.player_a = o.user_id then 'a' else 'b' end
          where s.live and s.status = 'open' and o.user_id in (s.player_a, s.player_b)
            and pr.seen_at > now() - make_interval(secs => ${(AWAY_AFTER_MS + GRACE_MS) / 1000}))
          or exists (
          select 1 from game.challenges c
          where c.creator = o.user_id and c.live and c.series_id is null and c.start_id is null
            and c.cancelled_at is null
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
    where ${userId} in (f.low, f.high) and f.accepted_at is not null
    order by lower(coalesce(o.username, o.display_name)), f.created_at`;
}

/** A live challenge sent to the player, still waiting on its sender's lobby, not declined. */
export interface InviteRow {
  readonly creator: string;
  readonly requestId: string;
  readonly from: string;
  readonly format: Format;
  readonly bestOf: BestOf;
}

export async function invitesFor(db: Db, userId: string): Promise<InviteRow[]> {
  return db<InviteRow[]>`
    select c.creator, c.request_id::text as "requestId",
      coalesce(p.username, p.display_name) as "from", c.format, c.best_of as "bestOf"
    from game.challenges c
    join game.profiles p on p.user_id = c.creator
    where c.invitee = ${userId} and c.live and c.series_id is null and c.start_id is null
      and c.cancelled_at is null
      and c.invitee_declined_at is null and c.expires_at > now()
      and c.creator_seen_at > now() - make_interval(secs => ${LOBBY_SEEN_MS / 1000})
    order by c.created_at desc`;
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
