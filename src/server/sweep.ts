// The scheduled sweep (ADR 0052): every 15 minutes, settles every turn that ran out (a forfeit),
// every live series whose clock decided something (ADR 0053), and drops ended rate-limit windows. Expired turns are also settled whenever a series is read, so
// a player never sees a stale turn even where scheduled functions don't run (Netlify runs them on
// published production deploys only, not in previews).
import { settleExpired } from './db/series.ts';
import type { Deps } from './http.ts';
import { settleLiveSeries } from './live-service.ts';
import { purgeRateLimits } from './rate-limit.ts';

export async function sweep(
  deps: Deps,
): Promise<{ forfeits: number; live: number; windows: number }> {
  return {
    forfeits: await settleExpired(deps.sql),
    // Live series both players left: settled here, since nobody reads them any more (ADR 0053).
    live: await settleLiveSeries(deps),
    windows: await purgeRateLimits(deps.sql),
  };
}
