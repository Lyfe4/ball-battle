// GET /api/v1/me/record (ADR 0088, 0089): an account's own record for Profile: online wins, series
// played, the favourite ball, "Your stats" and the first RECENT_SERIES finished series with the
// cursor after them. GET /api/v1/me/matches?after=<cursor>: All matches' next page, read only when
// a player scrolls that far (ADR 0084 addendum). Each is one round trip: the session's profile, the
// read's count and the answer in one statement (`sessionWith`). Reads, so no poke; private and
// never cached.
import { cursorOf, loadMatches, loadRecord, type Loaded } from '../db/record.ts';
import type { Profile } from '../db/profiles.ts';
import { guard } from '../guard.ts';
import { ApiError, json, type RouteContext, type RouteHandler } from '../http.ts';
import { LIMITS, refuseOver } from '../rate-limit.ts';
import { sessionWith } from '../session.ts';
import { requireAccounts } from '../sign-in.ts';

type Reading<T> = Loaded<T> & { readonly profile: Profile | undefined };

async function answer<T>(
  request: Request,
  context: RouteContext,
  read: (userId: string) => Promise<Reading<T>>,
): Promise<Response> {
  const { session, read: loaded } = await sessionWith(request, context, read);
  if (loaded.spent !== undefined) refuseOver(LIMITS.reads, loaded.spent);
  if (!session.account || loaded.answer === undefined) {
    throw new ApiError(403, 'not_an_account', 'Sign in to see your record');
  }
  return json(200, loaded.answer, { 'Cache-Control': 'private, no-store' });
}

export const meRecord: RouteHandler = async (request, context) => {
  requireAccounts(context);
  guard(request, ['GET']);
  return answer(request, context, (userId) => loadRecord(context.deps.sql, userId, LIMITS.reads));
};

export const meMatches: RouteHandler = async (request, context) => {
  requireAccounts(context);
  guard(request, ['GET']);
  const after = cursorOf(new URL(request.url).searchParams.get('after'));
  if (after === undefined) throw new ApiError(400, 'bad_request', 'Which page of matches?');
  return answer(request, context, (userId) =>
    loadMatches(context.deps.sql, userId, LIMITS.reads, after),
  );
};

/** The one function for both (one cold start, not two): by its path. */
export const meRecordRoutes: RouteHandler = (request, context) =>
  new URL(request.url).pathname.endsWith('/matches')
    ? meMatches(request, context)
    : meRecord(request, context);
