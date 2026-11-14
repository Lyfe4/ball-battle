// The browser never queries the database (ADR 0052, section 5): Supabase's `anon` and
// `authenticated` roles can read nothing in `game`, through SQL or the Data API, and the API's own
// role can't read Supabase's `auth` schema.
import { afterAll, describe, expect, it } from 'vitest';
import { adminSql, testDeps } from './test/support.ts';

const admin = adminSql();
const deps = testDeps();
afterAll(async () => {
  await admin.end();
  await deps.sql.end();
});

const TABLES = [
  'profiles',
  'series',
  'series_seeds',
  'picks',
  'rounds',
  'challenges',
  'rate_limits',
];

describe('the game schema', () => {
  it.each(['anon', 'authenticated'])('is closed to the %s role', async (role) => {
    for (const table of TABLES) {
      const read = admin.begin(async (sql) => {
        await sql.unsafe(`set local role ${role}`);
        return sql.unsafe(`select * from game.${table} limit 1`);
      });
      await expect(read, table).rejects.toThrow(/permission denied for schema game/);
    }
  });

  it('is not served by the Data API', async () => {
    const url = process.env['TEST_SUPABASE_URL'] ?? '';
    const key = process.env['TEST_SUPABASE_PUBLISHABLE_KEY'] ?? '';
    const response = await fetch(`${url}/rest/v1/series?select=*`, {
      headers: { apikey: key, 'Accept-Profile': 'game' },
    });
    expect(response.status).toBe(406);
  });

  it('keeps RLS on every table', async () => {
    const rows = await admin<{ relname: string; relrowsecurity: boolean }[]>`
      select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'game' and c.relkind = 'r' order by relname`;
    expect(rows.map((row) => row.relname).sort()).toStrictEqual([...TABLES].sort());
    expect(rows.every((row) => row.relrowsecurity)).toBe(true);
  });

  it('lets the API role use the game tables but not read auth', async () => {
    await expect(deps.sql`select count(*) from game.series`).resolves.toHaveLength(1);
    await expect(deps.sql`select count(*) from auth.users`).rejects.toThrow(/permission denied/);
    await expect(deps.sql`delete from game.series`).rejects.toThrow(/permission denied/);
  });
});
