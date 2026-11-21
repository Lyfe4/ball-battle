// `sessionOf`: the one way every route learns who is asking (ADR 0052, section 2). A native app's
// bearer token, later, changes this file alone. It reads the session cookie, verifies the access
// token, refreshes it when it has expired (rewriting the cookie), and requires the player's
// profile, so a deleted guest's old cookie stops working at once.
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

/** Who is asking, if anyone: undefined with no session cookie at all. */
export async function optionalSession(
  request: Request,
  context: RouteContext,
): Promise<Session | undefined> {
  const tokens = readSession(request);
  if (tokens === undefined) return undefined;
  const { config, sql } = context.deps;
  let current = tokens;
  let verified = await verifyAccess(config, tokens.access, context.deps.tokenClock?.());
  if (verified === 'expired') {
    try {
      const refreshed = await refreshSession(config, tokens.refresh);
      current = refreshed.tokens;
      verified = { userId: refreshed.userId };
      context.setCookie(sessionCookie(current));
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
  const profile = await profileOf(sql, verified.userId);
  if (profile === undefined) throw unauthenticated(context, 'This player no longer exists');
  context.setUser(profile.userId);
  return { ...profile, tokens: current };
}

/** Who is asking; a 401 `unauthenticated` when nobody is. */
export async function sessionOf(request: Request, context: RouteContext): Promise<Session> {
  const session = await optionalSession(request, context);
  if (session === undefined)
    throw new ApiError(401, 'unauthenticated', 'Start playing online first');
  return session;
}
