// The server's configuration, read once from the environment (ADR 0052, "Secrets and least
// privilege"). Pure: `configOf` takes the environment as a plain record, so every rule here is
// tested without touching process.env. Nothing in it is ever logged or sent to a client.

/** One seed key (K in ADR 0051): its id in the key map and its raw bytes. */
export interface SeedKeyEntry {
  readonly id: string;
  readonly raw: Uint8Array<ArrayBuffer>;
}

/**
 * The server's settings. A deploy without them (a production deploy that never had its secrets)
 * has none: `configOf` is undefined and every route answers 404 `online_off`.
 */
export interface Config {
  /**
   * Whether online play is switched on (`BALLBATTLE_ONLINE`, the vs Friend switch, ADR 0068).
   * Off, only deleting players still runs: Forget me and the sweep's 90-day cleanup (ADR 0078).
   */
  readonly online: boolean;
  /**
   * Whether accounts are switched on (`BALLBATTLE_ACCOUNTS`, ADR 0079): sign-in with Google or an
   * email code. Only with online play on; off, every `/api/v1/auth/*` route answers `accounts_off`.
   */
  readonly accounts: boolean;
  /**
   * Whether play by turns may be sent to a friend (`BALLBATTLE_TURNS`, ADR 0085): the two-phone
   * playtest ADR 0083 asks for, on previews and staging only. Off, a challenge to a friend is live.
   */
  readonly turns: boolean;
  /** Whether email codes are sent (`BALLBATTLE_EMAIL_CODES=off` stops them; Google goes on). */
  readonly emailCodes: boolean;
  /** Google's OAuth client, where Google sign-in is offered (its redirect URIs are exact). */
  readonly google: GoogleClient | undefined;
  /** Postgres as the `game_api` role, through Supabase's pooler in transaction mode. */
  readonly databaseUrl: string;
  /** The Supabase project's URL, for Auth (guest sign-in, refresh, JWKS). */
  readonly supabaseUrl: string;
  /** The project's publishable (anon) key: Auth's public endpoints need it. */
  readonly supabasePublishableKey: string;
  /** The secret (service role) key: deleting a user, only (`auth-admin.ts`). */
  readonly supabaseSecretKey: string;
  /** Every seed key by id. New series use `currentSeedKey`; old series keep theirs. */
  readonly seedKeys: ReadonlyMap<string, Uint8Array<ArrayBuffer>>;
  readonly currentSeedKey: SeedKeyEntry;
  /** Sentry's DSN, when errors are reported (PII off). */
  readonly sentryDsn: string | undefined;
  /**
   * Whether pages' own errors are taken (POST /client-error, launch eve): `BALLBATTLE_ERROR_REPORTS=1`
   * with online play on and `SENTRY_DSN` set. Off, the route answers 404 and sends nothing.
   */
  readonly errorReports: boolean;
  /**
   * The Realtime poke's browser key (ADR 0082): `SUPABASE_BROWSER_KEY`, a publishable key of its
   * own, handed to a player's page by GET /me/poke while `BALLBATTLE_POKE=1` (only with online play
   * on); undefined means pokes are off. Never the functions' own publishable key: this one can be
   * revoked alone, which closes every socket.
   */
  readonly pokeKey: string | undefined;
}

/** A Google OAuth client (ADR 0079): never sent to a page but its id, in the redirect. */
export interface GoogleClient {
  readonly clientId: string;
  readonly clientSecret: string;
}

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

const SEED_KEY_BYTES = 32;
/** A key id: short, plain, sortable (a date such as `2026-11` is the convention). */
const KEY_ID = /^[A-Za-z0-9._-]{1,32}$/;

function required(env: Readonly<Record<string, string | undefined>>, name: string): string {
  const value = env[name]?.trim();
  if (value === undefined || value === '') throw new ConfigError(`${name} is not set`);
  return value;
}

/**
 * `SEED_KEYS`: a JSON object of key id to key, each key base64 of at least 32 bytes. The newest
 * id (greatest in plain string order, so date ids sort by date) seeds new series; a rotation adds
 * a newer key and keeps the old ones for the series that use them.
 */
export function parseSeedKeys(json: string): {
  readonly keys: ReadonlyMap<string, Uint8Array<ArrayBuffer>>;
  readonly current: SeedKeyEntry;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ConfigError('SEED_KEYS is not JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ConfigError('SEED_KEYS is not a JSON object of key id to key');
  }
  const keys = new Map<string, Uint8Array<ArrayBuffer>>();
  for (const [id, value] of Object.entries(parsed)) {
    if (!KEY_ID.test(id)) throw new ConfigError(`SEED_KEYS has a key id that is not plain: ${id}`);
    if (typeof value !== 'string') throw new ConfigError(`SEED_KEYS[${id}] is not a string`);
    const raw = Uint8Array.from(Buffer.from(value, 'base64'));
    if (raw.length < SEED_KEY_BYTES) {
      throw new ConfigError(`SEED_KEYS[${id}] is shorter than ${String(SEED_KEY_BYTES)} bytes`);
    }
    keys.set(id, raw);
  }
  const id = [...keys.keys()].sort().at(-1);
  const raw = id === undefined ? undefined : keys.get(id);
  if (id === undefined || raw === undefined) throw new ConfigError('SEED_KEYS has no key');
  return { keys, current: { id, raw } };
}

/**
 * The configuration in `env`. With online play on, a missing or malformed setting throws a
 * ConfigError naming it (never its value). With it off, the settings are read if they are all
 * there, so deleting players never waits on the switch (ADR 0078); a deploy without them (one that
 * never had its secrets) has no configuration, and answers `online_off` as before.
 */
export function configOf(env: Readonly<Record<string, string | undefined>>): Config | undefined {
  if (env['BALLBATTLE_ONLINE'] === '1') return settingsOf(env, true);
  try {
    return settingsOf(env, false);
  } catch (error) {
    if (error instanceof ConfigError) return undefined;
    throw error;
  }
}

function settingsOf(env: Readonly<Record<string, string | undefined>>, online: boolean): Config {
  const { keys, current } = parseSeedKeys(required(env, 'SEED_KEYS'));
  const dsn = env['SENTRY_DSN']?.trim();
  const googleId = env['GOOGLE_CLIENT_ID']?.trim() ?? '';
  const googleSecret = env['GOOGLE_CLIENT_SECRET']?.trim() ?? '';
  if ((googleId === '') !== (googleSecret === '')) {
    throw new ConfigError(
      'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set together or not at all',
    );
  }
  return {
    online,
    accounts: online && env['BALLBATTLE_ACCOUNTS'] === '1',
    turns: online && env['BALLBATTLE_TURNS'] === '1',
    emailCodes: env['BALLBATTLE_EMAIL_CODES']?.trim().toLowerCase() !== 'off',
    google: googleId === '' ? undefined : { clientId: googleId, clientSecret: googleSecret },
    databaseUrl: required(env, 'DATABASE_URL'),
    supabaseUrl: required(env, 'SUPABASE_URL').replace(/\/+$/, ''),
    supabasePublishableKey: required(env, 'SUPABASE_PUBLISHABLE_KEY'),
    supabaseSecretKey: required(env, 'SUPABASE_SECRET_KEY'),
    seedKeys: keys,
    currentSeedKey: current,
    sentryDsn: dsn === undefined || dsn === '' ? undefined : dsn,
    errorReports:
      online && env['BALLBATTLE_ERROR_REPORTS'] === '1' && dsn !== undefined && dsn !== '',
    pokeKey:
      online && env['BALLBATTLE_POKE'] === '1' ? required(env, 'SUPABASE_BROWSER_KEY') : undefined,
  };
}
