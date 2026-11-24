// The Realtime poke's instant switch (ADR 0082): `game.flags`' `poke` row, which GET /me/poke and
// every trigger's `game.poke()` read, so it takes effect at once with no deploy (a Netlify variable
// would need a production deploy, 15 credits).
//
//   node scripts/poke-switch.ts status|on|off local|staging|production
//
// `local` is `supabase start`'s database; staging and production go through the Supabase CLI's
// Management API SQL endpoint, signed in with your own `supabase login` (or SUPABASE_ACCESS_TOKEN,
// the daily check's token). Turning production on also needs `--production`: pokes reach production
// only when the owner says, after the Auth hooks are on there (ADR 0082, decision 2). Off is never
// refused. The functions' own switch (`BALLBATTLE_POKE`) must be on too for a page to listen; the
// emergency stop for every open socket is revoking the browser key (`SUPABASE_BROWSER_KEY`).
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { projectRefOf, readQuery, textOf, writeQuery, type Row } from './supabase-projects.ts';

export type Action = 'status' | 'on' | 'off';
export type Target = 'local' | 'staging' | 'production';

export interface Command {
  readonly action: Action;
  readonly target: Target;
}

/** The local stack's database as its superuser (`supabase start`'s fixed local password). */
export const LOCAL_DATABASE = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/** The command in `args` (after the script's name), or why it can't be one. */
export function commandOf(args: readonly string[]): Command | string {
  const [action, target, ...rest] = args;
  if (action !== 'status' && action !== 'on' && action !== 'off') {
    return 'Say status, on or off, then local, staging or production';
  }
  if (target !== 'local' && target !== 'staging' && target !== 'production') {
    return 'Name the database: local, staging or production';
  }
  const extra = rest.filter((arg) => arg !== '--production');
  if (extra.length > 0) return `Unknown argument: ${extra.join(' ')}`;
  if (action === 'on' && target === 'production' && !rest.includes('--production')) {
    return 'Switching pokes on in production needs --production too (ADR 0082: only when the owner says, with the Auth hooks on)';
  }
  return { action, target };
}

/** The one statement each action runs: constants only, nothing from outside. */
export function statementOf(action: Action): string {
  if (action === 'status') {
    return `select enabled, changed_at from game.flags where name = 'poke'`;
  }
  return (
    `update game.flags set enabled = ${action === 'on' ? 'true' : 'false'}, changed_at = now() ` +
    `where name = 'poke' returning enabled, changed_at`
  );
}

/** What the switch says after its statement: on, off, or why it can't tell. */
export function verdictOf(rows: readonly Row[]): string {
  const [row] = rows;
  const enabled = textOf(row, 'enabled');
  if (enabled === undefined) {
    return 'No poke flag: is the migration 20261124120000_poke.sql applied here?';
  }
  const since = textOf(row, 'changed_at') ?? 'an unknown time';
  return `Pokes are ${enabled === 'true' ? 'on' : 'off'} (since ${since})`;
}

async function localRows(statement: string): Promise<readonly Row[]> {
  const sql = postgres(LOCAL_DATABASE, { max: 1, onnotice: () => undefined });
  try {
    const rows = await sql.unsafe(statement);
    return rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          value instanceof Date ? value.toISOString() : value,
        ]),
      ),
    );
  } finally {
    await sql.end();
  }
}

async function run(command: Command): Promise<string> {
  const statement = statementOf(command.action);
  if (command.target === 'local') return verdictOf(await localRows(statement));
  const ref = projectRefOf(command.target);
  if (ref === undefined) throw new Error('unreachable');
  const rows = command.action === 'status' ? readQuery(ref, statement) : writeQuery(ref, statement);
  return verdictOf(rows);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = commandOf(process.argv.slice(2));
  if (typeof command === 'string') {
    console.error(command);
    process.exitCode = 1;
  } else {
    try {
      console.log(`${command.target}: ${await run(command)}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
