// Signing in with an email code (ADR 0079), against the local Supabase: real Auth, its emails read
// from the mail catcher. A guest keeps its id; an address with an account answers the same as a
// new one until its code is checked, then offers to switch, which deletes the guest.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorOf } from '../../api/errors.ts';
import { configOf } from '../config.ts';
import type { Deps } from '../http.ts';
import { TestBrowser } from '../test/client.ts';
import { mailCount, newEmail, nextCode, otherThan } from '../test/mail.ts';
import { newPlayer, newSeries, userIdOf, type Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { authEmail, authEmailVerify, authSwitch } from './auth.ts';
import { me } from './me.ts';

const deps = testDeps();
const admin = adminSql();
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
});
afterAll(async () => {
  await deps.sql.end();
  await admin.end();
});

const code = (body: unknown) => errorOf(body)?.code;

/** Sends a code to `email` from `browser`, and reads it from the mail catcher. */
async function sendTo(browser: TestBrowser, email: string, adult?: true): Promise<string> {
  const before = await mailCount(email);
  const sent = await browser.call(authEmail, 'POST', '/api/v1/auth/email', { email, adult });
  expect(sent.status).toBe(202);
  return nextCode(email, before);
}

const verify = (browser: TestBrowser, typed: string) =>
  browser.call(authEmailVerify, 'POST', '/api/v1/auth/email/verify', { code: typed });

async function accountOf(userId: string): Promise<boolean> {
  const [row] = await admin<{ account: boolean }[]>`
    select account_at is not null as account from game.profiles where user_id = ${userId}`;
  return row?.account ?? false;
}

/** A guest that linked an email: an account with that address. */
async function accountWith(email: string): Promise<Player> {
  const player = await newPlayer(deps);
  const answer = await verify(player.browser, await sendTo(player.browser, email));
  expect(answer.body).toStrictEqual({ outcome: 'signed_in' });
  return player;
}

describe('a guest adding an email', () => {
  it('becomes an account with the same id, keeping its name and its series', async () => {
    const guest = await newPlayer(deps);
    const friend = await newPlayer(deps);
    const series = await newSeries(deps, { a: guest, b: friend }, 'blind');
    const { body: before } = await guest.browser.call(me, 'GET', '/api/v1/me');
    expect(before).toMatchObject({ account: false });

    const sent = await sendTo(guest.browser, newEmail());
    expect((await verify(guest.browser, sent)).body).toStrictEqual({ outcome: 'signed_in' });

    expect(userIdOf(guest.browser.cookie ?? '')).toBe(guest.userId);
    expect(await accountOf(guest.userId)).toBe(true);
    const { body: after } = await guest.browser.call(me, 'GET', '/api/v1/me');
    expect(after).toStrictEqual({
      name: (before as { name: string }).name,
      account: true,
      username: null,
    });
    const [row] = await admin<{ player_a: string }[]>`
      select player_a from game.series where id = ${series}`;
    expect(row?.player_a).toBe(guest.userId);
  });

  it('is refused a wrong code, and the right one still works', async () => {
    const guest = await newPlayer(deps);
    const sent = await sendTo(guest.browser, newEmail());
    const wrong = await verify(guest.browser, otherThan(sent));
    expect([wrong.status, code(wrong.body)]).toStrictEqual([400, 'wrong_code']);
    expect(await accountOf(guest.userId)).toBe(false);
    expect((await verify(guest.browser, sent)).body).toStrictEqual({ outcome: 'signed_in' });
  });

  it('kills a code after 5 tries: the 6th is refused even when right', async () => {
    const guest = await newPlayer(deps);
    const sent = await sendTo(guest.browser, newEmail());
    for (let n = 0; n < 5; n += 1) {
      expect(code((await verify(guest.browser, otherThan(sent))).body)).toBe('wrong_code');
    }
    const sixth = await verify(guest.browser, sent);
    expect([sixth.status, code(sixth.body)]).toStrictEqual([400, 'wrong_code']);
    expect(errorOf(sixth.body)?.message).toBe('That code has expired: send a new one');
    expect(await accountOf(guest.userId)).toBe(false);
  });
});

describe('an address that already has an account', () => {
  it('gets the same answer as a new one, and its code offers to switch', async () => {
    const email = newEmail();
    const owner = await accountWith(email);
    const guest = await newPlayer(deps);
    const known = await guest.browser.call(authEmail, 'POST', '/api/v1/auth/email', { email });
    const other = await newPlayer(deps);
    const fresh = await other.browser.call(authEmail, 'POST', '/api/v1/auth/email', {
      email: newEmail(),
    });
    expect([known.status, known.body]).toStrictEqual([fresh.status, fresh.body]);

    const answer = await verify(guest.browser, await nextCode(email, 1));
    expect(answer.body).toStrictEqual({ outcome: 'switch' });
    // Nothing changed yet: still the guest, which is still a guest.
    expect(userIdOf(guest.browser.cookie ?? '')).toBe(guest.userId);
    expect(await accountOf(guest.userId)).toBe(false);

    const switched = await guest.browser.call(authSwitch, 'POST', '/api/v1/auth/switch', {});
    expect(switched.body).toStrictEqual({ outcome: 'signed_in' });
    expect(userIdOf(guest.browser.cookie ?? '')).toBe(owner.userId);
    const [gone] = await admin<{ n: number }[]>`
      select count(*)::int as n from auth.users where id = ${guest.userId}`;
    expect(gone?.n).toBe(0);
  });

  it('keeps the guest when the player stays', async () => {
    const email = newEmail();
    await accountWith(email);
    const guest = await newPlayer(deps);
    expect((await verify(guest.browser, await sendTo(guest.browser, email))).body).toStrictEqual({
      outcome: 'switch',
    });
    const stay = await guest.browser.call(authSwitch, 'DELETE', '/api/v1/auth/switch');
    expect(stay.status).toBe(204);
    const again = await guest.browser.call(authSwitch, 'POST', '/api/v1/auth/switch', {});
    expect(code(again.body)).toBe('sign_in_expired');
    expect((await guest.browser.call(me, 'GET', '/api/v1/me')).body).toMatchObject({
      account: false,
    });
  });
});

describe('a device without a guest', () => {
  it('needs the 16+ confirmation, sending nothing without it', async () => {
    const browser = new TestBrowser(deps, '198.51.100.40');
    const email = newEmail();
    const refused = await browser.call(authEmail, 'POST', '/api/v1/auth/email', { email });
    expect(code(refused.body)).toBe('age_unconfirmed');
    expect(await mailCount(email)).toBe(0);
  });

  it('signs in to a new account, or back in to its own', async () => {
    const email = newEmail();
    const first = new TestBrowser(deps, '198.51.100.41');
    expect((await verify(first, await sendTo(first, email, true))).body).toStrictEqual({
      outcome: 'signed_in',
    });
    const id = userIdOf(first.cookie ?? '');
    expect(await accountOf(id)).toBe(true);
    const second = new TestBrowser(deps, '198.51.100.42');
    await verify(second, await sendTo(second, email, true));
    expect(userIdOf(second.cookie ?? '')).toBe(id);
  });
});

describe('who may not sign in', () => {
  it('an account already signed in', async () => {
    const email = newEmail();
    const owner = await accountWith(email);
    const again = await owner.browser.call(authEmail, 'POST', '/api/v1/auth/email', {
      email: newEmail(),
    });
    expect([again.status, code(again.body)]).toStrictEqual([409, 'already_signed_in']);
  });

  it('anyone, while accounts are switched off', async () => {
    const config = configOf({
      ...process.env,
      BALLBATTLE_ONLINE: '1',
      DATABASE_URL: process.env['TEST_DATABASE_URL'],
      SUPABASE_URL: process.env['TEST_SUPABASE_URL'],
      SUPABASE_PUBLISHABLE_KEY: process.env['TEST_SUPABASE_PUBLISHABLE_KEY'],
      SUPABASE_SECRET_KEY: process.env['TEST_SUPABASE_SECRET_KEY'],
      SEED_KEYS: JSON.stringify({ test: Buffer.alloc(32, 7).toString('base64') }),
      BALLBATTLE_ACCOUNTS: undefined,
    });
    if (config === undefined) throw new Error('no config');
    const off: Deps = { ...deps, config };
    const browser = new TestBrowser(off, '198.51.100.43');
    const answer = await browser.call(authEmail, 'POST', '/api/v1/auth/email', {
      email: newEmail(),
      adult: true,
    });
    expect([answer.status, code(answer.body)]).toStrictEqual([404, 'accounts_off']);
  });
});
