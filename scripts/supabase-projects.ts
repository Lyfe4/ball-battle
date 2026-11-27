// The hosted Supabase projects (ADR 0068) and the Supabase CLI calls the workflows make on them.
// Project refs aren't secret: they are in every API URL. The CLI signs in with
// SUPABASE_ACCESS_TOKEN in GitHub Actions (the `supabase` environment, `main` only) and with your own
// `supabase login` locally; it never needs a database password.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

export const PROJECTS = {
  staging: 'fcmzgitzaaabcmbzxxcg',
  production: 'wtqmptuhonbtjwxjwtwl',
} as const;

/** The project named `name`, or undefined for anything else (an argument from outside). */
export function projectRefOf(name: string | undefined): string | undefined {
  return name === 'staging' || name === 'production' ? PROJECTS[name] : undefined;
}

/**
 * Runs the Supabase CLI and returns its standard output. `--agent no` keeps its output plain JSON
 * wherever it runs (an AI agent's shell gets wrapped output otherwise). Its standard error, which
 * says which project it is talking to, goes to ours. Never pass a secret as an argument here: a
 * failed command's arguments can end up in an error message.
 */
export function supabase(args: readonly string[]): string {
  // The CLI is a Node script: run it with this Node, with no shell to split the SQL into words.
  return execFileSync(process.execPath, [CLI, ...args, '--agent', 'no'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    maxBuffer: 16 * 1024 * 1024,
  });
}

const CLI = createRequire(import.meta.url).resolve('supabase/dist/supabase.js');

/** The project's secret API key (sb_secret_…): Auth's admin calls and forwarded sign-ups need it. */
export function secretKeyOf(ref: string): string {
  let listed: string;
  try {
    listed = supabase(['projects', 'api-keys', `--remote=${ref}`, '--reveal', '-o', 'json']);
  } catch {
    // Supabase answers 403 when the token lacks a scope: say which, so it can be added.
    throw new Error(
      `Reading ${ref}'s secret API key was refused: the token needs API gateway keys read, API ` +
        'gateway keys secret read and projects read (supabase projects api-keys --help)',
    );
  }
  const keys = JSON.parse(listed) as readonly {
    readonly type?: string;
    readonly api_key?: string;
  }[];
  const key = keys.find((entry) => entry.type === 'secret')?.api_key;
  // Masked when the token may list keys but not read secrets: Auth would refuse it.
  if (key === undefined || !key.startsWith('sb_secret_') || key.includes('·')) {
    throw new Error(
      `No readable secret API key for ${ref}: the token needs "API key secrets read"`,
    );
  }
  return key;
}

/** A row as the CLI prints it: column name to value. */
export type Row = Readonly<Record<string, unknown>>;

/** Rows of a read-only query on the project's database. */
export function readQuery(ref: string, sql: string): readonly Row[] {
  return JSON.parse(
    supabase(['db', 'query', `--remote=${ref}`, '--read-only', '--output-format', 'json', sql]),
  ) as readonly Row[];
}

/**
 * Rows of a query that writes to the project's database: only the daily check's one-minute sign-up
 * ticket (ADR 0082). Never a migration: those go through the workflows (ADR 0068).
 */
export function writeQuery(ref: string, sql: string): readonly Row[] {
  return JSON.parse(
    supabase(['db', 'query', `--remote=${ref}`, '--yes', '--output-format', 'json', sql]),
  ) as readonly Row[];
}

/** One column of a row as text, or undefined when it is null or missing. */
export function textOf(row: Row | undefined, column: string): string | undefined {
  const value = row?.[column];
  if (typeof value === 'string') return value;
  return typeof value === 'number' || typeof value === 'boolean' ? String(value) : undefined;
}
