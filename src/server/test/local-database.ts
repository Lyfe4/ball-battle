// The API's connection to the local Supabase, the way Netlify connects to staging and production:
// as `game_api_v2` through the pooler (Supavisor) in transaction mode, never straight to Postgres.
// The pooler behaves differently: two queries sent at once on one connection hang there forever
// while Postgres answers both, and only a test through the pooler shows it. `supabase/config.toml`
// switches the local pooler on; its tenant is the CLI's `pooler-dev`.

/** The local pooler's port (`[db.pooler] port` in supabase/config.toml). */
const POOLER_PORT = '54329';

/** `DB_URL` from `supabase status`, as the API's role through the local pooler. */
export function apiDatabaseUrl(dbUrl: string): string {
  const url = new URL(dbUrl);
  url.username = 'game_api_v2.pooler-dev';
  // Set by supabase/seed.sql; the local stack's own, never a real secret.
  url.password = 'game_api_local';
  url.port = POOLER_PORT;
  return url.href;
}
