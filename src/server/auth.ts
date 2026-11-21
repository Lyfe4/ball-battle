// Supabase Auth, called only by the functions (ADR 0052): the browser never talks to Supabase.
// Plain `fetch` to Auth's REST endpoints, and access tokens verified locally against the project's
// published signing keys (JWKS): issuer and audience checked, and an explicit 30 s clock tolerance
// rather than the library's default of none. A token from a project still on the legacy shared
// secret is refused: staging and production must use asymmetric signing keys (the default for new
// projects).
import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import type { Config } from './config.ts';
import type { SessionTokens } from './cookie.ts';

/** Hosts' clocks differ a little; never trust a token much past its expiry. */
const CLOCK_TOLERANCE_SECONDS = 30;
const AUTH_TIMEOUT_MS = 8000;

/** Auth's own error codes (`anonymous_provider_disabled`): plain words, never a value. */
const AUTH_CODE = /^[a-z][a-z0-9_]{1,59}$/;

/**
 * Auth refused (its HTTP status and, when it gave one, its error code), or couldn't be reached
 * (status 0, the network error as cause).
 */
export class AuthError extends Error {
  override readonly name = 'AuthError';
  readonly status: number;
  readonly code: string | undefined;
  constructor(message: string, status: number, cause?: unknown, code?: string) {
    super(message, cause === undefined ? undefined : { cause });
    this.status = status;
    this.code = code !== undefined && AUTH_CODE.test(code) ? code : undefined;
  }
}

/** An AuthError for Auth's refusal, with the error code from its body when it sent one. */
export async function refusalOf(response: Response, message: string): Promise<AuthError> {
  const body: unknown = await response.json().catch(() => undefined);
  const code =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)['error_code']
      : undefined;
  return new AuthError(
    message,
    response.status,
    undefined,
    typeof code === 'string' ? code : undefined,
  );
}

/** `fetch` to Auth, with a network failure turned into an AuthError (status 0). */
export function fetchAuth(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, init).catch((error: unknown) => {
    throw new AuthError(
      'Auth could not be reached',
      0,
      (error as { cause?: unknown }).cause ?? error,
    );
  });
}

/** The asymmetric algorithms Auth signs access tokens with; the legacy shared secret is refused. */
export const SIGNING_ALGORITHMS: readonly string[] = ['ES256', 'RS256', 'EdDSA'];

type KeySet = ReturnType<typeof createRemoteJWKSet>;
const keySets = new Map<string, KeySet>();
function keysOf(config: Config): KeySet {
  let keys = keySets.get(config.supabaseUrl);
  if (keys === undefined) {
    keys = createRemoteJWKSet(new URL(`${config.supabaseUrl}/auth/v1/.well-known/jwks.json`));
    keySets.set(config.supabaseUrl, keys);
  }
  return keys;
}

/** What jose says about the token itself, as opposed to the key set it was checked against. */
const TOKEN_REFUSALS = [
  errors.JWTClaimValidationFailed,
  errors.JWTInvalid,
  errors.JWSInvalid,
  errors.JWSSignatureVerificationFailed,
  errors.JOSEAlgNotAllowed,
  errors.JOSENotSupported,
];

export type Verified = { readonly userId: string } | 'expired' | 'invalid';

/** Whose access token this is, or why it can't be used. */
export async function verifyAccess(config: Config, token: string, now?: Date): Promise<Verified> {
  try {
    const { payload } = await jwtVerify(token, keysOf(config), {
      issuer: `${config.supabaseUrl}/auth/v1`,
      audience: 'authenticated',
      algorithms: [...SIGNING_ALGORITHMS],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      ...(now === undefined ? {} : { currentDate: now }),
    });
    const id = payload.sub;
    return typeof id === 'string' && id !== '' ? { userId: id } : 'invalid';
  } catch (error) {
    if (error instanceof errors.JWTExpired) return 'expired';
    // Signed by a key no longer published (Auth's keys were rotated): checked before its expiry,
    // so let the refresh decide. A real session goes on; a forged token is refused there.
    if (error instanceof errors.JWKSNoMatchingKey) return 'expired';
    if (TOKEN_REFUSALS.some((refusal) => error instanceof refusal)) return 'invalid';
    // Anything else is Auth's keys out of reach: a timeout, an error page instead of the key set
    // (jose throws a plain JOSEError for a non-200), a malformed set. An outage, never a reason to
    // drop the player's session.
    throw error;
  }
}

/** A session as Auth hands it out. */
export interface AuthSession {
  readonly userId: string;
  readonly tokens: SessionTokens;
}

async function tokenCall(
  config: Config,
  path: string,
  body: unknown,
  headers: Readonly<Record<string, string>> = { apikey: config.supabasePublishableKey },
): Promise<AuthSession> {
  const response = await fetchAuth(`${config.supabaseUrl}/auth/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw await refusalOf(response, `Auth answered ${String(response.status)}`);
  }
  const answer = (await response.json()) as Record<string, unknown>;
  const access = answer['access_token'];
  const refresh = answer['refresh_token'];
  const user = answer['user'];
  const id =
    typeof user === 'object' && user !== null ? (user as Record<string, unknown>)['id'] : undefined;
  if (typeof access !== 'string' || typeof refresh !== 'string' || typeof id !== 'string') {
    throw new AuthError('Auth answered without a session', 502);
  }
  return { userId: id, tokens: { access, refresh } };
}

/**
 * A new anonymous user. Auth limits anonymous sign-ins per IP (ADR 0052 section 11). Hosted Auth
 * counts the address that connects to it, which is our function's, shared by every player, and
 * ignores `X-Forwarded-For` (measured on staging, 2026-11-18). It counts the player's own IP only
 * from `Sb-Forwarded-For` on a request made with a secret key, and only once the project's "IP
 * Address Forwarding" is on; until then the header is ignored, as before.
 */
export function signUpGuest(config: Config, clientIp: string | undefined): Promise<AuthSession> {
  return tokenCall(
    config,
    'signup',
    {},
    {
      apikey: config.supabaseSecretKey,
      ...(clientIp === undefined ? {} : { 'Sb-Forwarded-For': clientIp }),
    },
  );
}

/**
 * New tokens for a refresh token. Auth rotates refresh tokens but accepts a used one again within
 * its reuse interval (10 s), so two tabs refreshing at once both succeed.
 */
export function refreshSession(config: Config, refresh: string): Promise<AuthSession> {
  return tokenCall(config, 'token?grant_type=refresh_token', { refresh_token: refresh });
}

/** Ends this session in Auth, so its refresh token stops working. Best effort. */
export async function signOut(config: Config, access: string): Promise<void> {
  await fetch(`${config.supabaseUrl}/auth/v1/logout?scope=local`, {
    method: 'POST',
    headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${access}` },
    signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
  }).catch(() => undefined);
}
