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
  return {
    online,
    databaseUrl: required(env, 'DATABASE_URL'),
    supabaseUrl: required(env, 'SUPABASE_URL').replace(/\/+$/, ''),
    supabasePublishableKey: required(env, 'SUPABASE_PUBLISHABLE_KEY'),
    supabaseSecretKey: required(env, 'SUPABASE_SECRET_KEY'),
    seedKeys: keys,
    currentSeedKey: current,
    sentryDsn: dsn === undefined || dsn === '' ? undefined : dsn,
  };
}
