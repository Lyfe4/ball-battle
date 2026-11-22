// Signing in with Google through our own callback (ADR 0079), a server-side code flow:
// 1. `start` makes a state, a PKCE verifier and a nonce (32 random bytes each), seals them in a
//    10-minute cookie with who started (a guest, or a new device that confirmed 16+), and sends the
//    browser to Google with the state, the verifier's S256 challenge and the nonce's SHA-256.
// 2. `finish` (the callback) clears that cookie whatever happens, and marks its state used in the
//    database, so it works once; checks the state in constant time (login CSRF); exchanges the code with the verifier (a code stolen
//    without it is useless); checks the ID token's nonce itself (a replayed token); and only then
//    asks Supabase for a session with the raw nonce, linking the guest (same user id) or signing in.
// The ID token never leaves the function. Every outcome is a redirect to the sign-in screen
// (`?view=signin&google=<result>`): a navigation can't show the API's JSON errors.
import { timingSafeEqual } from 'node:crypto';
import { decodeJwt } from 'jose';
import type { GoogleResult } from '../api/accounts.ts';
import { AuthError } from './auth.ts';
import { idTokenSession, type GoogleTokens } from './auth-sign-in.ts';
import type { GoogleClient } from './config.ts';
import { ApiError, type RouteContext } from './http.ts';
import { report } from './monitor.ts';
import { LIMITS, spend } from './rate-limit.ts';
import { clearedCookie, openCookie, sealCookie } from './sealed-cookie.ts';
import {
  checkNotLiveNow,
  holdPending,
  OAUTH_COOKIE,
  signInAs,
  signInNewDevice,
  signInPlayer,
  whileNotLive,
} from './sign-in.ts';

const AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALLBACK_PATH = '/api/v1/auth/google/callback';
const GOOGLE_TIMEOUT_MS = 8000;

/** 32 random bytes, base64url: a state, a verifier or a nonce. */
const randomValue = (): string =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');

const sha256 = async (text: string): Promise<Buffer> =>
  Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

/** PKCE's S256 challenge for a verifier (RFC 7636). */
export const challengeOf = async (verifier: string): Promise<string> =>
  (await sha256(verifier)).toString('base64url');

/** What the ID token carries for a raw nonce: its SHA-256 in hex, as Supabase checks it. */
export const hashedNonce = async (nonce: string): Promise<string> =>
  (await sha256(nonce)).toString('hex');

/** Equal strings, compared in constant time (their hashes, so lengths don't show either). */
async function sameText(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  return timingSafeEqual(x, y);
}

const redirectUriOf = (request: Request): string =>
  `${new URL(request.url).origin}${CALLBACK_PATH}`;

const googleOf = (context: RouteContext): GoogleClient => {
  const { google } = context.deps.config;
  if (google === undefined) {
    throw new ApiError(404, 'not_found', 'Google sign-in isn’t set up here');
  }
  return google;
};

/** The sign-in screen, saying how a Google sign-in went. */
export function backToSignIn(request: Request, result: GoogleResult): Response {
  const url = new URL('/', new URL(request.url).origin);
  url.searchParams.set('view', 'signin');
  url.searchParams.set('google', result);
  return new Response(null, {
    status: 303,
    headers: { Location: url.href, 'Cache-Control': 'no-store' },
  });
}

/** A refusal before Google as a result for the sign-in screen. */
function resultOf(error: unknown): GoogleResult | undefined {
  if (!(error instanceof ApiError)) return undefined;
  if (error.code === 'in_a_match') return 'in_a_match';
  if (error.code === 'already_signed_in') return 'signed_in';
  return undefined;
}

/** GET /api/v1/auth/google: to Google, or back to the sign-in screen saying why not. */
export async function startGoogle(request: Request, context: RouteContext): Promise<Response> {
  const google = googleOf(context);
  try {
    const guest = await signInPlayer(request, context);
    const adult = new URL(request.url).searchParams.get('adult') === '1';
    if (guest === undefined && !adult) return backToSignIn(request, 'expired');
    if (guest !== undefined) await checkNotLiveNow(context.deps, [guest.userId]);
    const state = randomValue();
    const verifier = randomValue();
    const nonce = randomValue();
    context.setCookie(
      await sealCookie(context.deps.config, OAUTH_COOKIE, {
        s: state,
        v: verifier,
        n: nonce,
        g: guest?.userId ?? null,
      }),
    );
    const to = new URL(AUTHORIZE);
    to.search = new URLSearchParams({
      client_id: google.clientId,
      redirect_uri: redirectUriOf(request),
      response_type: 'code',
      scope: 'openid email',
      state,
      code_challenge: await challengeOf(verifier),
      code_challenge_method: 'S256',
      nonce: await hashedNonce(nonce),
      prompt: 'select_account',
    }).toString();
    return new Response(null, {
      status: 303,
      headers: { Location: to.href, 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const result = resultOf(error);
    if (result === undefined) throw error;
    return backToSignIn(request, result);
  }
}

/** Google's tokens for an authorization code and its PKCE verifier. */
export async function exchangeCode(
  google: GoogleClient,
  redirectUri: string,
  code: string,
  verifier: string,
): Promise<GoogleTokens> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      client_id: google.clientId,
      client_secret: google.clientSecret,
      redirect_uri: redirectUri,
    }).toString(),
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Google's token endpoint answered ${String(response.status)}`);
  const body = (await response.json()) as Record<string, unknown>;
  const { id_token: idToken, access_token: accessToken } = body;
  if (typeof idToken !== 'string' || typeof accessToken !== 'string') {
    throw new Error('Google answered without an ID token');
  }
  return { idToken, accessToken };
}

/** The nonce claim of an ID token straight from Google (Supabase checks its signature). */
function nonceClaim(idToken: string): string | undefined {
  try {
    const { nonce } = decodeJwt(idToken);
    return typeof nonce === 'string' ? nonce : undefined;
  } catch {
    return undefined;
  }
}

/** Auth's answer when the Google account already belongs to another account. */
const belongsElsewhere = (error: unknown): boolean =>
  error instanceof AuthError &&
  (error.code === 'identity_already_exists' || error.code === 'email_exists');

/** GET /api/v1/auth/google/callback. */
export async function finishGoogle(request: Request, context: RouteContext): Promise<Response> {
  const google = googleOf(context);
  const { config } = context.deps;
  const sealed = await openCookie(config, request, OAUTH_COOKIE);
  // One use: whatever happens below, this sign-in can't be finished again.
  context.setCookie(clearedCookie(OAUTH_COOKIE));
  const query = new URL(request.url).searchParams;
  if (query.has('error')) return backToSignIn(request, 'cancelled');
  const { s: state, v: verifier, n: nonce, g: guestId } = sealed ?? {};
  if (typeof state !== 'string' || typeof verifier !== 'string' || typeof nonce !== 'string') {
    return backToSignIn(request, 'expired');
  }
  if (!(await sameText(query.get('state') ?? '', state))) return backToSignIn(request, 'expired');
  // Used once on the server too: the browser drops the cookie, and a copy of it is refused here.
  const used = await spend(
    context.deps.sql,
    `google:${await hashedNonce(state)}`,
    LIMITS.googleState,
  )
    .then(() => false)
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.code === 'rate_limited') return true;
      throw error;
    });
  if (used) return backToSignIn(request, 'expired');
  const code = query.get('code');
  if (code === null || code === '') return backToSignIn(request, 'failed');
  try {
    const tokens = await exchangeCode(google, redirectUriOf(request), code, verifier);
    const claim = nonceClaim(tokens.idToken);
    if (claim === undefined || !(await sameText(claim, await hashedNonce(nonce)))) {
      return backToSignIn(request, 'failed');
    }
    const guest = await signInPlayer(request, context);
    // Finished by the device that started it: the same guest, or still none.
    if ((guest?.userId ?? null) !== guestId) return backToSignIn(request, 'expired');
    if (guest === undefined) {
      await signInNewDevice(
        context.deps,
        context,
        await idTokenSession(config, context.ip, tokens, nonce),
      );
      return backToSignIn(request, 'signed_in');
    }
    const result = await whileNotLive(context.deps, [guest.userId], async (db) => {
      try {
        const linked = await idTokenSession(config, context.ip, tokens, nonce, guest.tokens.access);
        if (linked.userId !== guest.userId) throw new Error('Linking answered another user');
        await signInAs(db, context, linked);
        return 'signed_in' as const;
      } catch (error) {
        if (!belongsElsewhere(error)) throw error;
        // That Google account (or its email) has an account: offer to switch to it.
        await holdPending(
          context,
          guest.userId,
          await idTokenSession(config, context.ip, tokens, nonce),
        );
        return 'switch' as const;
      }
    });
    return backToSignIn(request, result);
  } catch (error) {
    const result = resultOf(error);
    if (result !== undefined) return backToSignIn(request, result);
    // Answered with a redirect, so the log line names the failure here.
    context.noteFailure(error, 'auth');
    await report(error, { route: 'auth.google.callback', requestId: context.requestId });
    return backToSignIn(request, 'failed');
  }
}
