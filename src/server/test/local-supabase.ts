// Vitest's global setup for the database tests (`pnpm test:db`, ADR 0052 "Tests and CI"): reads the
// local Supabase's addresses and keys from `supabase status` once, for every test file. Needs
// `pnpm exec supabase start` first (Docker); CI's integration job starts it.
import { execSync } from 'node:child_process';
import { apiDatabaseUrl } from './local-database.ts';

interface Status {
  readonly DB_URL: string;
  readonly API_URL: string;
  readonly PUBLISHABLE_KEY: string;
  readonly SECRET_KEY: string;
}

export default function setup(): void {
  let status: Status;
  try {
    const out = execSync('pnpm exec supabase status -o json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    status = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)) as Status;
  } catch {
    throw new Error('The local Supabase is not running: pnpm exec supabase start (needs Docker)');
  }
  process.env['TEST_ADMIN_DATABASE_URL'] = status.DB_URL;
  // The API's own role through the pooler, as on Netlify.
  process.env['TEST_DATABASE_URL'] = apiDatabaseUrl(status.DB_URL);
  process.env['TEST_SUPABASE_URL'] = status.API_URL;
  process.env['TEST_SUPABASE_PUBLISHABLE_KEY'] = status.PUBLISHABLE_KEY;
  process.env['TEST_SUPABASE_SECRET_KEY'] = status.SECRET_KEY;
}
