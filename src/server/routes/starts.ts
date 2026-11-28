// /api/v1/starts/:id (ADR 0080): lineups picked together after a live challenge or rematch was
// agreed.
// - GET: the start as its player sees it (their own draft, whether the other is ready, the clock),
//   which opens the lineup for them and makes the series once the clock has run out.
// - POST {lineup, lock, seq}: the lineup so far, or locked in; the second lock makes the series.
import { decodeStartMove } from '../../api/start.ts';
import { guard, jsonBody } from '../guard.ts';
import { ApiError, json, type RouteHandler } from '../http.ts';
import { LIMITS, spend } from '../rate-limit.ts';
import { spendRead } from '../read-count.ts';
import { sessionOf } from '../session.ts';
import { moveStart, readStart } from '../start.ts';

const ONE = /^\/api\/v1\/starts\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export const startOne: RouteHandler = async (request, context) => {
  const id = ONE.exec(new URL(request.url).pathname)?.[1];
  if (id === undefined) throw new ApiError(404, 'not_found', 'No such start');
  guard(request, ['GET', 'POST']);
  const player = await sessionOf(request, context);
  if (request.method === 'GET') {
    await spendRead(context.deps, player.userId);
    return json(200, await readStart(context.deps, id, player.userId));
  }
  const move = decodeStartMove(await jsonBody(request));
  if (move === undefined) throw new ApiError(400, 'bad_request', 'Send {lineup, lock, seq}');
  await spend(context.deps.sql, player.userId, LIMITS.moves);
  return json(200, await moveStart(context.deps, id, player.userId, move));
};
