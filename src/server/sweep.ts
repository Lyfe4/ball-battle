// The scheduled sweep (ADR 0052): every 15 minutes, settles every turn that ran out (a forfeit),
// every live series whose clock decided something (ADR 0053) and every lineup whose clock ran out
// (ADR 0080), drops ended rate-limit windows and
// friend requests declined 30 days ago (ADR 0079), and
// deletes guests not seen for 90 days (ADR 0068). Expired turns are also settled whenever a series is read, so
// a player never sees a stale turn even where scheduled functions don't run (Netlify runs them on
// published production deploys only, not in previews).
import { settleExpired } from './db/series.ts';
import type { Deps } from './http.ts';
import { deleteInactiveGuests } from './inactive.ts';
import { settleLiveSeries } from './live-service.ts';
import { settleStarts } from './start-settle.ts';
import { purgeReports } from './blocks.ts';
import { purgeDeclines } from './db/friends.ts';
import { purgeRateLimits } from './rate-limit.ts';

export async function sweep(deps: Deps): Promise<{
  forfeits: number;
  starts: number;
  live: number;
  windows: number;
  declines: number;
  reports: number;
  inactive: number;
}> {
  return {
    forfeits: await settleExpired(deps.sql),
    // Lineups nobody read past their deadline: made into series (a forfeit, or played on).
    starts: await settleStarts(deps),
    // Live series both players left: settled here, since nobody reads them any more (ADR 0053).
    live: await settleLiveSeries(deps),
    windows: await purgeRateLimits(deps.sql),
    // A declined friend request stops repeats for 30 days, then goes (ADR 0079).
    declines: await purgeDeclines(deps.sql),
    // A reported name is kept 90 days for the owner to read (ADR 0079, 2026-11-25).
    reports: await purgeReports(deps.sql),
    // Last: it calls Auth, and an Auth outage must not hold up the game's own settling.
    inactive: await deleteInactiveGuests(deps),
  };
}
