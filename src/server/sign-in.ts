// What both sign-ins share (ADR 0079): the switch, who may sign in, the live-match rule, and the
// three ways one ends (a guest linked, a new device signed in, an existing account held for
// "Switch to it?"). Rules read `profiles.account_at` (the session's `account`), never a token's
// `is_anonymous`: a copy of a guest's old token stays valid for up to an hour after linking.
import type { AuthSession } from './auth.ts';
import { signOut } from './auth.ts';
import { checkNotLive } from './challenges.ts';
import { sessionCookie } from './cookie.ts';
import type { TransactionSql } from './db.ts';
import { liveNowOf } from './db/live.ts';
import { markAccount } from './db/profiles.ts';
import { loadSeries } from './db/series-record.ts';
import { ApiError, type Deps, type RouteContext } from './http.ts';
import { settleLive } from './live-service.ts';
import { clearedCookie, openCookie, sealCookie } from './sealed-cookie.ts';
import { optionalSession, type Session } from './session.ts';

/** Which email a code went to, and by which path (`email-sign-in.ts`). */
export const EMAIL_COOKIE = '__Host-bb_email';
/** Google's state, PKCE verifier and nonce (`google-sign-in.ts`): one use. */
export const OAUTH_COOKIE = '__Host-bb_oauth';
/** An existing account found for a guest, until the player switches to it or stays. */
export const PENDING_COOKIE = '__Host-bb_pending';

/** Refuses every sign-in route while accounts are switched off. */
export function requireAccounts(context: RouteContext): void {
  if (!context.deps.config.accounts) {
    throw new ApiError(404, 'accounts_off', 'Accounts are not switched on here');
  }
}

/**
 * Who is starting or finishing a sign-in: a guest, or nobody (a new device, or a session that
 * ended). An account is refused: it signs out first.
 */
export async function signInPlayer(
  request: Request,
  context: RouteContext,
): Promise<Session | undefined> {
  const session = await optionalSession(request, context).catch((error: unknown) => {
    if (error instanceof ApiError && error.code === 'unauthenticated') return undefined;
    throw error;
  });
  if (session?.account === true) {
    throw new ApiError(409, 'already_signed_in', 'You are signed in already');
  }
  return session;
}

/**
 * Each player's own live match, with what its clock decided by now written (ADR 0053): one both
 * players left is forfeited here rather than refusing as if it still went on. Before the lock,
 * since settling writes on its own connections and a function has one.
 */
async function settleOwnLive(deps: Deps, players: readonly string[]): Promise<void> {
  for (const player of players) {
    const now = await liveNowOf(deps.sql, player);
    if (now?.kind !== 'series') continue;
    const loaded = await loadSeries(deps.sql, now.id);
    if (loaded !== undefined) await settleLive(deps, loaded);
  }
}

/**
 * Runs `then` holding every player's live lock (ADR 0053's `in_a_match`, taken in one order so two
 * of these never wait on each other), refusing while any of them has a live match or a lobby. No
 * sign-in starts or finishes during one.
 */
export async function whileNotLive<T>(
  deps: Deps,
  players: readonly string[],
  then: (db: TransactionSql) => Promise<T>,
): Promise<T> {
  await settleOwnLive(deps, players);
  return deps.sql.begin(async (db) => {
    try {
      for (const player of [...players].sort()) await checkNotLive(db, player);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'in_a_match') {
        throw new ApiError(409, 'in_a_match', 'Finish or leave your match first, then sign in');
      }
      throw error;
    }
    return then(db);
  });
}

/** Refuses while any of `players` has a live match or lobby (a sign-in starting). */
export function checkNotLiveNow(deps: Deps, players: readonly string[]): Promise<void> {
  return whileNotLive(deps, players, () => Promise.resolve());
}

/** This device is now `account`: its profile marked (made if new), the session cookie set. */
export async function signInAs(
  db: TransactionSql,
  context: RouteContext,
  account: AuthSession,
): Promise<void> {
  await markAccount(db, account.userId);
  context.setUser(account.userId);
  context.setCookie(sessionCookie(account.tokens));
}

/**
 * A device without a guest signs in to `account`, unless that account is in a live match or lobby
 * elsewhere: then the new session is ended at once and the sign-in refused.
 */
export async function signInNewDevice(
  deps: Deps,
  context: RouteContext,
  account: AuthSession,
): Promise<void> {
  try {
    await whileNotLive(deps, [account.userId], (db) => signInAs(db, context, account));
  } catch (error) {
    await signOut(deps.config, account.tokens.access);
    throw error;
  }
}

/** The account a guest's email or Google already belongs to, waiting for "Switch to it?". */
export async function holdPending(
  context: RouteContext,
  guestId: string,
  account: AuthSession,
): Promise<void> {
  const { access, refresh } = account.tokens;
  context.setCookie(
    await sealCookie(context.deps.config, PENDING_COOKIE, {
      g: guestId,
      u: account.userId,
      a: access,
      r: refresh,
    }),
  );
}

export interface Pending {
  readonly guestId: string;
  readonly account: AuthSession;
}

/** The account held for this request's guest, if any. */
export async function pendingOf(
  request: Request,
  context: RouteContext,
): Promise<Pending | undefined> {
  const held = await openCookie(context.deps.config, request, PENDING_COOKIE);
  if (held === undefined) return undefined;
  const { g, u, a, r } = held;
  if (typeof g !== 'string' || typeof u !== 'string' || typeof a !== 'string') return undefined;
  if (typeof r !== 'string') return undefined;
  return { guestId: g, account: { userId: u, tokens: { access: a, refresh: r } } };
}

export const clearPending = (context: RouteContext): void => {
  context.setCookie(clearedCookie(PENDING_COOKIE));
};
