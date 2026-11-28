// Turnstile before a device's first email code (ADR 0079 addendum of 2026-11-28), against the local
// Supabase with a stand-in `siteverify`: on, a first code to an address needs a token Cloudflare
// accepts, checked before anything is counted or sent; the same address again from the same device
// doesn't; off (no keys, today's deploys), nothing asks Cloudflare.
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorOf } from '../../api/errors.ts';
import { CAPTCHA_REFUSED, CAPTCHA_UNAVAILABLE } from '../email-sign-in.ts';
import { emailSubject } from '../rate-limit.ts';
import { ORIGIN, TestBrowser } from '../test/client.ts';
import { mailCount, newEmail, nextCode } from '../test/mail.ts';
import { newPlayer } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { SITEVERIFY_URL, TURNSTILE_ACTION } from '../turnstile.ts';
import { authEmail } from './auth.ts';

const KEYS = {
  BALLBATTLE_TURNSTILE_SITE_KEY: '0x4AAAAtest',
  TURNSTILE_SECRET_KEY: '0x4AAAAsecret',
};
const on = testDeps(KEYS);
const off = testDeps();
const admin = adminSql();
const realFetch = globalThis.fetch.bind(globalThis);

/** What the stand-in siteverify was sent, and what it answers next. */
let checks: URLSearchParams[] = [];
let answer: () => Response = () => Response.json({ success: false });
const good = 'a-token-cloudflare-accepts';

beforeEach(async () => {
  await admin`delete from game.rate_limits`;
  checks = [];
  answer = () =>
    Response.json({
      success: checks.at(-1)?.get('response') === good,
      hostname: new URL(ORIGIN).hostname,
      action: TURNSTILE_ACTION,
      'error-codes': [],
    });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== SITEVERIFY_URL) return realFetch(input, init);
    checks.push(new URLSearchParams(init?.body as string));
    return Promise.resolve(answer());
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});
afterAll(async () => {
  await on.sql.end();
  await off.sql.end();
  await admin.end();
});

const send = (browser: TestBrowser, email: string, captcha?: string, adult?: true) =>
  browser.call(authEmail, 'POST', '/api/v1/auth/email', { email, adult, captcha });

/** Whether any code to `email` was counted. */
async function counted(email: string): Promise<boolean> {
  const subject = await emailSubject(on.config, email);
  const rows = await admin`select 1 from game.rate_limits where subject = ${subject}`;
  return rows.length > 0;
}

describe('with Turnstile on', () => {
  it('refuses a first code without a token, or with one Cloudflare turns down, counting nothing', async () => {
    const guest = await newPlayer(on);
    const email = newEmail();
    for (const captcha of [undefined, 'a-spent-token']) {
      const refused = await send(guest.browser, email, captcha);
      expect([refused.status, errorOf(refused.body)]).toStrictEqual([
        400,
        { code: 'captcha_failed', message: CAPTCHA_REFUSED },
      ]);
    }
    // No token never asks Cloudflare; the spent one did, once.
    expect(checks.map((check) => check.get('response'))).toStrictEqual(['a-spent-token']);
    expect(await counted(email)).toBe(false);
    expect(await mailCount(email)).toBe(0);
  });

  it('sends a first code once Cloudflare accepts its token, from the player’s IP', async () => {
    const device = new TestBrowser(on, '198.51.100.90');
    const email = newEmail();
    const sent = await send(device, email, good, true);
    expect(sent.status).toBe(202);
    expect(await nextCode(email)).toMatch(/^\d{6}$/);
    expect(checks).toHaveLength(1);
    expect(checks[0]?.get('remoteip')).toBe('198.51.100.90');
    expect(checks[0]?.get('secret')).toBe(KEYS.TURNSTILE_SECRET_KEY);
  });

  it('sends the same address again without a token, but another address needs its own', async () => {
    const guest = await newPlayer(on);
    const email = newEmail();
    expect((await send(guest.browser, email, good)).status).toBe(202);
    await nextCode(email);
    // Send a new code: local Auth sends one a second to an address (Supabase's config.toml).
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect((await send(guest.browser, email)).status).toBe(202);
    await nextCode(email, 1);
    expect(checks).toHaveLength(1);
    // Use another email: the cookie from the first is no pass for a second address.
    const other = newEmail();
    expect(errorOf((await send(guest.browser, other)).body)?.code).toBe('captcha_failed');
    expect(await counted(other)).toBe(false);
  });

  it('gives no pass to another device sending the same address', async () => {
    const email = newEmail();
    const first = await newPlayer(on);
    expect((await send(first.browser, email, good)).status).toBe(202);
    const second = await newPlayer(on);
    expect(errorOf((await send(second.browser, email)).body)?.code).toBe('captcha_failed');
  });

  it('says try again later, sending nothing, while Cloudflare can’t answer', async () => {
    answer = () => new Response('Bad gateway', { status: 502 });
    const guest = await newPlayer(on);
    const email = newEmail();
    const refused = await send(guest.browser, email, good);
    expect([refused.status, errorOf(refused.body)]).toStrictEqual([
      503,
      { code: 'captcha_failed', message: CAPTCHA_UNAVAILABLE },
    ]);
    expect(refused.headers.get('Retry-After')).toBe('60');
    expect(await counted(email)).toBe(false);
  });
});

describe('with Turnstile off (no keys: every deploy today)', () => {
  it('sends a first code without a token, never asking Cloudflare', async () => {
    const guest = await newPlayer(off);
    const email = newEmail();
    expect((await send(guest.browser, email)).status).toBe(202);
    expect(await nextCode(email)).toMatch(/^\d{6}$/);
    expect(checks).toHaveLength(0);
  });
});
