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
  'presence',
  'rematches',
  'friendships',
  'starts',
  'auth_tickets',
  'mail_relay',
  'flags',
  'mail_sends',
  'name_reports',
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

  it('logs the API in as game_api_v2, which holds nothing of its own but game_api', async () => {
    const [who] = await deps.sql<{ user: string; member: boolean; bypass: boolean }[]>`
      select current_user as user, pg_has_role(current_user, 'game_api', 'usage') as member,
        (select rolbypassrls from pg_roles where rolname = current_user) as bypass`;
    expect(who).toStrictEqual({ user: 'game_api_v2', member: true, bypass: true });
    const own = await admin<{ n: number }[]>`
      select count(*)::int as n from information_schema.role_table_grants
      where grantee = 'game_api_v2'`;
    expect(own[0]?.n).toBe(0);
  });

  it('ends any query of the API role after 8 seconds, through the pooler', async () => {
    const [setting] = await deps.sql<{ statement_timeout: string }[]>`show statement_timeout`;
    expect(setting?.statement_timeout).toBe('8s');
  });

  it('lets the API role use the game tables but not read auth', async () => {
    await expect(deps.sql`select count(*) from game.series`).resolves.toHaveLength(1);
    await expect(deps.sql`select count(*) from auth.users`).rejects.toThrow(/permission denied/);
    await expect(deps.sql`delete from game.series`).rejects.toThrow(/permission denied/);
  });
});
