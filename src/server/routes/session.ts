// /api/v1/session (ADR 0052, section 2).
// - POST makes a guest on the player's first online action, with their 16+ confirmation, and sets
//   the session cookie. A browser that already has a working session keeps it (a double tap or a
//   second tab makes no second guest).
// - DELETE logs out: ends the session in Auth and clears the cookie. The client clears every
//   `ballbattle.*` key itself. A guest who logs out can't come back, so the game offers "Forget
//   me" instead; settings offer Log out to accounts (ADR 0079), never during their live match or
//   lobby (409 `in_a_match`), which would be lost.
import { decodeCreateGuest } from '../../api/session.ts';
import { AuthError, signOut, signUpGuest } from '../auth.ts';
import { deleteUser } from '../auth-admin.ts';
import { clearedSessionCookie, readSession, sessionCookie } from '../cookie.ts';
import { createProfile } from '../db/profiles.ts';
import { guard, jsonBody } from '../guard.ts';
import { ApiError, json, type RouteHandler } from '../http.ts';
import { report } from '../monitor.ts';
import { ipSubject, LIMITS, spend } from '../rate-limit.ts';
import { optionalSession } from '../session.ts';
import { checkNotLiveNow } from '../sign-in.ts';
import { playerResponse } from './me.ts';

async function createGuest(...[request, context]: Parameters<RouteHandler>): Promise<Response> {
  if (decodeCreateGuest(await jsonBody(request)) === undefined) {
    throw new ApiError(400, 'age_unconfirmed', 'Online play is for players 16 and over');
  }
  const existing = await optionalSession(request, context).catch((error: unknown) => {
    // A dead session is replaced by a new guest; anything else is a real failure.
    if (error instanceof ApiError && error.code === 'unauthenticated') return undefined;
    throw error;
  });
  const { config, sql } = context.deps;
  if (existing !== undefined) return json(200, playerResponse(config, existing));
  if (context.ip !== undefined) {
    // One statement at a time on the connection (ADR 0052): the hour's count, then the day's.
    const subject = await ipSubject(config, context.ip);
    await spend(sql, subject, LIMITS.guests);
    await spend(sql, subject, LIMITS.guestsDaily);
  }
  const guest = await signUpGuest(config, context.ip).catch(async (error: unknown) => {
    // Auth's own anonymous sign-in limit (ADR 0052 section 11): the player gets a clear answer,
    // and we hear about it, since it may be every player's limit at once.
    if (error instanceof AuthError && error.status === 429) {
      await report(error, { route: 'session.create', requestId: context.requestId });
      throw new ApiError(503, 'guests_busy', 'Too many new players right now: try again soon', {
        'Retry-After': '300',
      });
    }
    throw error;
  });
  try {
    const profile = await createProfile(sql, guest.userId);
    context.setUser(profile.userId);
    context.setCookie(sessionCookie(guest.tokens));
    return json(201, playerResponse(config, profile));
  } catch (error) {
    // No half-made guest: an auth user without a profile could never play.
    await deleteUser(config, guest.userId).catch(() => undefined);
    throw error;
  }
}

async function logout(...[request, context]: Parameters<RouteHandler>): Promise<Response> {
  const tokens = readSession(request);
  if (tokens !== undefined) {
    // A session that no longer works logs out all the same.
    const player = await optionalSession(request, context).catch(() => undefined);
    if (player?.account === true) {
      await checkNotLiveNow(context.deps, [player.userId]).catch((error: unknown) => {
        if (error instanceof ApiError && error.code === 'in_a_match') {
          throw new ApiError(409, 'in_a_match', 'Finish or leave your match first, then log out');
        }
        throw error;
      });
    }
    await signOut(context.deps.config, (player?.tokens ?? tokens).access);
  }
  context.setCookie(clearedSessionCookie());
  return json(204, null);
}

export const session: RouteHandler = (request, context) => {
  guard(request, ['POST', 'DELETE']);
  return request.method === 'POST' ? createGuest(request, context) : logout(request, context);
};
