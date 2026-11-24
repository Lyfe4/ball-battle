// `sessionOf`: the one way every route learns who is asking (ADR 0052, section 2). A native app's
// bearer token, later, changes this file alone. It reads the session cookie, verifies the access
// token, refreshes it when it has expired (rewriting the cookie), and requires the player's
// profile, so a deleted guest's old cookie stops working at once. `sessionWith` is the same for a
// route whose first statement reads the profile itself (the series read: one round trip, not two).
import { AuthError, refreshSession, verifyAccess } from './auth.ts';
import { clearedSessionCookie, readSession, sessionCookie, type SessionTokens } from './cookie.ts';
import { profileOf, type Profile } from './db/profiles.ts';
import { ApiError, type RouteContext } from './http.ts';

export interface Session extends Profile {
  readonly tokens: SessionTokens;
}

const unauthenticated = (context: RouteContext, message: string): ApiError => {
  context.setCookie(clearedSessionCookie());
  return new ApiError(401, 'unauthenticated', message);
};

/** Whose token the request carries (refreshed if it had expired); undefined with no cookie. */
async function verifiedOf(
  request: Request,
  context: RouteContext,
): Promise<{ readonly userId: string; readonly tokens: SessionTokens } | undefined> {
  const tokens = readSession(request);
  if (tokens === undefined) return undefined;
  const { config } = context.deps;
  const verified = await verifyAccess(config, tokens.access, context.deps.tokenClock?.());
  if (verified === 'expired') {
    try {
      const refreshed = await refreshSession(config, tokens.refresh);
      context.setCookie(sessionCookie(refreshed.tokens));
      return { userId: refreshed.userId, tokens: refreshed.tokens };
    } catch (error) {
      // Refused (revoked, or reused past its window): the guest has to start again. Auth being
      // down or busy (a 429 counts our functions' shared address, not this player) is our fault,
      // not the player's: a 500 that keeps their cookie.
      if (
        error instanceof AuthError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 429
      ) {
        throw unauthenticated(context, 'Your session has ended');
      }
      throw error;
    }
  }
  if (verified === 'invalid') throw unauthenticated(context, 'Your session is not valid');
  return { userId: verified.userId, tokens };
}

/** The session of a verified token whose profile `profile` is (a 401 when it has none). */
function sessionFrom(
  context: RouteContext,
  tokens: SessionTokens,
  profile: Profile | undefined,
): Session {
  if (profile === undefined) throw unauthenticated(context, 'This player no longer exists');
  context.setUser(profile.userId);
  return { ...profile, tokens };
}

/** Who is asking, if anyone: undefined with no session cookie at all. */
export async function optionalSession(
  request: Request,
  context: RouteContext,
): Promise<Session | undefined> {
  const verified = await verifiedOf(request, context);
  if (verified === undefined) return undefined;
  const profile = await profileOf(context.deps.sql, verified.userId);
  return sessionFrom(context, verified.tokens, profile);
}

/** Who is asking; a 401 `unauthenticated` when nobody is. */
export async function sessionOf(request: Request, context: RouteContext): Promise<Session> {
  const session = await optionalSession(request, context);
  if (session === undefined)
    throw new ApiError(401, 'unauthenticated', 'Start playing online first');
  return session;
}

/**
 * `sessionOf`, with the route's first statement reading the profile (`read`, given the token's
 * user, answers it as `profile`, marked seen as `profileOf` marks it, and writes nothing for a
 * player without one): the session and that statement in one round trip. The same 401s.
 */
export async function sessionWith<T extends { readonly profile: Profile | undefined }>(
  request: Request,
  context: RouteContext,
  read: (userId: string) => Promise<T>,
): Promise<{ readonly session: Session; readonly read: T }> {
  const verified = await verifiedOf(request, context);
  if (verified === undefined)
    throw new ApiError(401, 'unauthenticated', 'Start playing online first');
  const answer = await read(verified.userId);
  return { session: sessionFrom(context, verified.tokens, answer.profile), read: answer };
}
