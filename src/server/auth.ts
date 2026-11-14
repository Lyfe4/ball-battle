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

export class AuthError extends Error {
  override readonly name = 'AuthError';
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

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

export type Verified = { readonly userId: string } | 'expired' | 'invalid';

/** Whose access token this is, or why it can't be used. */
export async function verifyAccess(config: Config, token: string, now?: Date): Promise<Verified> {
  try {
    const { payload } = await jwtVerify(token, keysOf(config), {
      issuer: `${config.supabaseUrl}/auth/v1`,
      audience: 'authenticated',
      algorithms: ['ES256', 'RS256', 'EdDSA'],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      ...(now === undefined ? {} : { currentDate: now }),
    });
    const id = payload.sub;
    return typeof id === 'string' && id !== '' ? { userId: id } : 'invalid';
  } catch (error) {
    if (error instanceof errors.JWTExpired) return 'expired';
    // Auth's keys not reachable is an outage, never a reason to drop the player's session.
    if (error instanceof errors.JWKSTimeout) throw error;
    if (error instanceof errors.JOSEError) return 'invalid';
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
  headers: Readonly<Record<string, string>> = {},
): Promise<AuthSession> {
  const response = await fetch(`${config.supabaseUrl}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: config.supabasePublishableKey,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new AuthError(`Auth answered ${String(response.status)}`, response.status);
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
 * A new anonymous user. Auth limits anonymous sign-ins per IP, keyed on a header its gateway sets;
 * the client's IP is forwarded in case the gateway honours it (ADR 0052 section 11, measured on
 * staging with `scripts/anon-limit-probe.ts`).
 */
export function signUpGuest(config: Config, clientIp: string | undefined): Promise<AuthSession> {
  const forwarded: Record<string, string> =
    clientIp === undefined ? {} : { 'X-Forwarded-For': clientIp };
  return tokenCall(config, 'signup', {}, forwarded);
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
