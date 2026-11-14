// Guests and sessions against the local Supabase (ADR 0052, sections 2 and 10).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorOf } from '../../api/errors.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { TestBrowser } from '../test/client.ts';
import { me } from './me.ts';
import { session } from './session.ts';

const deps = testDeps();
const admin = adminSql();
// Each run starts with no counted attempts: earlier runs' windows are still open.
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
});
afterAll(async () => {
  await deps.sql.end();
  await admin.end();
});

/** A fresh device on its own IP, so no test spends another's guest limit. */
let devices = 0;
function device(): TestBrowser {
  devices += 1;
  return new TestBrowser(deps, `198.51.100.${String(devices)}`);
}

const code = (body: unknown) => errorOf(body)?.code;

async function guest(browser = device()): Promise<TestBrowser> {
  const made = await browser.call(session, 'POST', '/api/v1/session', { adult: true });
  expect(made.status).toBe(201);
  return browser;
}

describe('making a guest', () => {
  it('needs the 16+ confirmation, and makes nothing without it', async () => {
    const browser = device();
    for (const body of [{}, { adult: false }, { adult: 'yes' }]) {
      const answer = await browser.call(session, 'POST', '/api/v1/session', body);
      expect(code(answer.body)).toBe('age_unconfirmed');
    }
    expect(browser.cookie).toBeUndefined();
  });

  it('sets a __Host- cookie that is HttpOnly, Secure and SameSite=Lax, and names the guest', async () => {
    const browser = device();
    const answer = await browser.call(session, 'POST', '/api/v1/session', { adult: true });
    expect((answer.body as { name: string }).name).toMatch(/^Player \d{4}$/);
    const [cookie] = answer.headers.getSetCookie();
    expect(cookie).toMatch(/^__Host-bb_session=/);
    for (const attribute of ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax']) {
      expect(cookie).toContain(attribute);
    }
    expect(cookie).not.toMatch(/Domain=/i);
    expect((await browser.call(me, 'GET', '/api/v1/me')).body).toStrictEqual(answer.body);
  });

  it('stores when the player confirmed they are 16 or older, by database time', async () => {
    const browser = await guest();
    const [row] = await admin<{ adult: boolean }[]>`
      select adult_confirmed_at between now() - interval '1 minute' and now() as adult
      from game.profiles order by created_at desc limit 1`;
    expect(row?.adult).toBe(true);
    expect(browser.cookie).toBeDefined();
  });

  it('keeps the guest a browser already has: a double tap makes no second one', async () => {
    const browser = await guest();
    const first = await browser.call(me, 'GET', '/api/v1/me');
    const again = await browser.call(session, 'POST', '/api/v1/session', { adult: true });
    expect(again.status).toBe(200);
    expect(again.body).toStrictEqual(first.body);
  });

  it('makes 50 guests from one IP (a class on one network) without our limit refusing', async () => {
    const ip = '192.0.2.50';
    for (let n = 0; n < 50; n += 1) {
      const answer = await new TestBrowser(deps, ip).call(session, 'POST', '/api/v1/session', {
        adult: true,
      });
      expect(answer.status, `guest ${String(n + 1)}`).toBe(201);
    }
  });
});

describe('the CSRF check', () => {
  it('refuses a change from another origin, or with no origin', async () => {
    const browser = device();
    for (const origin of ['https://evil.test', 'null']) {
      const answer = await browser.call(
        session,
        'POST',
        '/api/v1/session',
        { adult: true },
        {
          Origin: origin,
        },
      );
      expect(answer.status).toBe(403);
    }
    expect(browser.cookie).toBeUndefined();
  });

  it('refuses a body that is not JSON, as a cross-site form would send', async () => {
    const answer = await device().call(
      session,
      'POST',
      '/api/v1/session',
      { adult: true },
      {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    );
    expect(answer.status).toBe(415);
  });

  it('lets a read through without an origin (a GET changes nothing)', async () => {
    const browser = await guest();
    const answer = await browser.call(me, 'GET', '/api/v1/me', undefined, { Origin: '' });
    expect(answer.status).toBe(200);
  });
});

describe('a session', () => {
  it('is refused without a cookie, or with a forged one', async () => {
    const browser = device();
    expect((await browser.call(me, 'GET', '/api/v1/me')).status).toBe(401);
    browser.cookie = Buffer.from(JSON.stringify({ a: 'x.y.z', r: 'abc' })).toString('base64url');
    const answer = await browser.call(me, 'GET', '/api/v1/me');
    expect(code(answer.body)).toBe('unauthenticated');
    expect(browser.cookie).toBeUndefined();
  });

  it('refreshes an expired access token and rewrites the cookie', async () => {
    const browser = await guest();
    const before = browser.cookie;
    const later = new TestBrowser({
      ...deps,
      tokenClock: () => new Date(Date.now() + 2 * 3600_000),
    });
    later.cookie = before;
    const answer = await later.call(me, 'GET', '/api/v1/me');
    expect(answer.status).toBe(200);
    expect(later.cookie).toBeDefined();
    expect(later.cookie).not.toBe(before);
  });

  it('refreshes in two tabs at once, both keeping the player', async () => {
    const browser = await guest();
    const tabs = [0, 1].map(() => {
      const tab = new TestBrowser({
        ...deps,
        tokenClock: () => new Date(Date.now() + 2 * 3600_000),
      });
      tab.cookie = browser.cookie;
      return tab;
    });
    const answers = await Promise.all(tabs.map((tab) => tab.call(me, 'GET', '/api/v1/me')));
    expect(answers.map((answer) => answer.status)).toStrictEqual([200, 200]);
  });

  it('ends at logout: the refresh token stops working and the cookie is cleared', async () => {
    const browser = await guest();
    const kept = browser.cookie;
    expect((await browser.call(session, 'DELETE', '/api/v1/session')).status).toBe(204);
    expect(browser.cookie).toBeUndefined();
    const stale = new TestBrowser({
      ...deps,
      tokenClock: () => new Date(Date.now() + 2 * 3600_000),
    });
    stale.cookie = kept;
    expect((await stale.call(me, 'GET', '/api/v1/me')).status).toBe(401);
  });
});

describe('Forget me', () => {
  it('deletes the player at once: profile, auth user and session', async () => {
    const browser = await guest();
    const kept = browser.cookie;
    const [{ count: before } = { count: 0 }] = await admin<{ count: number }[]>`
      select count(*)::int as count from auth.users`;
    expect((await browser.call(me, 'DELETE', '/api/v1/me')).status).toBe(204);
    expect(browser.cookie).toBeUndefined();
    const [{ count: after } = { count: 0 }] = await admin<{ count: number }[]>`
      select count(*)::int as count from auth.users`;
    expect(after).toBe(before - 1);
    // A copy of the old cookie (another tab) no longer works, though its token hasn't expired.
    const tab = new TestBrowser(deps);
    tab.cookie = kept;
    expect(code((await tab.call(me, 'GET', '/api/v1/me')).body)).toBe('unauthenticated');
  });
});
