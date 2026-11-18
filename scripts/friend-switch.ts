// vs Friend on the live site, on or off (ADR 0068): `node scripts/friend-switch.ts on|off|status`.
//
// It sets or unsets BALLBATTLE_ONLINE for Netlify's production context, then starts a production
// deploy of `release` (15 of the month's credits) and waits until the live API answers the new
// way: /api/v1/health 200 (on) or 404 `online_off` (off). The client is built with or without
// online play from the same variable (netlify.toml, [context.production]), so the page and the API
// switch together, in the one deploy. The offline game is the same build either way, minus vs
// Friend's card and screens. Uses your own `netlify login`; prints no value of any secret.
//
// The same by hand: Netlify > battle-ball > Project configuration > Environment variables >
// BALLBATTLE_ONLINE > Edit > Production `1` (on) or empty (off) > Save; then Deploys > Trigger
// deploy > Deploy project.
import { execFileSync } from 'node:child_process';

const SITE_ID = 'd2fa333e-9a60-4b58-a3d2-c8a673b2ae9f';
const LIVE = 'https://battle-ball.netlify.app';
const WAIT_MS = 10 * 60 * 1000;

function netlify(args: readonly string[]): string {
  return execFileSync('netlify', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
}

/** The live API's answer: on (200), off (404 online_off), or anything else as its status. */
async function liveState(): Promise<string> {
  const response = await fetch(`${LIVE}/api/v1/health`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  }).catch(() => undefined);
  if (response === undefined) return 'unreachable';
  if (response.status === 200) return 'on';
  const body = (await response.json().catch(() => ({}))) as { error?: { code?: string } };
  if (response.status === 404 && body.error?.code === 'online_off') return 'off';
  return `answering ${String(response.status)}`;
}

const wanted = process.argv[2];
if (wanted === 'status') {
  console.log(`vs Friend on ${LIVE}: ${await liveState()}`);
} else if (wanted === 'on' || wanted === 'off') {
  // Turning it on before `release` builds from this switch would start the API with no page for it.
  const releaseToml = execFileSync('git', ['show', 'origin/release:netlify.toml'], {
    encoding: 'utf8',
  });
  if (wanted === 'on' && !releaseToml.includes('BALLBATTLE_ONLINE:-')) {
    console.error('release predates the switch: publish first (gh workflow run publish.yml).');
    process.exit(1);
  }
  if (wanted === 'on') netlify(['env:set', 'BALLBATTLE_ONLINE', '1', '--context', 'production']);
  else netlify(['env:unset', 'BALLBATTLE_ONLINE', '--context', 'production']);
  console.log(`BALLBATTLE_ONLINE is ${wanted === 'on' ? '1' : 'unset'} for production.`);
  // Netlify's "Trigger deploy": a fresh production build of the production branch.
  netlify(['api', 'createSiteBuild', '--data', JSON.stringify({ site_id: SITE_ID })]);
  console.log('Production deploy started; waiting for the live API (usually 3-5 minutes)…');
  const deadline = Date.now() + WAIT_MS;
  let state = await liveState();
  while (state !== wanted && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    state = await liveState();
  }
  if (state === wanted) console.log(`vs Friend is ${wanted} on ${LIVE}.`);
  else {
    console.error(`After 10 minutes the live API is ${state}: check Deploys in Netlify.`);
    process.exitCode = 1;
  }
} else {
  console.error('Say on, off or status.');
  process.exitCode = 1;
}
