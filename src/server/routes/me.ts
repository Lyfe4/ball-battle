// /api/v1/me (ADR 0052, section 2).
// - GET: the player as they see themselves.
// - DELETE: "Forget me", also with vs Friend switched off (ADR 0078). Deletes the player at once: their auth user and profile, their open
//   challenges, and their open series (forfeited to the opponent). Finished series stay in the
//   opponent's history with this player shown as "Deleted player". The cookie is cleared; the
//   client clears every `ballbattle.*` key.
// - GET /api/v1/me/match: the live match or lobby to go back to, or null (ADR 0053). Never a
//   heartbeat: a player on home is away from their match.
import type { PlayerResponse } from '../../api/session.ts';
import { deleteUser } from '../auth-admin.ts';
import { clearedSessionCookie } from '../cookie.ts';
import type { CurrentMatchResponse } from '../../api/live.ts';
import { currentMatch } from '../current-match.ts';
import { guard } from '../guard.ts';
import { alsoWhileOff, json, type RouteHandler } from '../http.ts';
import { LIMITS, spend } from '../rate-limit.ts';
import { sessionOf } from '../session.ts';

export const me: RouteHandler = alsoWhileOff(
  async (request, context) => {
    guard(request, ['GET', 'DELETE']);
    const player = await sessionOf(request, context);
    if (request.method === 'GET') return json(200, { name: player.name } satisfies PlayerResponse);
    await deleteUser(context.deps.config, player.userId);
    context.setCookie(clearedSessionCookie());
    return json(204, null);
  },
  // Forget me works whether or not vs Friend is switched on (ADR 0078).
  (request) => request.method === 'DELETE',
);

export const meMatch: RouteHandler = async (request, context) => {
  guard(request, ['GET']);
  const player = await sessionOf(request, context);
  await spend(context.deps.sql, player.userId, LIMITS.reads);
  const match = await currentMatch(context.deps, player.userId);
  const body: CurrentMatchResponse = { match };
  return json(200, body, { 'Cache-Control': 'private, no-store' });
};
