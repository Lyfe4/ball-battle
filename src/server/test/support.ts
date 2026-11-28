// What the database tests share: the API's dependencies against the local Supabase, and a
// superuser connection for setting up and inspecting rows the API itself may not touch.
import { configOf } from '../config.ts';
import { databaseFor, type Sql } from '../db.ts';
import type { Deps } from '../http.ts';

const need = (name: string): string => {
  const value = process.env[name];
  if (value === undefined) throw new Error(`${name} is not set: run the db test project`);
  return value;
};

/** A fixed test seed key: the same key always derives the same seeds. */
export const TEST_SEED_KEYS = JSON.stringify({ test: Buffer.alloc(32, 7).toString('base64') });

/** Google's test client: never a real one (its calls are mocked, `google-support.ts`). */
export const TEST_GOOGLE = { clientId: 'test-client.apps.googleusercontent.com', secret: 'shh' };

/** The API's dependencies, with any extra settings (`BALLBATTLE_POKE`, ADR 0082) on top. */
export function testDeps(extra: Readonly<Record<string, string>> = {}): Deps {
  const config = configOf({
    BALLBATTLE_ONLINE: '1',
    BALLBATTLE_ACCOUNTS: '1',
    GOOGLE_CLIENT_ID: TEST_GOOGLE.clientId,
    GOOGLE_CLIENT_SECRET: TEST_GOOGLE.secret,
    DATABASE_URL: need('TEST_DATABASE_URL'),
    SUPABASE_URL: need('TEST_SUPABASE_URL'),
    SUPABASE_PUBLISHABLE_KEY: need('TEST_SUPABASE_PUBLISHABLE_KEY'),
    SUPABASE_SECRET_KEY: need('TEST_SUPABASE_SECRET_KEY'),
    SEED_KEYS: TEST_SEED_KEYS,
    ...extra,
  });
  if (config === undefined) throw new Error('unreachable');
  // Every read counted exactly (read-count.ts samples one in ten): read-count.db.test.ts checks both.
  return { config, sql: databaseFor(config.databaseUrl), codeFloorMs: 0, readWeight: () => 1 };
}

/** The local database's superuser: for test setup and for checking what other roles can do. */
export const adminSql = (): Sql => databaseFor(need('TEST_ADMIN_DATABASE_URL'));
