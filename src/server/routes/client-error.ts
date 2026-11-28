// POST /api/v1/client-error (launch eve): a page's uncaught error or unhandled rejection, sent on
// to the error service as the server's own are (`monitor.ts`), scrubbed again here. The page talks
// only to its own origin, so the CSP never names the error service and no DSN is in a page. Off
// unless the functions have `BALLBATTLE_ERROR_REPORTS=1` and `SENTRY_DSN`: then 404, nothing sent
// and nothing counted. Needs no session (a guest's page, or one whose session ended, may fail
// too); counted per network (LIMITS.pageErrors).
import { decodeClientError } from '../../api/client-error.ts';
import { guard, jsonBody } from '../guard.ts';
import { ApiError, type RouteHandler } from '../http.ts';
import { reportPage } from '../monitor.ts';
import { ipSubject, LIMITS, spend } from '../rate-limit.ts';

export const clientError: RouteHandler = async (request, context) => {
  guard(request, ['POST']);
  const { config, sql } = context.deps;
  if (!config.errorReports) {
    throw new ApiError(404, 'not_found', 'Error reports are not switched on here');
  }
  const report = decodeClientError(await jsonBody(request));
  if (report === undefined) throw new ApiError(400, 'bad_request', 'Not an error report');
  if (context.ip !== undefined) {
    await spend(sql, await ipSubject(config, context.ip), LIMITS.pageErrors);
  }
  await reportPage(report);
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
};
