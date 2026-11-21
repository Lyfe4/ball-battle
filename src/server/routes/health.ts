// GET /api/v1/health: is this deploy's API up? It reads the database (as the API's own role),
// loads the current ruleset's frozen bundle and checks Supabase Auth (reachable, both keys
// accepted, anonymous sign-ins on, asymmetric signing keys: one call to Auth, the key settings' pass
// kept a few minutes, auth-health.ts), so a deploy whose settings or bundled
// files are wrong says so here before any player meets it. A failed check answers 503 naming the
// check (`database`, `ruleset`, `auth_anonymous_sign_ins`, ...); what went wrong is in the log line
// only (stage and kind, failure.ts).
import type { HealthCheck, HealthResponse } from '../../api/health.ts';
import { createAuthHealth } from '../auth-health.ts';
import { ApiError, json, type RouteContext, type RouteHandler } from '../http.ts';
import { ipSubject, LIMITS, spend } from '../rate-limit.ts';
import { CURRENT_RULESET, rulesetSim } from '../rulesets.ts';

/** Auth's checks, one call per request (auth-health.ts). */
const authChecks = createAuthHealth();

/**
 * Counts the check against its network (LIMITS.health): it needs no session, and each one calls
 * Auth with the secret key. A database that can't count it doesn't refuse it: the check itself
 * then reports the database down.
 */
async function spendHealth({ deps, ip }: RouteContext): Promise<void> {
  if (ip === undefined) return;
  try {
    await spend(deps.sql, await ipSubject(deps.config, ip), LIMITS.health);
  } catch (error) {
    if (error instanceof ApiError) throw error;
  }
}

export const health: RouteHandler = async (request, context) => {
  if (request.method !== 'GET') {
    throw new ApiError(405, 'method_not_allowed', 'Use GET', { Allow: 'GET' });
  }
  await spendHealth(context);
  const { deps, noteFailure } = context;
  const [database, ruleset, auth] = await Promise.all([
    deps.sql<{ readonly ok: number }[]>`select 1 as ok`.then(
      ([row]) => row?.ok === 1,
      (error: unknown) => {
        noteFailure(error, 'database');
        return false;
      },
    ),
    rulesetSim(CURRENT_RULESET).then(
      (sim) => sim.RULESET_VERSION,
      (error: unknown) => {
        noteFailure(error, 'ruleset');
        return undefined;
      },
    ),
    authChecks(deps.config, noteFailure),
  ]);
  const failed: HealthCheck[] = [
    ...(database ? [] : (['database'] as const)),
    ...(ruleset === undefined ? (['ruleset'] as const) : []),
    ...auth,
  ];
  const body: HealthResponse = {
    status: failed.length === 0 ? 'ok' : 'down',
    database: database ? 'ok' : 'down',
    auth: auth.length === 0 ? 'ok' : 'down',
    ruleset: ruleset ?? null,
    failed,
  };
  return json(failed.length === 0 ? 200 : 503, body);
};
