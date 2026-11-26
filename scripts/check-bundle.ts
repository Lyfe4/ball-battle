// Run after `vite build` (part of `pnpm build`): the client bundle must hold no secret, and a build
// without online play must hold none of its code (ADR 0052, section 6). Netlify builds production
// without VITE_ONLINE, so a production deploy whose bundle could reach the API fails its build.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { budgetLine, budgetProblems } from './bundle-budget.ts';

/** Text that only a secret contains: Supabase's secret and service-role keys, private keys. */
export const SECRET_MARKS: readonly RegExp[] = [
  /sb_secret_/,
  // "service_role" in a JWT's payload, base64url at each of its three alignments.
  /c2VydmljZV9yb2xl|NlcnZpY2Vfcm9sZ|zZXJ2aWNlX3JvbG/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /postgres(?:ql)?:\/\/[^\s"'`]*:[^\s"'`@]+@/,
  // Google's OAuth client secret (GOOGLE_CLIENT_SECRET): the functions' only, never a page's.
  /GOCSPX-/,
];

/**
 * What only online play's code contains: the API's path, anywhere but Forget me's own URL, which
 * every build holds so deleting a guest never waits on the vs Friend switch (ADR 0078). The quote
 * after it means exactly that URL: `/api/v1/me/match`, or callApi's `/api/v1/${path}`, is online
 * code.
 */
export const ONLINE_MARK = /\/api\/v1\/(?!me["'`])/;

/**
 * What only accounts' code contains (ADR 0079): the sign-in routes, choosing a username, the
 * record (ADR 0088) and the friends routes (a path under "friends/", or "friends" itself called
 * with its method). An online build without accounts (production with vs Friend on) holds none of
 * it. The word "friends" alone is the Friends tab's name (ADR 0081), which that build has.
 */
export const ACCOUNTS_MARK =
  /\bauth\/(?:options|email|google|switch)\b|\bme\/(?:username|inbox|record)\b|["'`]friends\/|["'`](?:GET|POST|PUT|PATCH|DELETE)["'`]\s*,\s*["'`]friends["'`]/;

/**
 * What only the Realtime poke's code contains (ADR 0082): its route, Realtime's socket path and
 * the Phoenix join. A build without `VITE_POKE` (every one but local and tests, for now) holds none
 * of it. Never a key: the browser key comes from GET /me/poke at run time.
 */
export const POKE_MARK = /\bme\/poke\b|realtime\/v1\/websocket|phx_join/;

/**
 * What only play by turns' choice contains (ADR 0085): its name on the vs Friend setup. A build
 * without `VITE_TURNS` (production) offers nothing by turns, so it holds none of it.
 */
export const TURNS_MARK = /\bBy turns\b/;

/**
 * What is wrong with one bundled file: `online` says whether this build may call the API,
 * `accounts` whether it may sign in, and `poke` whether it may open the poke's socket.
 */
export function problemsIn(
  name: string,
  text: string,
  online: boolean,
  accounts = online,
  poke = false,
  turns = false,
): string[] {
  const problems = SECRET_MARKS.filter((mark) => mark.test(text)).map(
    (mark) => `${name} holds something shaped like a secret (${mark.source.slice(0, 20)}…)`,
  );
  if (!online && ONLINE_MARK.test(text)) {
    problems.push(`${name} holds online play's code in a build without it (VITE_ONLINE unset)`);
  }
  if (!accounts && ACCOUNTS_MARK.test(text)) {
    problems.push(`${name} holds sign-in code in a build without accounts (VITE_ACCOUNTS unset)`);
  }
  if (!poke && POKE_MARK.test(text)) {
    problems.push(`${name} holds the poke's code in a build without it (VITE_POKE unset)`);
  }
  if (!turns && TURNS_MARK.test(text)) {
    problems.push(`${name} offers play by turns in a build without it (VITE_TURNS unset)`);
  }
  return problems;
}

function filesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesIn(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/**
 * Checks dist/ and fails the process on any problem; `online` is whether it may call the API,
 * `accounts` whether it may sign in, `poke` whether it may open the poke's socket.
 */
export function reportDist(online: boolean, accounts = false, poke = false, turns = false): void {
  const dist = fileURLToPath(new URL('../dist', import.meta.url));
  const files = filesIn(dist)
    .filter((file) => /\.(?:js|html|css|json|webmanifest)$/.test(file))
    .map((file) => ({ name: file.slice(dist.length + 1), text: readFileSync(file, 'utf8') }));
  const problems = [
    ...files.flatMap(({ name, text }) => problemsIn(name, text, online, accounts, poke, turns)),
    // The size budget (bundle-budget.ts), in the same check so CI's build job holds it.
    ...budgetProblems(files),
  ];
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  const without = !online ? ' and no online code' : accounts ? '' : ' and no sign-in code';
  console.log(`dist/ holds no secret${without}; ${budgetLine(files)}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const online = process.env['VITE_ONLINE'] === '1';
  reportDist(
    online,
    online && process.env['VITE_ACCOUNTS'] === '1',
    online && process.env['VITE_POKE'] === '1',
    online && process.env['VITE_TURNS'] === '1',
  );
}
