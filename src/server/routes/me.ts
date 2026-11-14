// /api/v1/me (ADR 0052, section 2).
// - GET: the player as they see themselves.
// - DELETE: "Forget me". Deletes the player at once: their auth user and profile, their open
//   challenges, and their open series (forfeited to the opponent). Finished series stay in the
//   opponent's history with this player shown as "Deleted player". The cookie is cleared; the
//   client clears every `ballbattle.*` key.
import type { PlayerResponse } from '../../api/session.ts';
import { deleteUser } from '../auth-admin.ts';
import { clearedSessionCookie } from '../cookie.ts';
import { guard } from '../guard.ts';
import { json, type RouteHandler } from '../http.ts';
import { sessionOf } from '../session.ts';

export const me: RouteHandler = async (request, context) => {
  guard(request, ['GET', 'DELETE']);
  const player = await sessionOf(request, context);
  if (request.method === 'GET') return json(200, { name: player.name } satisfies PlayerResponse);
  await deleteUser(context.deps.config, player.userId);
  context.setCookie(clearedSessionCookie());
  return json(204, null);
};
