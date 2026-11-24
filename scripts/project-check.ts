// The daily check on a hosted Supabase project (ADR 0068), run by .github/workflows/supabase-daily.yml
// for staging and production, or by hand:
//   node scripts/project-check.ts staging|production
//
// 1. Keeps a free project awake: Supabase pauses one after 7 days without activity, and this
//    touches its database and Auth every day.
// 2. Checks IP Address Forwarding still works (ADR 0052 section 11): it signs up one guest the way
//    `signUpGuest` does, with the secret key and a made-up player IP in `Sb-Forwarded-For`, and reads
//    the IP Auth recorded on that guest's session. With forwarding on it is the made-up one; off, it
//    is this machine's, and every new player would share our functions' one allowance.
//    Once the project has ADR 0082's Auth hooks, a sign-up needs a one-minute ticket, written first
//    as `signUpGuest`'s route does; and a sign-up without one should be refused, which is said (a
//    warning, not a failure, until the hooks are switched on in the dashboard).
// 3. Deletes that guest again, whatever happened.
// 4. Counts this month's email codes (ADR 0079): past 2,200 of the 2,700 we allow ourselves under
//    Resend Free's 3,000, it fails, a slower second alarm beside /api/v1/health's `emailCodes`.
// 5. Counts the last 24 hours' code emails the Send Email hook handed to the relay (ADR 0082, the
//    mail watch), reading only: any the relay refused or never answered fails the check (the player
//    was told "We sent a code" and none came); any whose answer nobody read before pg_net dropped
//    it is a warning. Before the project has the migration it says so and checks nothing.
// 6. Reports the database's size: the free plan holds 500 MB and nothing is pruned (ADR 0083,
//    decision 8), so from 300 MB it warns (without failing) that it is time to prune or upgrade.
// Any failure exits 1, so the workflow fails and GitHub emails you.
import { fileURLToPath } from 'node:url';
import { NEAR_MONTHLY } from '../src/server/routes/health.ts';
import { EVERYONE, LIMITS } from '../src/server/rate-limit.ts';
import { newTicket } from '../src/server/auth-tickets.ts';
import { projectRefOf, readQuery, secretKeyOf, textOf, writeQuery } from './supabase-projects.ts';

/** A documentation address (RFC 5737, TEST-NET-2): never a real player's. */
export function madeUpIp(random: number): string {
  return `198.51.100.${String(1 + Math.floor(random * 254))}`;
}

/** The query for this month's email codes, everyone's (one count, no player in it). */
export const MONTHLY_CODES_SQL =
  `select coalesce(sum(count), 0)::int as sent from game.rate_limits ` +
  `where subject = '${EVERYONE}' and bucket = '${LIMITS.codesMonthly.bucket}' ` +
  `and window_start = date_trunc('month', now(), 'UTC')`;

/** What this month's email codes say; undefined while there is room. */
export function codesProblem(sent: number): string | undefined {
  if (sent < NEAR_MONTHLY) return undefined;
  return `${String(sent)} email codes this month, near the ${String(LIMITS.codesMonthly.max)} cap under Resend's 3,000: switch email codes off (BALLBATTLE_EMAIL_CODES=off) or move to a paid plan`;
}

/** The last day's code emails, as counted by the mail watch's read-only function (ADR 0082). */
export const MAIL_SQL = `select row_to_json(o)::text as outcomes from game.mail_outcomes(24) o`;

/** Whether the project has the mail watch (its migration applied). */
export const MAIL_MIGRATED_SQL = `select to_regprocedure('game.mail_outcomes(integer)') is not null as migrated`;

interface MailOutcomes {
  readonly sent: number;
  readonly failed: number;
  readonly unseen: number;
}

/** What refused code emails say; undefined when there were none. */
export function mailProblem({ sent, failed }: MailOutcomes): string | undefined {
  if (failed === 0) return undefined;
  return `${String(failed)} of ${String(sent)} code emails in the last 24 h were refused or never answered by the relay: players were told a code was sent. Look at Resend's logs and the key in Vault (select status_code, content from net._http_response order by created desc)`;
}

/** What sends nobody saw answered say (a warning); undefined when there were none. */
export function mailWarning({ sent, unseen }: MailOutcomes): string | undefined {
  if (unseen === 0) return undefined;
  return `${String(unseen)} of ${String(sent)} code emails in the last 24 h: their answer went (pg_net keeps 6 h) before the next send or /api/v1/health copied it`;
}

/** The database's size in bytes, as the free plan's 500 MB counts it. */
export const DATABASE_SIZE_SQL = `select pg_database_size(current_database())::bigint as bytes`;

/** Where the size starts to warn, of the free plan's 500 MB (ADR 0083, decision 8). */
export const SIZE_WARN_MB = 300;
export const FREE_PLAN_MB = 500;
const MB = 1024 * 1024;

/** The size line, and a warning from SIZE_WARN_MB on. */
export function sizeReport(bytes: number): { readonly line: string; readonly warning?: string } {
  const mb = Math.round(bytes / MB);
  const line = `database ${String(mb)} MB of the free plan's ${String(FREE_PLAN_MB)} MB`;
  if (mb < SIZE_WARN_MB) return { line };
  return {
    line,
    warning: `the database is ${String(mb)} MB of the free plan's ${String(FREE_PLAN_MB)} MB: prune finished series' rounds and picks (final_setup replays them) or move to Supabase Pro before it fills`,
  };
}

/** Whether the project has ADR 0082's Auth hook functions (its migration applied). */
export const HOOKS_MIGRATED_SQL = `select to_regprocedure('game.expect_auth(text,text)') is not null as migrated`;

/** What the recorded session IP says about forwarding; undefined when it works. */
export function forwardingProblem(sent: string, recorded: string | undefined): string | undefined {
  if (recorded === undefined) return 'Auth recorded no session for the guest';
  if (recorded !== sent) {
    return `Auth recorded ${recorded}, not the forwarded ${sent}: is IP Address Forwarding on (Authentication > Rate Limits)?`;
  }
  return undefined;
}

async function check(name: string): Promise<void> {
  const ref = projectRefOf(name);
  if (ref === undefined) throw new Error('Name the project: staging or production');
  const url = `https://${ref}.supabase.co`;

  const [first] = readQuery(ref, 'select 1 as ok');
  if (textOf(first, 'ok') !== '1') throw new Error('The database did not answer select 1');
  console.log(`${name}: the database answers`);

  const [size] = readQuery(ref, DATABASE_SIZE_SQL);
  const { line, warning: sizeWarning } = sizeReport(Number(textOf(size, 'bytes') ?? '0'));
  console.log(`${name}: ${line}`);
  if (sizeWarning !== undefined) console.log(`::warning::${name}: ${sizeWarning}`);

  const [codes] = readQuery(ref, MONTHLY_CODES_SQL);
  const sent = Number(textOf(codes, 'sent') ?? '0');
  const codeProblem = codesProblem(sent);
  console.log(`${name}: ${String(sent)} email codes this month`);

  const [watched] = readQuery(ref, MAIL_MIGRATED_SQL);
  const [mail] = textOf(watched, 'migrated') === 'true' ? readQuery(ref, MAIL_SQL) : [];
  const mailText = textOf(mail, 'outcomes');
  const mailOutcomes = mailText === undefined ? undefined : (JSON.parse(mailText) as MailOutcomes);
  if (mailOutcomes === undefined) {
    console.log(`${name}: no mail watch yet (its migration isn't applied)`);
  } else {
    console.log(
      `${name}: ${String(mailOutcomes.sent)} code emails in 24 h, ${String(mailOutcomes.failed)} refused, ${String(mailOutcomes.unseen)} unseen`,
    );
    const warning = mailWarning(mailOutcomes);
    if (warning !== undefined) console.log(`::warning::${name}: ${warning}`);
  }

  const secret = secretKeyOf(ref);
  const ip = madeUpIp(Math.random());
  const [hooks] = readQuery(ref, HOOKS_MIGRATED_SQL);
  const ticket = textOf(hooks, 'migrated') === 'true' ? newTicket() : undefined;
  // A base64url ticket of our own making: safe inside the quotes.
  if (ticket !== undefined) writeQuery(ref, `select game.expect_auth('signup', '${ticket}')`);
  const signUp = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: secret, 'Content-Type': 'application/json', 'Sb-Forwarded-For': ip },
    body: JSON.stringify(ticket === undefined ? {} : { data: { bb_ticket: ticket } }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await signUp.json().catch(() => ({}))) as { user?: { id?: string } };
  const id = body.user?.id;
  if (!signUp.ok || id === undefined) {
    throw new Error(`A guest sign-up answered ${String(signUp.status)} (anonymous sign-ins off?)`);
  }
  const mailFailed = mailOutcomes === undefined ? undefined : mailProblem(mailOutcomes);
  const problems: string[] = [codeProblem, mailFailed].filter(
    (problem): problem is string => problem !== undefined,
  );
  try {
    // The id is Auth's own uuid; checked anyway before it goes into SQL.
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Auth answered an id that is not a uuid');
    const [row] = readQuery(
      ref,
      `select host(ip) as ip from auth.sessions where user_id = '${id}'`,
    );
    const problem = forwardingProblem(ip, textOf(row, 'ip'));
    if (problem === undefined) {
      console.log(`${name}: Auth counts each player's own IP (forwarded ${ip} recorded)`);
    } else problems.push(problem);
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }
  // A guest left behind is a failure too.
  const deleted = await fetch(`${url}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: secret },
    signal: AbortSignal.timeout(15_000),
  });
  if (deleted.ok) console.log(`${name}: the test guest is deleted`);
  else problems.push(`Deleting the test guest ${id} answered ${String(deleted.status)}`);
  if (ticket !== undefined) await checkHooks(url, secret);
  if (problems.length > 0) throw new Error(problems.join('; '));
}

/**
 * Says whether Auth refuses a sign-up we didn't start (ADR 0082's before-user-created hook). Off,
 * the user it made is deleted again and Actions shows a warning; it fails nothing until the hooks
 * are required (before the publishable key reaches a page).
 */
async function checkHooks(url: string, secret: string): Promise<void> {
  const straight = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: secret, 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await straight.json().catch(() => ({}))) as { user?: { id?: string } };
  const id = body.user?.id;
  if (!straight.ok || id === undefined) {
    console.log('Auth refuses a sign-up without our ticket (its hooks are on)');
    return;
  }
  console.log('::warning::Auth made a user without our ticket: switch its hooks on (ADR 0082)');
  await fetch(`${url}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: secret },
    signal: AbortSignal.timeout(15_000),
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await check(process.argv[2] ?? '');
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
