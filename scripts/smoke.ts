// `node scripts/smoke.ts [base URL] [--expect online=on,accounts=on,pokes=on,turns=on] [--read-only]`
// The launch's smoke check (docs/launch-day-runbook.md), safe against production right after a
// switch: no load (about 20 requests), nothing left behind. It reads /health (the status, ruleset
// and switches), the home page and its script, the sign-in step, and, unless --read-only, plays a
// two-guest link challenge to its lineup step and opens the first guest's poke socket, then deletes
// both guests with Forget me (whatever failed before). Prints one line a check; exits 1 on any FAIL.
// Uses no secret: the guests are made the way a page makes one.

const args = process.argv.slice(2);
const BASE = (
  args.find((arg) => /^https?:\/\//.test(arg)) ?? 'https://battle-ball.netlify.app'
).replace(/\/+$/, '');
const READ_ONLY = args.includes('--read-only');
const expected = new Map(
  (args[args.indexOf('--expect') + 1] ?? '')
    .split(',')
    .filter((pair) => args.includes('--expect') && pair.includes('='))
    .map((pair) => pair.split('=') as [string, string]),
);

let failed = 0;
function report(ok: boolean, what: string, detail = ''): void {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail === '' ? '' : `: ${detail}`}`);
}

/** A browser of its own: the session cookie it was given, sent back as a page would. */
class Guest {
  private cookies = new Map<string, string>();

  async call(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; body: unknown }> {
    const response = await fetch(`${BASE}/api/v1/${path}`, {
      method,
      headers: {
        Origin: BASE,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        Cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; '),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15_000),
    });
    for (const line of response.headers.getSetCookie()) {
      const [pair = ''] = line.split(';');
      const at = pair.indexOf('=');
      if (at > 0) this.cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text === '' ? undefined : JSON.parse(text);
    } catch {
      // Not JSON: kept as text for the report.
    }
    return { status: response.status, body: parsed };
  }
}

const field = (body: unknown, key: string): unknown =>
  typeof body === 'object' && body !== null ? (body as Record<string, unknown>)[key] : undefined;

async function health(): Promise<void> {
  const response = await fetch(`${BASE}/api/v1/health`, { signal: AbortSignal.timeout(15_000) });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const word = (key: string, absent: string): string =>
    typeof body[key] === 'string' ? body[key] : absent;
  const online =
    response.status === 200
      ? 'on'
      : field(field(body, 'error'), 'code') === 'online_off'
        ? 'off'
        : '?';
  report(
    response.status === 200 && body['status'] === 'ok',
    'health',
    `status ${String(body['status'])}, ruleset ${String(body['ruleset'])}`,
  );
  const seen: Record<string, string> = {
    online,
    accounts: word('accounts', '?'),
    pokes: word('pokes', 'not reported'),
    turns: word('turns', 'not reported'),
    emailCodes: word('emailCodes', '?'),
    emailSends: word('emailSends', 'not reported'),
  };
  console.log(
    `      switches: ${Object.entries(seen)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')}`,
  );
  // The functions' database is SUPABASE_URL's project (launch eve): DATABASE_URL is masked.
  const matches = body['dbMatchesUrl'];
  if (typeof matches === 'boolean') {
    report(matches, 'database is SUPABASE_URL’s project', `dbMatchesUrl ${String(matches)}`);
  } else {
    console.log('      dbMatchesUrl: not reported by this deploy');
  }
  for (const [name, want] of expected) {
    const got =
      name === 'accounts' && want === 'on' ? (seen[name] === 'ok' ? 'on' : seen[name]) : seen[name];
    report(got === want, `switch ${name}`, `expected ${want}, got ${String(got)}`);
  }
}

async function pages(): Promise<void> {
  const home = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(15_000) });
  const html = await home.text();
  const script = /<script[^>]+src="([^"]*main-[^"]+\.js)"/.exec(html)?.[1];
  report(
    home.status === 200 && script !== undefined,
    'home page',
    `version ${script ?? 'no script'}`,
  );
  if (script !== undefined) {
    const js = await fetch(new URL(script, `${BASE}/`), { signal: AbortSignal.timeout(15_000) });
    report(js.status === 200, 'the game script loads', String(js.headers.get('content-type')));
  }
  const csp = home.headers.get('content-security-policy') ?? '';
  report(csp.includes("script-src 'self'"), 'security headers', csp === '' ? 'no CSP' : 'CSP set');
  const options = await fetch(`${BASE}/api/v1/auth/options`, {
    signal: AbortSignal.timeout(15_000),
  });
  const body = await options.json().catch(() => ({}));
  const off = field(field(body, 'error'), 'code') === 'accounts_off';
  report(
    options.status === 200 || off,
    'sign-in step',
    off ? 'accounts off' : JSON.stringify(body),
  );
  const signIn = await fetch(`${BASE}/?view=signin`, { signal: AbortSignal.timeout(15_000) });
  report(signIn.status === 200, 'sign-in page loads');
}

/** Joins the poke topic as a page does; true when Realtime answers the join with ok. */
function joins(connection: { url: string; key: string; topic: string }): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new WebSocket(
      `${connection.url}?apikey=${encodeURIComponent(connection.key)}&vsn=1.0.0`,
    );
    const done = (ok: boolean) => {
      clearTimeout(timer);
      socket.close();
      resolve(ok);
    };
    const timer = setTimeout(() => {
      done(false);
    }, 10_000);
    socket.onopen = () => {
      const config = {
        broadcast: { self: false, ack: false },
        presence: { key: '' },
        private: true,
      };
      const join = {
        topic: `realtime:${connection.topic}`,
        event: 'phx_join',
        payload: { config },
        ref: '1',
        join_ref: '1',
      };
      socket.send(JSON.stringify(join));
    };
    socket.onmessage = (message: { data: unknown }) => {
      const reply = JSON.parse(String(message.data)) as {
        event?: string;
        ref?: string;
        payload?: { status?: string };
      };
      if (reply.event === 'phx_reply' && reply.ref === '1') done(reply.payload?.status === 'ok');
    };
    socket.onerror = () => {
      done(false);
    };
  });
}

async function twoGuests(): Promise<void> {
  const a = new Guest();
  const b = new Guest();
  const made: Guest[] = [];
  try {
    for (const guest of [a, b]) {
      const answer = await guest.call('POST', 'session', { adult: true });
      report(answer.status === 201, 'a guest starts', `answered ${String(answer.status)}`);
      if (answer.status !== 201) return;
      made.push(guest);
    }
    const sent = await a.call('POST', 'challenges', {
      format: 'reveal',
      bestOf: 3,
      requestId: crypto.randomUUID(),
      live: true,
    });
    const token = field(sent.body, 'token');
    report(
      sent.status === 201 || sent.status === 200,
      'guest A sends a link',
      `answered ${String(sent.status)}`,
    );
    if (typeof token !== 'string') return;
    const card = await b.call('GET', `challenges/${token}`);
    report(
      field(card.body, 'status') === 'open',
      'guest B opens the link',
      String(field(card.body, 'status')),
    );
    const accepted = await b.call('POST', `challenges/${token}/accept`, {});
    report(
      typeof field(accepted.body, 'startId') === 'string',
      'guest B accepts: the lineups open',
      `answered ${String(accepted.status)}`,
    );
    const poke = await a.call('GET', 'me/poke');
    if (field(poke.body, 'off') === true) {
      console.log('      pokes off: no socket to check');
    } else {
      const connection = poke.body as { url: string; key: string; topic: string };
      report(await joins(connection), 'the poke socket is authorised and joins', connection.url);
    }
  } catch (error) {
    report(false, 'two guests', String(error));
  } finally {
    // Self-cleaning: Forget me for every guest made, whatever happened above.
    for (const guest of made) {
      const gone = await guest.call('DELETE', 'me').catch(() => ({ status: 0 }));
      report(
        gone.status === 204,
        'a test guest is deleted (Forget me)',
        `answered ${String(gone.status)}`,
      );
    }
  }
}

console.log(`Smoke check of ${BASE}${READ_ONLY ? ' (read only)' : ''}`);
await health();
await pages();
if (!READ_ONLY) await twoGuests();
console.log(failed === 0 ? 'All checks passed.' : `${String(failed)} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
