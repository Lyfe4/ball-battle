// Run after `vite build` (part of `pnpm build`): the client bundle must hold no secret, and a build
// without online play must hold none of its code (ADR 0052, section 6). Netlify builds production
// without VITE_ONLINE, so a production deploy whose bundle could reach the API fails its build.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Text that only a secret contains: Supabase's secret and service-role keys, private keys. */
export const SECRET_MARKS: readonly RegExp[] = [
  /sb_secret_/,
  // "service_role" in a JWT's payload, base64url at each of its three alignments.
  /c2VydmljZV9yb2xl|NlcnZpY2Vfcm9sZ|zZXJ2aWNlX3JvbG/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /postgres(?:ql)?:\/\/[^\s"'`]*:[^\s"'`@]+@/,
];

/**
 * What only online play's code contains: the API's path, anywhere but Forget me's own URL, which
 * every build holds so deleting a guest never waits on the vs Friend switch (ADR 0078). The quote
 * after it means exactly that URL: `/api/v1/me/match`, or callApi's `/api/v1/${path}`, is online
 * code.
 */
export const ONLINE_MARK = /\/api\/v1\/(?!me["'`])/;

/** What is wrong with one bundled file: `online` says whether this build may call the API. */
export function problemsIn(name: string, text: string, online: boolean): string[] {
  const problems = SECRET_MARKS.filter((mark) => mark.test(text)).map(
    (mark) => `${name} holds something shaped like a secret (${mark.source.slice(0, 20)}…)`,
  );
  if (!online && ONLINE_MARK.test(text)) {
    problems.push(`${name} holds online play's code in a build without it (VITE_ONLINE unset)`);
  }
  return problems;
}

function filesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesIn(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/** Checks dist/ and fails the process on any problem; `online` is whether it may call the API. */
export function reportDist(online: boolean): void {
  const dist = fileURLToPath(new URL('../dist', import.meta.url));
  const problems = filesIn(dist)
    .filter((file) => /\.(?:js|html|css|json|webmanifest)$/.test(file))
    .flatMap((file) => problemsIn(file.slice(dist.length + 1), readFileSync(file, 'utf8'), online));
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log(`dist/ holds no secret${online ? '' : ' and no online code'}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  reportDist(process.env['VITE_ONLINE'] === '1');
}
