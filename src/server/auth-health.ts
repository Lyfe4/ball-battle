// Auth's part of GET /api/v1/health (ADR 0052): is Supabase Auth reachable, are both keys
// accepted, can guests be made, and are access tokens signed with keys we can verify? Each failed
// check is named after the setting to fix; why it failed goes to the log line only (failure.ts).
//
// One call to Auth per request, not three: Auth itself, the publishable key and anonymous sign-ins
// (what every new player needs) are asked every time, so an outage shows at once; the secret key and
// the signing keys are settings that change only by hand, so a pass of theirs stands for
// SETTINGS_PASS_MS on this function instance. A failure is never kept: it is asked again next time.
import { importJWK, type JWK } from 'jose';
import { AuthError, fetchAuth, refusalOf, SIGNING_ALGORITHMS } from './auth.ts';
import type { Config } from './config.ts';
import type { Stage } from './failure.ts';

/** Sign-in's own settings (ADR 0079): /health names them apart, never as the game being down. */
export const ACCOUNT_CHECKS = ['auth_email_confirmations', 'auth_google'] as const;
export type AccountCheck = (typeof ACCOUNT_CHECKS)[number];

export const isAccountCheck = (check: AuthCheck): check is AccountCheck =>
  ACCOUNT_CHECKS.some((one) => one === check);

export type AuthCheck =
  | 'auth'
  | 'auth_publishable_key'
  | 'auth_secret_key'
  | 'auth_anonymous_sign_ins'
  | 'auth_signing_keys'
  | 'auth_email_confirmations'
  | 'auth_google';

/** A setting of Auth's that is wrong, in our own words (safe to log). */
export class AuthSettingError extends Error {
  override readonly name = 'AuthSettingError';
  /** The check it fails. */
  readonly check: AuthCheck;
  constructor(message: string, check: AuthCheck) {
    super(message);
    this.check = check;
  }
}

const TIMEOUT_MS = 8000;

type NoteFailure = (error: unknown, stage: Stage) => void;

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

/**
 * The publishable key is accepted, and anonymous sign-ins (how guests are made) are on. With
 * accounts on (ADR 0079), Auth also needs email confirmations ("Confirm email"): off, it applies a
 * guest's email change without a code, so anyone could take an address. Google needs its provider.
 * Those two are sign-in's own checks (ACCOUNT_CHECKS): returned, never thrown, so a sign-in setting
 * never hides or stands for the game's own.
 */
async function publicSide(config: Config, noteFailure: NoteFailure): Promise<AuthCheck[]> {
  const settings = await get(
    `${config.supabaseUrl}/auth/v1/settings`,
    config.supabasePublishableKey,
  );
  const external = field(settings, 'external');
  if (field(external, 'anonymous_users') !== true) {
    throw new AuthSettingError('anonymous sign-ins are off', 'auth_anonymous_sign_ins');
  }
  const failed: AuthSettingError[] = [];
  if (config.accounts && field(settings, 'mailer_autoconfirm') !== false) {
    failed.push(new AuthSettingError('email confirmations are off', 'auth_email_confirmations'));
  }
  if (config.accounts && config.google !== undefined && field(external, 'google') !== true) {
    failed.push(new AuthSettingError('the Google provider is off', 'auth_google'));
  }
  for (const error of failed) noteFailure(error, 'auth');
  return failed.map((error) => error.check);
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
  throw new AuthSettingError(
    'no asymmetric signing key (still on the legacy JWT secret?)',
    'auth_signing_keys',
  );
}

/** One check: undefined when it passed, else the check to name (its cause noted). */
const run = (
  check: () => Promise<void>,
  onFail: (error: unknown) => AuthCheck,
  noteFailure: NoteFailure,
): Promise<AuthCheck | undefined> =>
  check().then(
    () => undefined,
    (error: unknown) => {
      noteFailure(error, 'auth');
      return onFail(error);
    },
  );

/**
 * Auth answers, with the publishable key, and anonymous sign-ins are on: asked every time. Its
 * checks that failed: Auth's own (one), else sign-in's (any).
 */
const liveCheck = (config: Config, noteFailure: NoteFailure): Promise<AuthCheck[]> =>
  publicSide(config, noteFailure).catch((error: unknown) => {
    noteFailure(error, 'auth');
    return [
      error instanceof AuthSettingError ? error.check : keyCheck(error, 'auth_publishable_key'),
    ];
  });

/** The settings that change only by hand: the secret key and the signing keys. */
const settingChecks = (config: Config, noteFailure: NoteFailure) => [
  run(
    () => adminSide(config),
    (error) => keyCheck(error, 'auth_secret_key'),
    noteFailure,
  ),
  run(
    () => signingKeys(config),
    (error) => (error instanceof AuthSettingError ? error.check : 'auth'),
    noteFailure,
  ),
];

/** Auth unreachable fails every check the same way: name it once. */
const named = (failed: readonly (AuthCheck | undefined)[]): AuthCheck[] => [
  ...new Set(failed.filter((check) => check !== undefined)),
];

/** Every check, asked now: the checks that failed, each failure noted with its cause. */
export async function authChecks(config: Config, noteFailure: NoteFailure): Promise<AuthCheck[]> {
  const [live, ...settings] = await Promise.all([
    liveCheck(config, noteFailure),
    ...settingChecks(config, noteFailure),
  ]);
  return named([...live, ...settings]);
}

/**
 * How long a pass of the setting checks stands on one function instance. What it can hide: a
 * secret key revoked or rotated in the dashboard (Forget me fails), or the signing keys switched
 * back to the legacy secret (new players' tokens can't be verified), for at most this long per warm
 * instance after the change. Auth down, the publishable key or anonymous sign-ins are never hidden.
 */
export const SETTINGS_PASS_MS = 5 * 60_000;

/**
 * The health route's checks: the live one every time, the setting checks only when their last
 * pass on this instance is older than SETTINGS_PASS_MS (`now` is this instance's own clock, only
 * ever compared with itself).
 */
export function createAuthHealth(now: () => number = Date.now) {
  let passedAt: number | undefined;
  return async (config: Config, noteFailure: NoteFailure): Promise<AuthCheck[]> => {
    const fresh = passedAt !== undefined && now() - passedAt < SETTINGS_PASS_MS;
    const [live, ...settings] = await Promise.all([
      liveCheck(config, noteFailure),
      ...(fresh ? [] : settingChecks(config, noteFailure)),
    ]);
    if (!fresh) passedAt = settings.every((check) => check === undefined) ? now() : undefined;
    return named([...live, ...settings]);
  };
}
