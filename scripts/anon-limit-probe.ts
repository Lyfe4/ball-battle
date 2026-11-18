// Checks that Supabase Auth counts its anonymous sign-in limit against each player's own IP, not
// our functions' shared one (ADR 0052 section 11). Hosted Auth counts the address that connects to
// it and ignores X-Forwarded-For (measured on staging, 2026-11-18); it counts a forwarded IP only
// from `Sb-Forwarded-For` on a request made with a secret key, and only once the project's "IP
// Address Forwarding" (Authentication > Rate Limits) is on. That is how `signUpGuest` calls it.
//
// Run it from your own machine against staging, or production once before launch. The keys come
// from the Supabase CLI and are never printed (bash):
//   SECRET=$(pnpm exec supabase projects api-keys --project-ref <ref> --reveal -o json \
//     | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0)).find(k => k.type === 'secret').api_key)")
//   node scripts/anon-limit-probe.ts --url https://<ref>.supabase.co --secret "$SECRET" [--count 160]
// (--reveal matters: without it the CLI masks the secret key and Auth refuses it.)
//
// 1. Signs up without a forwarded IP until Auth refuses (at most --count; set it above the
//    project's limit): this spends your own IP's allowance, as Netlify's would be spent.
// 2. Then signs up 3 times with a made-up forwarded IP. Accepted means Auth counts the forwarded
//    IP, so every player has their own allowance. Refused means forwarding is off.
// Every guest it makes is deleted again; a delete that fails is reported. Your own IP stays spent
// for up to an hour.
//
//   node scripts/anon-limit-probe.ts --site https://deploy-preview-<n>--battle-ball.netlify.app
// makes guests through the deployed API as players do (503 is Auth's refusal, 429 ours after 150
// an hour per network). Those are ordinary guests, left for the inactive-guest cleanup.
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    secret: { type: 'string' },
    site: { type: 'string' },
    count: { type: 'string', default: '160' },
  },
});
const count = Number(values.count);
let failedDeletes = 0;

async function signUp(url: string, secret: string, forwardedFor?: string): Promise<number> {
  const response = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: secret,
      'Content-Type': 'application/json',
      ...(forwardedFor === undefined ? {} : { 'Sb-Forwarded-For': forwardedFor }),
    },
    body: '{}',
  });
  const body = (await response.json()) as { user?: { id?: string } };
  const id = body.user?.id;
  if (id !== undefined) {
    const deleted = await fetch(`${url}/auth/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers: { apikey: secret },
    });
    if (!deleted.ok) failedDeletes += 1;
  }
  return response.status;
}

async function direct(url: string, secret: string): Promise<void> {
  const own: number[] = [];
  for (let n = 0; n < count && own.at(-1) !== 429; n += 1) own.push(await signUp(url, secret));
  console.log('Without a forwarded IP:', summary(own));
  if (own.at(-1) !== 429) {
    console.log(`Never refused: raise --count above the project's limit. Nothing is shown yet.`);
    return;
  }
  const made = `198.51.100.${String(1 + Math.floor(Math.random() * 254))}`;
  const forwarded: number[] = [];
  for (let n = 0; n < 3; n += 1) forwarded.push(await signUp(url, secret, made));
  console.log(`With Sb-Forwarded-For ${made}:`, summary(forwarded));
  console.log(
    forwarded.every((status) => status === 200)
      ? 'Auth counts the forwarded IP: each player has their own allowance.'
      : 'Refused: Auth ignores the forwarded IP (is IP Address Forwarding on?).',
  );
}

async function throughSite(site: string): Promise<void> {
  const statuses: number[] = [];
  for (let n = 0; n < count; n += 1) {
    const response = await fetch(`${site}/api/v1/session`, {
      method: 'POST',
      headers: { Origin: site, 'Content-Type': 'application/json' },
      body: JSON.stringify({ adult: true }),
    });
    statuses.push(response.status);
  }
  console.log(`Through ${site}:`, summary(statuses));
}

/** "200 ×30, then 429 ×5": the first refusal is the limit. */
function summary(statuses: readonly number[]): string {
  const runs: string[] = [];
  for (let i = 0; i < statuses.length;) {
    let j = i;
    while (statuses[j] === statuses[i]) j += 1;
    runs.push(`${String(statuses[i])} ×${String(j - i)}`);
    i = j;
  }
  return runs.join(', then ');
}

if (values.url !== undefined && values.secret !== undefined) {
  await direct(values.url, values.secret);
  if (failedDeletes > 0) {
    console.error(`${String(failedDeletes)} guests could not be deleted: delete them by hand.`);
    process.exitCode = 1;
  }
} else if (values.site !== undefined) {
  await throughSite(values.site);
} else {
  console.error('Give --url and --secret (Auth directly), or --site (through the API).');
  process.exit(1);
}
