// GET /api/v1/health: is this deploy's API up? It reads the database (as the API's own role) and
// loads the current ruleset's frozen bundle, so a deploy whose database settings or bundled files
// are wrong says so here before any player meets it.
import type { HealthResponse } from '../../api/health.ts';
import { ApiError, json, type RouteHandler } from '../http.ts';
import { CURRENT_RULESET, rulesetSim } from '../rulesets.ts';

export const health: RouteHandler = async (request, { deps }) => {
  if (request.method !== 'GET') {
    throw new ApiError(405, 'method_not_allowed', 'Use GET', { Allow: 'GET' });
  }
  const [row] = await deps.sql<{ readonly ok: number }[]>`select 1 as ok`;
  const sim = await rulesetSim(CURRENT_RULESET);
  const body: HealthResponse = {
    status: 'ok',
    database: row?.ok === 1 ? 'ok' : 'unexpected',
    ruleset: sim.RULESET_VERSION,
  };
  return json(200, body);
};
