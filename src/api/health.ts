// GET /api/v1/health (ADR 0052): 200 when every check passes, 503 naming the checks that failed.
// Why one failed is never in the answer, only in the function's log line. Sign-in's own settings
// (ADR 0079) are reported apart, in `accounts`, and never answer 503: a sign-in setting must not
// make the game look down to an uptime monitor, or hold up the vs Friend switch or Publish.

/**
 * A check, named after what to fix: `auth` is Supabase Auth itself (unreachable or failing);
 * `auth_publishable_key` and `auth_secret_key` are keys Auth refused; `auth_anonymous_sign_ins`
 * is that setting being off (no guest can be made); `auth_signing_keys` is no asymmetric JWT
 * signing key to verify sessions with.
 */
export type HealthCheck =
  | 'database'
  | 'ruleset'
  | 'auth'
  | 'auth_publishable_key'
  | 'auth_secret_key'
  | 'auth_anonymous_sign_ins'
  | 'auth_signing_keys';

/** A sign-in setting that is wrong (ADR 0079), named after what to fix. */
export type AccountsCheck =
  /** Auth's "Confirm email" off: a guest's email change would need no code. Fix it at once. */
  | 'auth_email_confirmations'
  /** Google sign-in set up here, and Auth's Google provider off. */
  | 'auth_google';

export interface HealthResponse {
  readonly status: 'ok' | 'down';
  readonly database: 'ok' | 'down';
  readonly auth: 'ok' | 'down';
  /** The ruleset new series use, as loaded from its frozen bundle; null when it didn't load. */
  readonly ruleset: number | null;
  readonly failed: readonly HealthCheck[];
  /**
   * Everyone's email codes today and this month (ADR 0079): `near` at 70 a day or 2,200 a month,
   * `full` at the caps, `off` when switched off. Never changes the status: an uptime monitor's
   * keyword check reads it.
   */
  readonly emailCodes: EmailCodes;
  /**
   * Sign-in's settings (ADR 0079): `off` where accounts are switched off, `misconfigured` naming
   * the settings in `accountsFailed`. Never changes the status: a keyword monitor reads it.
   */
  readonly accounts: 'ok' | 'misconfigured' | 'off';
  readonly accountsFailed: readonly AccountsCheck[];
}

export type EmailCodes = 'ok' | 'near' | 'full' | 'off';
