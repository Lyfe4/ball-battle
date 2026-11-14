// Measures Supabase Auth's anonymous sign-in limit (30 an hour per IP by default) as our functions
// meet it: ADR 0052 section 11's open risk. Every guest is made by a Netlify function, so if Auth
// counts the IP that connects to it, all players share Netlify's few outgoing IPs and one limit.
//
// Run it against staging from your own machine (never production):
//   node scripts/anon-limit-probe.ts --url https://<ref>.supabase.co \
//     --key <publishable key> --secret <secret key> [--count 35]
//   node scripts/anon-limit-probe.ts --site https://deploy-preview-<n>--battle-ball.netlify.app \
//     [--count 35]
//
// --url: calls Auth directly, first with one fixed X-Forwarded-For, then with a different one. If
//   the second run is refused too, Auth ignores a forwarded IP and counts the connecting IP.
// --site: makes guests through the deployed API (POST /api/v1/session), as players do. Our own
//   limit allows 60 an hour per client IP, so a refusal before that is Auth's.
// Each guest made directly is deleted again when --secret is given; guests made through --site
// are left for the inactive-guest cleanup (they are ordinary guests). Auth's local
// `supabase start` doesn't count at all unless a rate-limit header is configured, which is why
// this runs against staging (findings from the local run are in ADR 0052, section 11).
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    key: { type: 'string' },
    secret: { type: 'string' },
    site: { type: 'string' },
    count: { type: 'string', default: '35' },
  },
});
const count = Number(values.count);

async function direct(url: string, key: string, forwardedFor: string): Promise<number[]> {
  const statuses: number[] = [];
  for (let n = 0; n < count; n += 1) {
    const response = await fetch(`${url}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json', 'X-Forwarded-For': forwardedFor },
      body: '{}',
    });
    statuses.push(response.status);
    const body = (await response.json()) as { user?: { id?: string } };
    const id = body.user?.id;
    if (id !== undefined && values.secret !== undefined) {
      await fetch(`${url}/auth/v1/admin/users/${id}`, {
        method: 'DELETE',
        headers: { apikey: values.secret },
      });
    }
  }
  return statuses;
}

async function throughSite(site: string): Promise<number[]> {
  const statuses: number[] = [];
  for (let n = 0; n < count; n += 1) {
    const response = await fetch(`${site}/api/v1/session`, {
      method: 'POST',
      headers: { Origin: site, 'Content-Type': 'application/json' },
      body: JSON.stringify({ adult: true }),
    });
    statuses.push(response.status);
  }
  return statuses;
}

/** "201 ×30, then 429 ×5": the first refusal is the limit. */
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

if (values.url !== undefined && values.key !== undefined) {
  console.log(
    'Auth directly, X-Forwarded-For 198.51.100.1:',
    summary(await direct(values.url, values.key, '198.51.100.1')),
  );
  console.log(
    'Auth directly, X-Forwarded-For 198.51.100.2:',
    summary(await direct(values.url, values.key, '198.51.100.2')),
  );
  console.log(
    'If the second line is refused from its start, Auth counts the connecting IP, not a forwarded one.',
  );
} else if (values.site !== undefined) {
  console.log(`Through ${values.site}:`, summary(await throughSite(values.site)));
  console.log('503 means Auth refused (guests_busy); our own limit answers 429 after guest 60.');
} else {
  console.error('Give --url and --key (Auth directly), or --site (through the API).');
  process.exit(1);
}
