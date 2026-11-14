// `node scripts/local-env.ts`: prints a .env for `netlify dev` against the local Supabase (ADR
// 0052, "Environments"), from `supabase status` and a fresh dev seed key. CI writes it before the
// online flow; locally, `node scripts/local-env.ts > .env` replaces filling in .env.example by
// hand. Never a staging or production secret: everything here is the local stack's own.
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const out = execSync('pnpm exec supabase status -o json', {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
});
const status = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)) as Record<
  string,
  string
>;
const db = new URL(status['DB_URL'] ?? '');
db.username = 'game_api';
db.password = 'game_api_local';

const lines = [
  'BALLBATTLE_ONLINE=1',
  `DATABASE_URL=${db.href}`,
  `SUPABASE_URL=${status['API_URL'] ?? ''}`,
  `SUPABASE_PUBLISHABLE_KEY=${status['PUBLISHABLE_KEY'] ?? ''}`,
  `SUPABASE_SECRET_KEY=${status['SECRET_KEY'] ?? ''}`,
  `SEED_KEYS=${JSON.stringify({ dev: randomBytes(32).toString('base64') })}`,
];
console.log(lines.join('\n'));
