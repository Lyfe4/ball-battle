// Deleting guests nobody has seen for 90 days (ADR 0052, "Guests"; ADR 0068), from the scheduled
// sweep. Each is deleted as "Forget me" deletes one: through Auth, which removes their sessions
// (and the IP recorded on them) and cascades to their profile, forfeiting any open series to the
// opponent; finished series stay in the opponent's history as "Deleted player".
import { deleteUser } from './auth-admin.ts';
import { inactivePlayers, orphanUsers } from './db/profiles.ts';
import type { Deps } from './http.ts';

/**
 * How long an Auth user the game never made a player stays (an email code never entered): a day.
 * The privacy policy says the same (2026-11-28 audit, migration 20261128130000).
 */
export const ORPHAN_HOURS = 24;

/** How long a guest may stay away before they are deleted. The privacy policy says the same. */
export const INACTIVE_DAYS = 90;
/** And an account (ADR 0079): 24 months. The privacy policy says the same. */
export const INACTIVE_ACCOUNT_DAYS = 730;
/**
 * At most this many a sweep: each is one call to Auth, one after another, and the sweep runs every
 * 15 minutes, so a backlog clears at about 2,400 a day without nearing a function's time limit.
 */
export const INACTIVE_PER_SWEEP = 25;

/**
 * Failures a sweep goes on past. One guest Auth won't delete must not hold up everyone after it
 * (the oldest come first, so it would head every run); Auth being down stops the run after this
 * many calls rather than waiting out a timeout for each guest.
 */
const FAILURES_PER_SWEEP = 2;

/**
 * Deletes up to INACTIVE_PER_SWEEP players away too long, then, in what is left of that, Auth
 * users with no profile older than ORPHAN_HOURS; throws the first failure once the rest are tried.
 */
export async function deleteInactiveGuests(deps: Deps): Promise<number> {
  const away = await inactivePlayers(
    deps.sql,
    INACTIVE_DAYS,
    INACTIVE_ACCOUNT_DAYS,
    INACTIVE_PER_SWEEP,
  );
  const ids = [
    ...away,
    ...(await orphanUsers(deps.sql, ORPHAN_HOURS, INACTIVE_PER_SWEEP - away.length)),
  ];
  let deleted = 0;
  const failures: unknown[] = [];
  for (const id of ids) {
    if (failures.length >= FAILURES_PER_SWEEP) break;
    try {
      await deleteUser(deps.config, id);
      deleted += 1;
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) throw failures[0];
  return deleted;
}
