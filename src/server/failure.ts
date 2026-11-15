// What went wrong, for the log line (ADR 0052, "Logging"): the stage that failed and the error's
// kind, e.g. "database: 28P01 password authentication failed" or "config: SEED_KEYS is not JSON",
// so a failure is diagnosable from the logs alone. Built only from allow-listed codes and our own
// messages, never from an error's message: a driver's or the network's message can hold a host, a
// user name or a connection string, and a URL can hold a password. A code (`28P01`,
// `ENETUNREACH`) can't hold a secret.
import { errors } from 'jose';
import postgres from 'postgres';
import { AuthError } from './auth.ts';
import { ConfigError } from './config.ts';
import { ApiError } from './http-error.ts';

/** Where a request failed. */
export type Stage = 'config' | 'database' | 'auth' | 'ruleset' | 'internal';

/** Postgres SQLSTATEs worth naming in words; any other SQLSTATE is logged as its code alone. */
const SQLSTATES: Readonly<Record<string, string>> = {
  '28P01': 'password authentication failed',
  '28000': 'invalid authorization (unknown role or not allowed to log in)',
  '3D000': 'database does not exist',
  '42501': 'permission denied',
  '42P01': 'table does not exist (migrations not applied?)',
  '3F000': 'schema does not exist (migrations not applied?)',
  '53300': 'too many connections',
  '57P01': 'server shut down the connection',
  '08006': 'connection failure',
  XX000: "internal error (with Supabase's pooler: often an unknown tenant or user)",
};

/** Network and driver codes worth naming in words. */
const CODES: Readonly<Record<string, string>> = {
  ENOTFOUND: 'host not found (DNS)',
  EAI_AGAIN: 'DNS lookup failed for now',
  ECONNREFUSED: 'connection refused',
  ECONNRESET: 'connection reset',
  ENETUNREACH: 'network unreachable (an IPv6-only host? use the pooler)',
  EHOSTUNREACH: 'host unreachable (an IPv6-only host? use the pooler)',
  ETIMEDOUT: 'connection timed out',
  CONNECT_TIMEOUT: 'connection timed out',
  CONNECTION_CLOSED: 'connection closed by the server',
  CONNECTION_DESTROYED: 'connection destroyed',
  CONNECTION_ENDED: 'connection ended',
  SASL_SIGNATURE_MISMATCH: 'server signature mismatch during authentication',
  AUTH_TYPE_NOT_IMPLEMENTED: 'authentication type not supported',
  ERR_INVALID_URL: 'DATABASE_URL is not a valid URL (a password with reserved characters?)',
  ERR_TLS_CERT_ALTNAME_INVALID: 'TLS certificate does not match the host',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'TLS certificate is self-signed',
};

const SQLSTATE = /^[0-9A-Z]{5}$/;
const SAFE_CODE = /^[A-Z][A-Z0-9_]{1,39}$/;

/** An error's code, if it has one of a safe shape. */
function codeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const { code } = error;
  return typeof code === 'string' && (SQLSTATE.test(code) || SAFE_CODE.test(code))
    ? code
    : undefined;
}

/** "28P01 password authentication failed", "ENETUNREACH network unreachable", or the code. */
function described(code: string): string {
  const words = SQLSTATES[code] ?? CODES[code];
  return words === undefined ? code : `${code} ${words}`;
}

/** Thrown by the frozen-ruleset loader: our own words, safe to log. */
export class RulesetError extends Error {
  override readonly name = 'RulesetError';
}

/** The stage and kind of `error`, safe to log; `stage` is where it was caught, when known. */
export function failureOf(error: unknown, stage?: Stage): string {
  // Our own messages: they name a setting or a ruleset, never a value.
  if (error instanceof ConfigError) return `config: ${error.message}`;
  if (error instanceof RulesetError) return `ruleset: ${error.message}`;
  if (error instanceof ApiError) {
    if (error.code === 'ruleset_missing') return 'ruleset: no frozen bundle on this server';
    return `${stage ?? 'internal'}: ${error.code}`;
  }
  if (error instanceof AuthError) {
    if (error.status !== 0) return `auth: Supabase Auth answered ${String(error.status)}`;
    const cause = codeOf(error.cause);
    return `auth: Supabase Auth unreachable${cause === undefined ? '' : ` (${described(cause)})`}`;
  }
  // Verifying a token: jose's own codes (ERR_JWKS_TIMEOUT, ERR_JWKS_NO_MATCHING_KEY, ...).
  if (error instanceof errors.JOSEError) return `auth: ${described(error.code)}`;
  // The driver's and the network's errors: their codes only.
  const code = codeOf(error) ?? codeOf((error as { cause?: unknown } | null)?.cause);
  const where =
    stage ??
    (error instanceof postgres.PostgresError || code !== undefined ? 'database' : 'internal');
  if (code !== undefined) return `${where}: ${described(code)}`;
  const name = error instanceof Error ? error.name : typeof error;
  return `${where}: ${/^[A-Za-z]{1,40}$/.test(name) ? name : 'unknown error'}`;
}
