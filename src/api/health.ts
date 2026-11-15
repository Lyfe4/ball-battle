// GET /api/v1/health (ADR 0052): 200 when every check passes, 503 naming the checks that failed.
// Why one failed is never in the answer, only in the function's log line.

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

export interface HealthResponse {
  readonly status: 'ok' | 'down';
  readonly database: 'ok' | 'down';
  readonly auth: 'ok' | 'down';
  /** The ruleset new series use, as loaded from its frozen bundle; null when it didn't load. */
  readonly ruleset: number | null;
  readonly failed: readonly HealthCheck[];
}
