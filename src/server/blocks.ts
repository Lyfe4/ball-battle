// Blocking and "Report this name" (ADR 0079 addendum of 2026-11-25), accounts only.
//
// A block keeps the pair's friendship row for good as the blocked player's request, declined
// (`blocked_by`): to them it reads exactly as a decline does (a request still sent, or a friend
// who removed them), so they get no hint, and nothing they send arrives (friends.ts). It also ends
// the friendship and calls off any challenge between the two that hasn't started. Unblock deletes
// the row: a clean slate, as if they had never met.
//
// A report keeps who reported whom, the username then, why and when, for the owner to read
// (scripts/reports.ts); from then on the reporter sees that player as "Player 1234" until the name
// changes (`game.name_seen_by`). Counted per account a day before anything is written.
import type { FriendsResponse, ReportReason } from '../api/friends.ts';
import { callOffBetween } from './db/challenges.ts';
import { otherOf, ownRow } from './db/friends.ts';
import { listFriends } from './friends.ts';
import { ApiError, type Deps } from './http.ts';
import { LIMITS, spend } from './rate-limit.ts';

const gone = () => new ApiError(404, 'not_found', 'That player is gone');

/** Blocks the other side of friendship `id`: a friend, a request either way, a challenge's sender. */
export async function blockFriend(deps: Deps, me: string, id: string): Promise<FriendsResponse> {
  await deps.sql.begin(async (db) => {
    const row = await ownRow(db, me, id);
    if (row === undefined) throw gone();
    const them = otherOf(row, me);
    if (row.blockedBy === null) {
      // A request of theirs still waiting keeps reading as sent to them, as a decline does;
      // anything else (friends, or a request of mine) leaves their list, as a removal does.
      const theirsWaiting = !row.accepted && row.requestedBy === them;
      await db`
        update game.friendships
        set blocked_by = ${me}, requested_by = ${them}, accepted_at = null,
          declined_at = coalesce(declined_at, now()),
          withdrawn_at = ${theirsWaiting ? db`withdrawn_at` : db`now()`}
        where id = ${row.id}`;
    }
    // Blocked by them already: their block holds the row, and they read as nobody to me.
    await callOffBetween(db, me, them);
  });
  return listFriends(deps, me);
}

/** Unblocks: the pair's row goes, and either may ask again. Not blocked by me: nothing to do. */
export async function unblockFriend(deps: Deps, me: string, id: string): Promise<FriendsResponse> {
  await deps.sql`
    delete from game.friendships
    where id = ${id} and blocked_by = ${me} and ${me} in (low, high)`;
  return listFriends(deps, me);
}

/** Reports the other side's username: kept for the owner, and hidden from `me` from now on. */
export async function reportName(
  deps: Deps,
  me: string,
  id: string,
  reason: ReportReason,
): Promise<FriendsResponse> {
  await deps.sql.begin(async (db) => {
    const row = await ownRow(db, me, id);
    if (row === undefined) throw gone();
    const them = otherOf(row, me);
    const [profile] = await db<{ readonly username: string | null }[]>`
      select username from game.profiles where user_id = ${them}`;
    if (profile === undefined) throw gone();
    if (profile.username === null) {
      throw new ApiError(400, 'nothing_to_report', 'They have no username yet: nothing to report');
    }
    await spend(db, me, LIMITS.nameReports);
    // The same name reported twice by one player is one report.
    await db`
      insert into game.name_reports (reporter, reported, name, reason)
      select ${me}, ${them}, ${profile.username}, ${reason}
      where not exists (
        select 1 from game.name_reports
        where reporter = ${me} and reported = ${them} and name = ${profile.username})`;
  });
  return listFriends(deps, me);
}

/** How long a report is kept (the sweep, and the privacy policy). */
export const REPORT_DAYS = 90;

/** Drops reports older than REPORT_DAYS (the sweep). */
export async function purgeReports(sql: Deps['sql']): Promise<number> {
  const rows = await sql`
    delete from game.name_reports
    where created_at <= now() - make_interval(days => ${REPORT_DAYS}) returning 1`;
  return rows.length;
}
