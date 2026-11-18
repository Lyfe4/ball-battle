// Applies supabase/migrations to a hosted project and checks it then holds exactly those (ADR 0068):
//   node scripts/migrate.ts staging|production
// Run by the Publish workflow for production before `release` moves, and by Migrate staging. Any
// failure exits 1 and nothing after it runs: Publish then refuses to publish.
//
// Migrations are expand only (CLAUDE.md), so the deploy still live keeps working on the new schema.
// `supabase db push` refuses a project holding a migration this checkout lacks (edited or applied
// from another branch), and the check below catches anything else that differs.
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { projectRefOf, readQuery, supabase, textOf } from './supabase-projects.ts';

const MIGRATIONS = new URL('../supabase/migrations/', import.meta.url);

/** The versions in this checkout: each file's leading timestamp, in order. */
export function localVersions(files: readonly string[]): string[] {
  return files
    .filter((file) => file.endsWith('.sql'))
    .map((file) => /^(\d{14})_[a-z0-9_]+\.sql$/.exec(file)?.[1] ?? `unnamed: ${file}`)
    .sort();
}

/** What differs between this checkout's migrations and a project's; empty when they match. */
export function migrationGap(local: readonly string[], remote: readonly string[]): string[] {
  return [
    ...local.filter((v) => !remote.includes(v)).map((v) => `${v} is not applied`),
    ...remote
      .filter((v) => !local.includes(v))
      .map((v) => `${v} is applied but not in this checkout`),
  ];
}

function migrate(name: string): void {
  const ref = projectRefOf(name);
  if (ref === undefined) throw new Error('Name the project: staging or production');
  const local = localVersions(readdirSync(MIGRATIONS));
  const unnamed = local.filter((version) => version.startsWith('unnamed'));
  if (unnamed.length > 0)
    throw new Error(`Migration files not named <timestamp>_<name>.sql: ${unnamed.join(', ')}`);

  // --skip-vault: config.toml's vault is local development's.
  supabase(['db', 'push', `--remote=${ref}`, '--yes', '--skip-vault', '--output-format', 'json']);

  const remote = readQuery(
    ref,
    'select version from supabase_migrations.schema_migrations order by version',
  ).map((row) => textOf(row, 'version') ?? '');
  const gap = migrationGap(local, remote);
  if (gap.length > 0) throw new Error(`${name} does not match this checkout: ${gap.join('; ')}`);
  console.log(
    `${name} holds every migration (${String(local.length)}), the latest ${String(local.at(-1))}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    migrate(process.argv[2] ?? '');
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
