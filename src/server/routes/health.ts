// GET /api/v1/health: is this deploy's API up? It reads the database (as the API's own role) and
// loads the current ruleset's frozen bundle, so a deploy whose database settings or bundled files
// are wrong says so here before any player meets it. A failed check answers 503 naming the check
// (`database`, `ruleset`); what went wrong is in the log line only (stage and kind, failure.ts).
import type { HealthResponse } from '../../api/health.ts';
import { ApiError, json, type RouteHandler } from '../http.ts';
import { CURRENT_RULESET, rulesetSim } from '../rulesets.ts';

export const health: RouteHandler = async (request, { deps, noteFailure }) => {
  if (request.method !== 'GET') {
    throw new ApiError(405, 'method_not_allowed', 'Use GET', { Allow: 'GET' });
  }
  const failed: HealthResponse['failed'][number][] = [];
  const database = await deps.sql<{ readonly ok: number }[]>`select 1 as ok`.then(
    ([row]) => row?.ok === 1,
    (error: unknown) => {
      noteFailure(error, 'database');
      return false;
    },
  );
  if (!database) failed.push('database');
  const ruleset = await rulesetSim(CURRENT_RULESET).then(
    (sim) => sim.RULESET_VERSION,
    (error: unknown) => {
      noteFailure(error, 'ruleset');
      return undefined;
    },
  );
  if (ruleset === undefined) failed.push('ruleset');
  const body: HealthResponse =
    failed.length === 0 && ruleset !== undefined
      ? { status: 'ok', database: 'ok', ruleset, failed: [] }
      : { status: 'down', database: database ? 'ok' : 'down', ruleset: ruleset ?? null, failed };
  return json(failed.length === 0 ? 200 : 503, body);
};
