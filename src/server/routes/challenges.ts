// /api/v1/challenges (ADR 0052, "Friend challenges"):
// - POST /api/v1/challenges {format, bestOf, lineup, requestId}: a link to send a friend.
// - GET /api/v1/challenges/:token: the format and length, and who sent it, before the friend
//   builds a lineup. Needs no session: opening a link isn't an online action yet.
// - POST /api/v1/challenges/:token/accept {lineup}: starts the series.
// - POST /api/v1/challenges/:token/cancel: the sender stops waiting in a live lobby (ADR 0053).
// The sender's own GET of a waiting live link is the lobby's heartbeat, counted as a read.
import {
  decodeAcceptChallenge,
  decodeCreateChallenge,
  isChallengeToken,
} from '../../api/challenges.ts';
import { acceptChallenge, cancelChallenge, challengeInfo, createChallenge } from '../challenges.ts';
import { guard, jsonBody } from '../guard.ts';
import { ApiError, json, type RouteHandler } from '../http.ts';
import { LIMITS, spend } from '../rate-limit.ts';
import { optionalSession, sessionOf } from '../session.ts';

const ONE = /^\/api\/v1\/challenges\/([A-Za-z0-9_-]+)(\/accept|\/cancel)?$/;

export const challenges: RouteHandler = async (request, context) => {
  guard(request, ['POST']);
  const player = await sessionOf(request, context);
  const body = decodeCreateChallenge(await jsonBody(request));
  if (body === undefined) {
    throw new ApiError(400, 'bad_request', 'Send {format, bestOf, lineup, requestId}');
  }
  await spend(context.deps.sql, player.userId, LIMITS.challenges);
  return json(201, await createChallenge(context.deps, player.userId, body));
};

export const challengeOne: RouteHandler = async (request, context) => {
  const match = ONE.exec(new URL(request.url).pathname);
  const token = match?.[1];
  if (!isChallengeToken(token)) throw new ApiError(404, 'not_found', 'No such challenge');
  if (match?.[2] === undefined) {
    guard(request, ['GET']);
    const viewer = await optionalSession(request, context).catch(() => undefined);
    if (viewer !== undefined) await spend(context.deps.sql, viewer.userId, LIMITS.reads);
    return json(200, await challengeInfo(context.deps, token, viewer?.userId));
  }
  guard(request, ['POST']);
  const player = await sessionOf(request, context);
  if (match[2] === '/cancel') {
    await spend(context.deps.sql, player.userId, LIMITS.moves);
    return json(200, await cancelChallenge(context.deps, token, player.userId));
  }
  const body = decodeAcceptChallenge(await jsonBody(request));
  if (body === undefined) throw new ApiError(400, 'bad_request', 'Send {lineup}');
  await spend(context.deps.sql, player.userId, LIMITS.moves);
  return json(200, await acceptChallenge(context.deps, token, player.userId, body.lineup));
};
