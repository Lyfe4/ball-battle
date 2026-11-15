// Auth's part of GET /api/v1/health (ADR 0052): is Supabase Auth reachable, are both keys
// accepted, can guests be made, and are access tokens signed with keys we can verify? Each failed
// check is named after the setting to fix; why it failed goes to the log line only (failure.ts).
import { importJWK, type JWK } from 'jose';
import { AuthError, fetchAuth, refusalOf, SIGNING_ALGORITHMS } from './auth.ts';
import type { Config } from './config.ts';
import type { Stage } from './failure.ts';

export type AuthCheck =
  | 'auth'
  | 'auth_publishable_key'
  | 'auth_secret_key'
  | 'auth_anonymous_sign_ins'
  | 'auth_signing_keys';

/** A setting of Auth's that is wrong, in our own words (safe to log). */
export class AuthSettingError extends Error {
  override readonly name = 'AuthSettingError';
}

const TIMEOUT_MS = 8000;

/** A refused key is its own check; anything else Auth answers is Auth itself. */
const keyCheck = (error: unknown, key: AuthCheck): AuthCheck =>
  error instanceof AuthError && (error.status === 401 || error.status === 403) ? key : 'auth';

async function get(url: string, apikey?: string): Promise<unknown> {
  const response = await fetchAuth(url, {
    headers: apikey === undefined ? {} : { apikey },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw await refusalOf(response, `Auth answered ${String(response.status)}`);
  const body: unknown = await response.json();
  return body;
}

const field = (value: unknown, name: string): unknown =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[name]
    : undefined;

/** The publishable key is accepted, and anonymous sign-ins (how guests are made) are on. */
async function publicSide(config: Config): Promise<void> {
  const settings = await get(
    `${config.supabaseUrl}/auth/v1/settings`,
    config.supabasePublishableKey,
  );
  if (field(field(settings, 'external'), 'anonymous_users') !== true) {
    throw new AuthSettingError('anonymous sign-ins are off');
  }
}

/** The secret key is accepted by Auth's admin API (what "Forget me" uses). */
async function adminSide(config: Config): Promise<void> {
  await get(`${config.supabaseUrl}/auth/v1/admin/users?per_page=1`, config.supabaseSecretKey);
}

/** At least one published signing key is asymmetric, of an algorithm we verify, and importable. */
async function signingKeys(config: Config): Promise<void> {
  const set = await get(`${config.supabaseUrl}/auth/v1/.well-known/jwks.json`);
  const keys = field(set, 'keys');
  const candidates = (Array.isArray(keys) ? (keys as JWK[]) : []).filter(
    (key) => typeof key.alg === 'string' && SIGNING_ALGORITHMS.includes(key.alg),
  );
  const usable = await Promise.all(
    candidates.map((key) => importJWK(key).then(Boolean, () => false)),
  );
  if (usable.includes(true)) return;
  throw new AuthSettingError('no asymmetric signing key (still on the legacy JWT secret?)');
}

/** The checks that failed; each failure is noted with its cause. */
export async function authChecks(
  config: Config,
  noteFailure: (error: unknown, stage: Stage) => void,
): Promise<AuthCheck[]> {
  const run = (check: () => Promise<void>, onFail: (error: unknown) => AuthCheck) =>
    check().then(
      () => undefined,
      (error: unknown) => {
        noteFailure(error, 'auth');
        return onFail(error);
      },
    );
  const failed = await Promise.all([
    run(
      () => publicSide(config),
      (error) =>
        error instanceof AuthSettingError
          ? 'auth_anonymous_sign_ins'
          : keyCheck(error, 'auth_publishable_key'),
    ),
    run(
      () => adminSide(config),
      (error) => keyCheck(error, 'auth_secret_key'),
    ),
    run(
      () => signingKeys(config),
      (error) => (error instanceof AuthSettingError ? 'auth_signing_keys' : 'auth'),
    ),
  ]);
  // Auth unreachable fails every check the same way: name it once.
  return [...new Set(failed.filter((check) => check !== undefined))];
}
