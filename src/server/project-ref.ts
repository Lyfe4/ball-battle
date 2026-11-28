// Which Supabase project the functions' database connection belongs to, and whether it is the
// project SUPABASE_URL names (2026-11-29, launch eve): DATABASE_URL is masked in Netlify, so a
// production deploy that connects to staging's database would otherwise go unseen. Read from the
// connection string the functions connect with, never from the database: Supabase's pooler picks
// its tenant by the user's `.<ref>` suffix, and the direct host is `db.<ref>.supabase.co`. Only
// whether the two agree leaves this file; never a ref, a user or any part of either URL.

/** A hosted project's ref: 20 lowercase letters (`fcmzgitzaaabcmbzxxcg`). */
const REF = /^[a-z]{20}$/;

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

/** The local stack (`supabase start`, `netlify dev`): one project, on this machine. */
const LOCAL = 'local';

function parse(raw: string): URL | undefined {
  try {
    return new URL(raw);
  } catch {
    return undefined;
  }
}

/** The project of SUPABASE_URL (`https://<ref>.supabase.co`), `local`, or undefined. */
export function projectOfSupabaseUrl(raw: string): string | undefined {
  const url = parse(raw);
  if (url === undefined) return undefined;
  if (LOOPBACK.has(url.hostname)) return LOCAL;
  const [ref, ...rest] = url.hostname.split('.');
  return ref !== undefined && REF.test(ref) && rest.join('.') === 'supabase.co' ? ref : undefined;
}

/**
 * The project of DATABASE_URL: the pooler user's suffix (`game_api_v2.<ref>`), the direct host's
 * ref (`db.<ref>.supabase.co`), `local`, or undefined when it names none (or two that differ).
 */
export function projectOfDatabaseUrl(raw: string): string | undefined {
  const url = parse(raw);
  if (url === undefined) return undefined;
  if (LOOPBACK.has(url.hostname)) return LOCAL;
  const user = decodeURIComponent(url.username);
  const dot = user.lastIndexOf('.');
  const fromUser = dot >= 0 && REF.test(user.slice(dot + 1)) ? user.slice(dot + 1) : undefined;
  const [db, ref, ...rest] = url.hostname.split('.');
  const fromHost =
    db === 'db' && ref !== undefined && REF.test(ref) && rest.join('.') === 'supabase.co'
      ? ref
      : undefined;
  if (fromUser !== undefined && fromHost !== undefined && fromUser !== fromHost) return undefined;
  return fromUser ?? fromHost;
}

/** Whether the database the functions connect to is SUPABASE_URL's project. */
export function databaseMatchesUrl(databaseUrl: string, supabaseUrl: string): boolean {
  const database = projectOfDatabaseUrl(databaseUrl);
  return database !== undefined && database === projectOfSupabaseUrl(supabaseUrl);
}
