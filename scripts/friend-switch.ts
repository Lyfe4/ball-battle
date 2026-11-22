// vs Friend on the live site, on or off (ADR 0068): `node scripts/friend-switch.ts on|off|status`.
// With `--accounts`, the same for accounts (ADR 0079, BALLBATTLE_ACCOUNTS): sign-in, only while vs
// Friend is on, read live from /api/v1/auth/options (200 on, 404 `accounts_off` off). Accounts go to
// production only together with friends: never switch them on alone.
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
import { netlify, switchCalls, type Switch } from './netlify-cli.ts';

const LIVE = 'https://battle-ball.netlify.app';
const WAIT_MS = 10 * 60 * 1000;

const accounts = process.argv.includes('--accounts');
const variable: Switch = accounts ? 'BALLBATTLE_ACCOUNTS' : 'BALLBATTLE_ONLINE';
const what = accounts ? 'Accounts' : 'vs Friend';

/** The live API's answer: on (200), off (404 online_off), or anything else as its status. */
async function liveState(path = accounts ? 'auth/options' : 'health'): Promise<string> {
  const response = await fetch(`${LIVE}/api/v1/${path}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  }).catch(() => undefined);
  if (response === undefined) return 'unreachable';
  if (response.status === 200) return 'on';
  const body = (await response.json().catch(() => ({}))) as { error?: { code?: string } };
  const off = body.error?.code === 'online_off' || body.error?.code === 'accounts_off';
  if (response.status === 404 && off) return 'off';
  return `answering ${String(response.status)}`;
}

const wanted = process.argv[2];
if (wanted === 'status') {
  console.log(`${what} on ${LIVE}: ${await liveState()}`);
} else if (wanted === 'on' || wanted === 'off') {
  // Turning it on before `release` builds from this switch would start the API with no page for it.
  const releaseToml = execFileSync('git', ['show', 'origin/release:netlify.toml'], {
    encoding: 'utf8',
  });
  if (wanted === 'on' && !releaseToml.includes(`${variable}:-`)) {
    console.error('release predates the switch: publish first (gh workflow run publish.yml).');
    process.exit(1);
  }
  if (accounts && wanted === 'on' && (await liveState('health')) !== 'on') {
    console.error('Accounts need vs Friend on first: node scripts/friend-switch.ts on');
    process.exit(1);
  }
  const [setVariable, triggerBuild] = switchCalls(wanted, variable);
  netlify(setVariable);
  console.log(`${variable} is ${wanted === 'on' ? '1' : 'unset'} for production.`);
  netlify(triggerBuild);
  console.log('Production deploy started; waiting for the live API (usually 3-5 minutes)…');
  const deadline = Date.now() + WAIT_MS;
  let state = await liveState();
  while (state !== wanted && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    state = await liveState();
  }
  if (state === wanted) console.log(`${what} is ${wanted} on ${LIVE}.`);
  else {
    console.error(`After 10 minutes the live API is ${state}: check Deploys in Netlify.`);
    process.exitCode = 1;
  }
} else {
  console.error('Say on, off or status (and --accounts for accounts).');
  process.exitCode = 1;
}
