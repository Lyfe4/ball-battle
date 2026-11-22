// `node scripts/local-env.ts`: prints a .env for `netlify dev` against the local Supabase (ADR
// 0052, "Environments"), from `supabase status` and a fresh dev seed key. CI writes it before the
// online flow; locally, `node scripts/local-env.ts > .env` replaces filling in .env.example by
// hand. Never a staging or production secret: everything here is the local stack's own.
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { apiDatabaseUrl } from '../src/server/test/local-database.ts';

const out = execSync('pnpm exec supabase status -o json', {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
});
const status = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)) as Record<
  string,
  string
>;

const lines = [
  'BALLBATTLE_ONLINE=1',
  // Accounts (ADR 0079), as on previews; Google needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
  // added by hand (a local test client), and email codes land in the mail catcher.
  'BALLBATTLE_ACCOUNTS=1',
  `DATABASE_URL=${apiDatabaseUrl(status['DB_URL'] ?? '')}`,
  `SUPABASE_URL=${status['API_URL'] ?? ''}`,
  `SUPABASE_PUBLISHABLE_KEY=${status['PUBLISHABLE_KEY'] ?? ''}`,
  `SUPABASE_SECRET_KEY=${status['SECRET_KEY'] ?? ''}`,
  `SEED_KEYS=${JSON.stringify({ dev: randomBytes(32).toString('base64') })}`,
];
console.log(lines.join('\n'));
