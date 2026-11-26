// GET /api/v1/me/record (ADR 0088): an account's own record for Profile: online wins, series
// played, the favourite ball and the last RECENT_SERIES finished series. One round trip: the
// session's profile, the read's count and the record in one statement (`sessionWith`). A read, so
// no poke; private and never cached.
import { loadRecord } from '../db/record.ts';
import { guard } from '../guard.ts';
import { ApiError, json, type RouteHandler } from '../http.ts';
import { LIMITS, refuseOver } from '../rate-limit.ts';
import { sessionWith } from '../session.ts';
import { requireAccounts } from '../sign-in.ts';

export const meRecord: RouteHandler = async (request, context) => {
  requireAccounts(context);
  guard(request, ['GET']);
  const { session, read } = await sessionWith(request, context, (userId) =>
    loadRecord(context.deps.sql, userId, LIMITS.reads),
  );
  if (read.spent !== undefined) refuseOver(LIMITS.reads, read.spent);
  if (!session.account || read.record === undefined) {
    throw new ApiError(403, 'not_an_account', 'Sign in to see your record');
  }
  return json(200, read.record, { 'Cache-Control': 'private, no-store' });
};
