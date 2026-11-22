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
// 3. Deletes that guest again, whatever happened.
// 4. Counts this month's email codes (ADR 0079): past 2,200 of the 2,700 we allow ourselves under
//    Resend Free's 3,000, it fails, a slower second alarm beside /api/v1/health's `emailCodes`.
// Any failure exits 1, so the workflow fails and GitHub emails you.
import { fileURLToPath } from 'node:url';
import { NEAR_MONTHLY } from '../src/server/routes/health.ts';
import { EVERYONE, LIMITS } from '../src/server/rate-limit.ts';
import { projectRefOf, readQuery, secretKeyOf, textOf } from './supabase-projects.ts';

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

  const [codes] = readQuery(ref, MONTHLY_CODES_SQL);
  const sent = Number(textOf(codes, 'sent') ?? '0');
  const codeProblem = codesProblem(sent);
  console.log(`${name}: ${String(sent)} email codes this month`);

  const secret = secretKeyOf(ref);
  const ip = madeUpIp(Math.random());
  const signUp = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: secret, 'Content-Type': 'application/json', 'Sb-Forwarded-For': ip },
    body: '{}',
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await signUp.json().catch(() => ({}))) as { user?: { id?: string } };
  const id = body.user?.id;
  if (!signUp.ok || id === undefined) {
    throw new Error(`A guest sign-up answered ${String(signUp.status)} (anonymous sign-ins off?)`);
  }
  const problems: string[] = codeProblem === undefined ? [] : [codeProblem];
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
  if (problems.length > 0) throw new Error(problems.join('; '));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await check(process.argv[2] ?? '');
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
