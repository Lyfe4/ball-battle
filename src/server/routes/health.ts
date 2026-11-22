// GET /api/v1/health: is this deploy's API up? It reads the database (as the API's own role),
// loads the current ruleset's frozen bundle and checks Supabase Auth (reachable, both keys
// accepted, anonymous sign-ins on, asymmetric signing keys: one call to Auth, the key settings' pass
// kept a few minutes, auth-health.ts), so a deploy whose settings or bundled
// files are wrong says so here before any player meets it. A failed check answers 503 naming the
// check (`database`, `ruleset`, `auth_anonymous_sign_ins`, ...); what went wrong is in the log line
// only (stage and kind, failure.ts). Sign-in's settings (ADR 0079) are `accounts`, apart, and stay
// 200: a sign-in setting never makes the game look down.
import type { AccountsCheck, EmailCodes, HealthCheck, HealthResponse } from '../../api/health.ts';
import type { Config } from '../config.ts';
import { createAuthHealth, isAccountCheck } from '../auth-health.ts';
import { ApiError, json, type RouteContext, type RouteHandler } from '../http.ts';
import { EVERYONE, ipSubject, LIMITS, spend } from '../rate-limit.ts';
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

/** Where everyone's email codes stand warns before the caps (ADR 0079): 70 a day, 2,200 a month. */
export const NEAR_DAILY = 70;
export const NEAR_MONTHLY = 2200;

/** Everyone's email codes today and this month, as /health says it. */
export function emailCodesOf(
  config: Config,
  sent: { readonly day: number; readonly month: number },
): EmailCodes {
  if (!config.emailCodes) return 'off';
  if (sent.day >= LIMITS.codesDaily.max || sent.month >= LIMITS.codesMonthly.max) return 'full';
  if (sent.day >= NEAR_DAILY || sent.month >= NEAR_MONTHLY) return 'near';
  return 'ok';
}

export const health: RouteHandler = async (request, context) => {
  if (request.method !== 'GET') {
    throw new ApiError(405, 'method_not_allowed', 'Use GET', { Allow: 'GET' });
  }
  await spendHealth(context);
  const { deps, noteFailure } = context;
  const [database, ruleset, auth] = await Promise.all([
    // One query (one connection never runs two at once): up, and everyone's codes so far.
    deps.sql<{ readonly ok: number; readonly day: number; readonly month: number }[]>`
      select 1 as ok,
        coalesce((select count from game.rate_limits where subject = ${EVERYONE}
          and bucket = ${LIMITS.codesDaily.bucket}
          and window_start = date_bin(interval '1 day', now(), timestamptz '2000-01-01')), 0) as day,
        coalesce((select count from game.rate_limits where subject = ${EVERYONE}
          and bucket = ${LIMITS.codesMonthly.bucket}
          and window_start = date_trunc('month', now(), 'UTC')), 0) as month`.then(
      ([row]) => row,
      (error: unknown) => {
        noteFailure(error, 'database');
        return undefined;
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
  const accountsFailed = auth.filter(isAccountCheck);
  const authFailed = auth.filter(
    (check): check is Exclude<typeof check, AccountsCheck> => !isAccountCheck(check),
  );
  const failed: HealthCheck[] = [
    ...(database?.ok === 1 ? [] : (['database'] as const)),
    ...(ruleset === undefined ? (['ruleset'] as const) : []),
    ...authFailed,
  ];
  const body: HealthResponse = {
    status: failed.length === 0 ? 'ok' : 'down',
    database: database?.ok === 1 ? 'ok' : 'down',
    auth: authFailed.length === 0 ? 'ok' : 'down',
    ruleset: ruleset ?? null,
    failed,
    emailCodes: emailCodesOf(deps.config, database ?? { day: 0, month: 0 }),
    accounts: !deps.config.accounts ? 'off' : accountsFailed.length > 0 ? 'misconfigured' : 'ok',
    accountsFailed,
  };
  return json(failed.length === 0 ? 200 : 503, body);
};
