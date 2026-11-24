// Auth refuses what the game didn't start (ADR 0082, decision 2), against the local Supabase with
// both hooks on (supabase/config.toml). Anyone holding the publishable key can call Auth's `/otp`
// and `/signup` straight from the browser; a code reaches an inbox, and a user is made, only when
// our functions wrote a ticket for it first. Codes the game asks for still arrive (here, and in
// every email sign-in test).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectAuth, newTicket } from '../auth-tickets.ts';
import { TestBrowser } from '../test/client.ts';
import { mailCount, newEmail, nextCode } from '../test/mail.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { authEmail } from './auth.ts';

const deps = testDeps();
const admin = adminSql();
const { supabaseUrl, supabasePublishableKey, supabaseSecretKey } = deps.config;
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
});
afterAll(async () => {
  await deps.sql.end();
  await admin.end();
});

/** A call straight to Auth, as a page holding the publishable key could make. */
const straightToAuth = (path: string, body: unknown, key = supabasePublishableKey) =>
  fetch(`${supabaseUrl}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

async function usersWith(email: string): Promise<number> {
  const [row] = await admin<{ n: number }[]>`
    select count(*)::int as n from auth.users where email = ${email}`;
  return row?.n ?? 0;
}

async function userCount(): Promise<number> {
  const [row] = await admin<{ n: number }[]>`select count(*)::int as n from auth.users`;
  return row?.n ?? 0;
}

/** Mail that might still be on its way: pg_net sends after commit. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 1500));

/** An address with an account: a code the game sent, checked through Auth. */
async function accountWith(email: string): Promise<void> {
  const signUp = newTicket();
  await expectAuth(deps.sql, { email, signUp });
  const sent = await straightToAuth(
    'otp',
    { email, create_user: true, data: { bb_ticket: signUp } },
    supabaseSecretKey,
  );
  expect(sent.status).toBe(200);
  const token = await nextCode(email);
  const verified = await straightToAuth('verify', { type: 'email', email, token });
  expect(verified.status).toBe(200);
}

describe('an email code', () => {
  it('the game did not ask for is refused, sends nothing and makes no user', async () => {
    const email = newEmail();
    const answer = await straightToAuth('otp', { email, create_user: true });
    expect(answer.ok).toBe(false);
    await settle();
    expect(await mailCount(email)).toBe(0);
    expect(await usersWith(email)).toBe(0);
  });

  it('to an existing account, not asked for by the game, sends nothing', async () => {
    const email = newEmail();
    await accountWith(email);
    const before = await mailCount(email);
    const answer = await straightToAuth('otp', { email, create_user: false });
    expect(answer.ok).toBe(false);
    await settle();
    expect(await mailCount(email)).toBe(before);
  });

  it('the game asked for still arrives', async () => {
    const email = newEmail();
    const browser = new TestBrowser(deps, '198.51.100.90');
    const sent = await browser.call(authEmail, 'POST', '/api/v1/auth/email', {
      email,
      adult: true,
    });
    expect(sent.status).toBe(202);
    expect(await nextCode(email)).toMatch(/^\d{6}$/);
  });

  it('works once per ticket: a second straight call is refused', async () => {
    const email = newEmail();
    await accountWith(email);
    const before = await mailCount(email);
    await expectAuth(deps.sql, { email });
    expect((await straightToAuth('otp', { email, create_user: false })).status).toBe(200);
    await nextCode(email, before);
    await settle(); // past Auth's own one-a-second limit per address, so only the ticket refuses
    expect((await straightToAuth('otp', { email, create_user: false })).ok).toBe(false);
    await settle();
    expect(await mailCount(email)).toBe(before + 1);
  });

  it('is refused once its ticket is over a minute old', async () => {
    const email = newEmail();
    await accountWith(email);
    const before = await mailCount(email);
    await expectAuth(deps.sql, { email });
    await admin`update game.auth_tickets set expires_at = now() - interval '1 second'
      where kind = 'email' and subject = game.email_ticket_subject(${email})`;
    expect((await straightToAuth('otp', { email, create_user: false })).ok).toBe(false);
    await settle();
    expect(await mailCount(email)).toBe(before);
  });

  it('keeps no address in its ticket', async () => {
    const email = newEmail();
    await expectAuth(deps.sql, { email });
    const rows = await admin<{ subject: string }[]>`
      select subject from game.auth_tickets where kind = 'email'`;
    expect(rows.length).toBeGreaterThan(0);
    for (const { subject } of rows) expect(subject).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('a sign-up', () => {
  it('without our ticket is refused, with either key', async () => {
    const before = await userCount();
    for (const key of [supabasePublishableKey, supabaseSecretKey]) {
      expect((await straightToAuth('signup', {}, key)).ok).toBe(false);
      expect((await straightToAuth('signup', { data: { bb_ticket: 'made-up' } }, key)).ok).toBe(
        false,
      );
    }
    expect(await userCount()).toBe(before);
  });

  it('with our ticket is made, and the ticket works only once', async () => {
    const ticket = newTicket();
    await expectAuth(deps.sql, { signUp: ticket });
    const first = await straightToAuth(
      'signup',
      { data: { bb_ticket: ticket } },
      supabaseSecretKey,
    );
    expect(first.status).toBe(200);
    const again = await straightToAuth(
      'signup',
      { data: { bb_ticket: ticket } },
      supabaseSecretKey,
    );
    expect(again.ok).toBe(false);
  });
});

describe('the hooks themselves', () => {
  it('let Google make a user (Auth has checked its ID token against our client)', async () => {
    const google = { user: { app_metadata: { provider: 'google' }, user_metadata: {} } };
    const email = { user: { app_metadata: { provider: 'email' }, user_metadata: {} } };
    const [row] = await admin<{ google: unknown; email: unknown }[]>`
      select public.ballbattle_before_user_created(${admin.json(google)}) as google,
             public.ballbattle_before_user_created(${admin.json(email)}) as email`;
    expect(row?.google).toStrictEqual({});
    expect(row?.email).toMatchObject({ error: { http_code: 403 } });
  });

  it('send no email but a code: a reset or an invite is refused even with a ticket', async () => {
    const email = newEmail();
    await expectAuth(deps.sql, { email });
    const event = (action: string) => ({
      user: { email, new_email: '' },
      email_data: { email_action_type: action, token: '123456' },
    });
    for (const action of ['recovery', 'invite', 'reauthentication']) {
      const [row] = await admin<{ answer: unknown }[]>`
        select public.ballbattle_send_email(${admin.json(event(action))}) as answer`;
      expect(row?.answer).toMatchObject({ error: { http_code: 403 } });
    }
  });

  it('are run by Auth alone, never by the API or a page', async () => {
    const rows = await admin<{ role: string; hook: string; allowed: boolean }[]>`
      select r.role, h.hook, has_function_privilege(r.role, h.hook, 'execute') as allowed
      from (values ('anon'), ('authenticated'), ('game_api')) as r (role),
        (values ('public.ballbattle_before_user_created(jsonb)'),
                ('public.ballbattle_send_email(jsonb)')) as h (hook)`;
    expect(rows.filter((row) => row.allowed)).toStrictEqual([]);
  });
});
