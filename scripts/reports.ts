// Reported usernames (ADR 0079 addendum of 2026-11-25), for the owner to review. Read-only:
//
//   node scripts/reports.ts local|staging|production [--days <n>]
//
// One line per reported player, most reported first: how many players reported them, the names
// reported and the reasons, the name they have now, and their id (to clear a name in the SQL
// Editor: `update game.profiles set username = null where user_id = '<id>';`, ADR 0079). Reporters
// are only counted, never named. Staging and production go through the Supabase CLI's read-only SQL
// endpoint, signed in with your own `supabase login`; `local` is `supabase start`'s database.
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { LOCAL_DATABASE } from './poke-switch.ts';
import { projectRefOf, readQuery, type Row } from './supabase-projects.ts';

/** The report's query: one row per reported player in the last `days`. */
export function reportsQuery(days: number): string {
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('days: 1 to 90');
  return `
    select r.reported::text as id,
      coalesce(p.username, p.display_name) as now,
      count(distinct r.reporter)::int as reporters,
      string_agg(distinct r.name, ', ') as names,
      string_agg(distinct r.reason, ', ') as reasons,
      max(r.created_at)::text as latest
    from game.name_reports r
    join game.profiles p on p.user_id = r.reported
    where r.created_at > now() - interval '${String(days)} days'
    group by r.reported, p.username, p.display_name
    order by reporters desc, latest desc`;
}

/** The lines printed for `rows`. */
export function reportLines(rows: readonly Row[], days: number): string[] {
  if (rows.length === 0) return [`No names reported in the last ${String(days)} days.`];
  return [
    `${String(rows.length)} reported in the last ${String(days)} days, most reported first:`,
    ...rows.map((row) => {
      const reporters = Number(row['reporters']);
      const by = `${String(reporters)} ${reporters === 1 ? 'player' : 'players'}`;
      return `- ${String(row['names'])} (${String(row['reasons'])}) by ${by}; now "${String(row['now'])}", last ${String(row['latest']).slice(0, 16)}, id ${String(row['id'])}`;
    }),
  ];
}

/** The target and days in `args`, or why not. */
export function argsOf(args: readonly string[]): { target: string; days: number } | string {
  const [target, flag, value] = args;
  if (target === undefined || !['local', 'staging', 'production'].includes(target)) {
    return 'Say local, staging or production';
  }
  if (flag === undefined) return { target, days: 30 };
  const days = Number(value);
  if (flag !== '--days' || !Number.isInteger(days) || days < 1 || days > 90) {
    return '--days takes 1 to 90';
  }
  return { target, days };
}

async function main(): Promise<void> {
  const parsed = argsOf(process.argv.slice(2));
  if (typeof parsed === 'string') {
    console.error(`${parsed}\n  node scripts/reports.ts local|staging|production [--days <n>]`);
    process.exit(2);
  }
  const query = reportsQuery(parsed.days);
  let rows: readonly Row[];
  if (parsed.target === 'local') {
    const sql = postgres(LOCAL_DATABASE, { max: 1, onnotice: () => undefined });
    try {
      rows = await sql.begin('read only', (tx) => tx.unsafe<Row[]>(query));
    } finally {
      await sql.end();
    }
  } else {
    const ref = projectRefOf(parsed.target);
    if (ref === undefined) throw new Error('unreachable');
    rows = readQuery(ref, query);
  }
  for (const line of reportLines(rows, parsed.days)) console.log(line);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
