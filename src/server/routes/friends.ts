// /api/v1/friends (ADR 0079, PR (c)), accounts only and only while accounts are on:
// - GET: the account's friend code, friends, and requests in and out.
// - POST {to}: a request to a username or a friend code (or friends at once, if they had asked).
// - POST /api/v1/friends/:id/accept: accepts a request.
// - DELETE /api/v1/friends/:id: removes a friend, cancels a request, or declines one.
// - POST /api/v1/friends/:id/block, /unblock, and /report {reason} (2026-11-25, blocks.ts).
// Every answer is the list as it now is. A lookup is counted per account and per network before it
// is made (friends.ts says why).
import { decodeAddFriend, decodeReportName, isFriendshipId } from '../../api/friends.ts';
import { blockFriend, reportName, unblockFriend } from '../blocks.ts';
import { acceptFriend, addFriend, listFriends, removeFriend } from '../friends.ts';
import { guard, jsonBody } from '../guard.ts';
import { ApiError, json, type RouteContext, type RouteHandler } from '../http.ts';
import { ipSubject, LIMITS, spend, spendAll, type Limit } from '../rate-limit.ts';
import { spendRead } from '../read-count.ts';
import { sessionOf, type Session } from '../session.ts';
import { requireAccounts } from '../sign-in.ts';

const ONE = /^\/api\/v1\/friends\/([^/]+)(?:\/(accept|block|unblock|report))?$/;

/** The signed-in account; a guest is asked to sign in. */
async function accountOf(request: Request, context: RouteContext): Promise<Session> {
  const player = await sessionOf(request, context);
  if (!player.account) {
    throw new ApiError(403, 'not_an_account', 'Sign in to add friends');
  }
  return player;
}

export const friends: RouteHandler = async (request, context) => {
  requireAccounts(context);
  guard(request, ['GET', 'POST']);
  const player = await accountOf(request, context);
  const { deps } = context;
  if (request.method === 'GET') {
    await spendRead(deps, player.userId);
    return json(200, await listFriends(deps, player.userId), {
      'Cache-Control': 'private, no-store',
    });
  }
  const body = decodeAddFriend(await jsonBody(request));
  if (body === undefined) throw new ApiError(400, 'bad_request', 'Send a username or friend code');
  const spends: { subject: string; limit: Limit }[] = [
    { subject: player.userId, limit: LIMITS.friendLookups },
  ];
  if (context.ip !== undefined) {
    spends.push({
      subject: await ipSubject(deps.config, context.ip),
      limit: LIMITS.friendLookupsFromNetwork,
    });
  }
  await spendAll(deps.sql, spends);
  return json(200, await addFriend(deps, player.userId, body.to));
};

export const friendOne: RouteHandler = async (request, context) => {
  requireAccounts(context);
  const match = ONE.exec(new URL(request.url).pathname);
  const id = match?.[1];
  if (!isFriendshipId(id)) throw new ApiError(404, 'not_found', 'No such friend');
  const action = match?.[2];
  guard(request, action === undefined ? ['DELETE'] : ['POST']);
  const player = await accountOf(request, context);
  const { deps } = context;
  if (action === 'report') {
    const body = decodeReportName(await jsonBody(request));
    if (body === undefined) throw new ApiError(400, 'bad_request', 'Say why you report the name');
    return json(200, await reportName(deps, player.userId, id, body.reason));
  }
  await spend(deps.sql, player.userId, LIMITS.friendChanges);
  switch (action) {
    case 'accept':
      return json(200, await acceptFriend(deps, player.userId, id));
    case 'block':
      return json(200, await blockFriend(deps, player.userId, id));
    case 'unblock':
      return json(200, await unblockFriend(deps, player.userId, id));
    default:
      return json(200, await removeFriend(deps, player.userId, id));
  }
};
