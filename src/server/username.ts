// Choosing a username (ADR 0079): accounts only, checked here and nowhere else (the page shows
// these words). Every try counts against the account and its network first, so "taken" can't be
// used to list who plays: there is no separate "is it free?" check.
import { decodeUsername, USERNAME_RULE, type UsernameResponse } from '../api/accounts.ts';
import { setUsername } from './db/profiles.ts';
import { jsonBody } from './guard.ts';
import { ApiError, type RouteContext } from './http.ts';
import { ipSubject, LIMITS, spendAll, type Limit } from './rate-limit.ts';
import { sessionOf } from './session.ts';
import { usernameProblem } from './username-rules.ts';

const days = (count: number) => (count === 1 ? '1 day' : `${String(count)} days`);

export async function chooseUsername(
  request: Request,
  context: RouteContext,
): Promise<UsernameResponse> {
  const player = await sessionOf(request, context);
  if (!player.account) {
    throw new ApiError(403, 'not_an_account', 'Sign in to choose a username');
  }
  const body = decodeUsername(await jsonBody(request));
  if (body === undefined) throw new ApiError(400, 'bad_request', 'Send a username');
  const { config, sql } = context.deps;
  const spends: { subject: string; limit: Limit }[] = [
    { subject: player.userId, limit: LIMITS.usernames },
  ];
  if (context.ip !== undefined) {
    spends.push({
      subject: await ipSubject(config, context.ip),
      limit: LIMITS.usernamesFromNetwork,
    });
  }
  await spendAll(sql, spends);

  const name = body.username;
  const problem = usernameProblem(name);
  if (problem === 'format') throw new ApiError(400, 'username_invalid', USERNAME_RULE);
  if (problem === 'blocked') {
    throw new ApiError(400, 'username_blocked', 'That name isn’t allowed: choose another');
  }
  const change = await setUsername(sql, player.userId, name);
  switch (change.kind) {
    case 'taken':
      throw new ApiError(409, 'username_taken', 'Someone has that name: choose another');
    case 'too_soon':
      throw new ApiError(
        409,
        'username_too_soon',
        `You can change your username once a month: again in ${days(change.days)}`,
      );
    case 'set':
    case 'same':
      return { username: name };
  }
}
