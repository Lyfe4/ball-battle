// /api/v1/challenges (ADR 0052, "Friend challenges"):
// - POST /api/v1/challenges {format, bestOf, requestId, live}: a link to send a friend; by turns
//   with the sender's `lineup` (the last release's page sends one live too, ADR 0080).
// - GET /api/v1/challenges/:token: the format and length, and who sent it, before the friend
//   accepts. Needs no session: opening a link isn't an online action yet.
// - POST /api/v1/challenges/:token/accept {}: a live link starts the lineups picked together
//   (`startId`, ADR 0080); {lineup} starts a series by turns.
// - POST /api/v1/challenges/:token/cancel: the sender stops waiting in a live lobby (ADR 0053).
// - POST /api/v1/challenges/:token/decline: the friend a challenge was sent to says No thanks
//   (ADR 0079 PR (d)).
// The sender's own GET of a waiting live link is the lobby's heartbeat, counted as a read.
import {
  decodeAcceptChallenge,
  decodeCreateChallenge,
  isChallengeToken,
} from '../../api/challenges.ts';
import { acceptChallenge, cancelChallenge, challengeInfo, createChallenge } from '../challenges.ts';
import { declineInvite } from '../friend-challenge.ts';
import { guard, jsonBody } from '../guard.ts';
import { ApiError, json, type RouteHandler } from '../http.ts';
import { LIMITS, spend } from '../rate-limit.ts';
import { optionalSession, sessionOf } from '../session.ts';

const ONE = /^\/api\/v1\/challenges\/([A-Za-z0-9_-]+)(\/accept|\/cancel|\/decline)?$/;

export const challenges: RouteHandler = async (request, context) => {
  guard(request, ['POST']);
  const player = await sessionOf(request, context);
  const body = decodeCreateChallenge(await jsonBody(request));
  if (body === undefined) {
    throw new ApiError(400, 'bad_request', 'Send {format, bestOf, requestId}');
  }
  await spend(context.deps.sql, player.userId, LIMITS.challenges);
  return json(201, await createChallenge(context.deps, player.userId, body, player.account));
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
  if (match[2] === '/decline') {
    // The friend it was sent to says No thanks (ADR 0079 PR (d)); the sender's lobby says so.
    await spend(context.deps.sql, player.userId, LIMITS.moves);
    await declineInvite(context.deps, token, player.userId);
    return json(204, null);
  }
  if (match[2] === '/cancel') {
    await spend(context.deps.sql, player.userId, LIMITS.moves);
    return json(200, await cancelChallenge(context.deps, token, player.userId));
  }
  const body = decodeAcceptChallenge(await jsonBody(request));
  if (body === undefined) throw new ApiError(400, 'bad_request', 'Send {} or {lineup}');
  await spend(context.deps.sql, player.userId, LIMITS.moves);
  return json(200, await acceptChallenge(context.deps, token, player.userId, body.lineup));
};
