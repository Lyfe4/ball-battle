import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { endpoint } from '../http.ts';
import { startMonitor } from '../monitor.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { clientError } from './client-error.ts';

const DSN = 'https://publickey@o1.ingest.sentry.io/42';
const off = testDeps();
const on = testDeps({ BALLBATTLE_ERROR_REPORTS: '1', SENTRY_DSN: DSN });
const admin = adminSql();

beforeAll(async () => {
  await admin`delete from game.rate_limits where bucket = 'page.error'`;
});
afterEach(() => {
  startMonitor(undefined);
  vi.unstubAllGlobals();
});
afterAll(async () => {
  await admin`delete from game.rate_limits where bucket = 'page.error'`;
  await off.sql.end();
  await on.sql.end();
  await admin.end();
});

const report = {
  kind: 'error',
  type: 'TypeError',
  message: 'No player "robin_b" for sam@example.com, code 482913',
  stack: 'TypeError: x\n    at pick (https://battle-ball.netlify.app/assets/main-Ab12.js?s=9:1:2)',
};

function post(deps: typeof on, body: unknown = report, origin = 'http://localhost') {
  const handler = endpoint(
    'client.error',
    clientError,
    () => deps,
    () => undefined,
  );
  return handler(
    new Request('http://localhost/api/v1/client-error', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { requestId: 'r1', ip: '203.0.113.9' },
  );
}

/** Sentry's envelope endpoint, stubbed: what reached it. */
function stubSentry(): string[] {
  const sent: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      sent.push(`${url}\n${typeof init.body === 'string' ? init.body : ''}`);
      return Promise.resolve(new Response(null, { status: 200 }));
    }),
  );
  return sent;
}

describe('POST /api/v1/client-error (launch eve)', () => {
  it('is off unless BALLBATTLE_ERROR_REPORTS and SENTRY_DSN are set: 404, nothing sent or counted', async () => {
    const sent = stubSentry();
    startMonitor(DSN);
    const response = await post(off);
    expect(response.status).toBe(404);
    expect(sent).toStrictEqual([]);
    const [row] = await admin<{ count: number }[]>`
      select count(*)::int as count from game.rate_limits where bucket = 'page.error'`;
    expect(row?.count).toBe(0);
  });

  it('sends a page’s error on, scrubbed again, with nothing about the person', async () => {
    const sent = stubSentry();
    startMonitor(on.config.sentryDsn);
    const response = await post(on);
    expect(response.status).toBe(204);
    expect(sent).toHaveLength(1);
    const [url, ...lines] = (sent[0] ?? '').split('\n');
    expect(url).toBe('https://o1.ingest.sentry.io/api/42/envelope/');
    const event = JSON.parse(lines.at(-1) ?? '{}') as Record<string, unknown>;
    expect(event).toMatchObject({ platform: 'javascript', tags: { route: 'page', kind: 'error' } });
    const text = sent[0] ?? '';
    expect(text).toContain('No player \\"…\\" for <email>, code <n>');
    expect(text).toContain('"filename":"/assets/main-Ab12.js"');
    for (const personal of ['robin_b', 'sam@', '482913', '203.0.113.9', '?s=9', 'netlify.app']) {
      expect(text).not.toContain(personal);
    }
  });

  it('refuses what isn’t a report, or comes from another site', async () => {
    stubSentry();
    startMonitor(on.config.sentryDsn);
    expect((await post(on, { kind: 'boom' })).status).toBe(400);
    expect((await post(on, report, 'https://evil.example')).status).toBe(403);
  });

  it('counts each network’s reports, so a script can’t spend the error service’s quota', async () => {
    stubSentry();
    startMonitor(on.config.sentryDsn);
    await admin`
      insert into game.rate_limits (subject, bucket, window_start, count)
      select subject, 'page.error', window_start, 1000 from game.rate_limits
      where bucket = 'page.error'
      on conflict (subject, bucket, window_start) do update set count = 1000`;
    expect((await post(on)).status).toBe(429);
  });
});
