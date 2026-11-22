// Email codes' limits (ADR 0079), counted before Auth is asked: everyone's caps under Resend
// Free's answer `email_busy` alike for every player and address; one network gets a fifth of the
// day; nobody signs in during a live match or lobby. The counts are set straight in the table
// rather than spent on real emails.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { errorOf } from '../../api/errors.ts';
import { AWAY_AFTER_MS, GRACE_MS } from '../../api/live.ts';
import {
  EMAIL_BUSY,
  emailSubject,
  EVERYONE,
  ipSubject,
  LIMITS,
  type Limit,
} from '../rate-limit.ts';
import { TestBrowser } from '../test/client.ts';
import { liveRow, silence, startedLive } from '../test/live-support.ts';
import { mailCount, newEmail, nextCode } from '../test/mail.ts';
import { newPlayer } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { authEmail, authEmailVerify } from './auth.ts';

const deps = testDeps();
const admin = adminSql();
beforeEach(async () => {
  await admin`delete from game.rate_limits`;
});
afterAll(async () => {
  await deps.sql.end();
  await admin.end();
});

/** `subject` has already spent `count` of `limit`'s current window. */
async function spent(subject: string, limit: Limit, count: number): Promise<void> {
  await admin`
    insert into game.rate_limits (subject, bucket, window_start, count)
    values (${subject}, ${limit.bucket},
      ${limit.calendarMonth === true ? admin`date_trunc('month', now(), 'UTC')` : admin`date_bin(make_interval(secs => ${limit.windowSeconds}), now(), timestamptz '2000-01-01')`},
      ${count})`;
}

const send = (browser: TestBrowser, email: string, adult?: true) =>
  browser.call(authEmail, 'POST', '/api/v1/auth/email', { email, adult });

describe('everyone’s codes', () => {
  it('answer email_busy at the day’s 91st, for a guest and a new device alike, sending nothing', async () => {
    await spent(EVERYONE, LIMITS.codesDaily, LIMITS.codesDaily.max);
    const guest = await newPlayer(deps);
    const email = newEmail();
    const answers = [
      await send(guest.browser, email),
      await send(new TestBrowser(deps, '198.51.100.60'), newEmail(), true),
    ];
    for (const answer of answers) {
      expect([answer.status, errorOf(answer.body)]).toStrictEqual([
        503,
        { code: 'email_busy', message: EMAIL_BUSY },
      ]);
    }
    expect(await mailCount(email)).toBe(0);
  });

  it('answer email_busy past the month’s 2,700', async () => {
    await spent(EVERYONE, LIMITS.codesMonthly, LIMITS.codesMonthly.max);
    const answer = await send(new TestBrowser(deps, '198.51.100.61'), newEmail(), true);
    expect([answer.status, errorOf(answer.body)?.code]).toStrictEqual([503, 'email_busy']);
  });

  it('are not spent by a request one player’s own limit refused', async () => {
    const browser = new TestBrowser(deps, '198.51.100.62');
    await spent(await ipSubject(deps.config, browser.ip), LIMITS.codesFromNetworkDaily, 20);
    await send(browser, newEmail(), true);
    const [row] = await admin<{ n: number }[]>`
      select count(*)::int as n from game.rate_limits where subject = ${EVERYONE}`;
    expect(row?.n).toBe(0);
  });
});

describe('one network', () => {
  it('is refused its 21st code of the day, with Google offered', async () => {
    const browser = new TestBrowser(deps, '198.51.100.63');
    await spent(await ipSubject(deps.config, browser.ip), LIMITS.codesFromNetworkDaily, 20);
    const email = newEmail();
    const answer = await send(browser, email, true);
    expect(answer.status).toBe(429);
    expect(errorOf(answer.body)?.message).toMatch(/^Lots of email sign-ins on this network/);
    expect(errorOf(answer.body)?.message).toContain('continue with Google');
    expect(await mailCount(email)).toBe(0);
    // Another network still gets its code.
    const elsewhere = new TestBrowser(deps, '198.51.100.64');
    expect((await send(elsewhere, newEmail(), true)).status).toBe(202);
  });
});

describe('one address', () => {
  it('gets 3 codes an hour, from any network', async () => {
    const email = newEmail();
    await spent(await emailSubject(deps.config, email), LIMITS.codesToAddress, 3);
    const fourth = await send(new TestBrowser(deps, '198.51.100.73'), email, true);
    expect(fourth.status).toBe(429);
    expect(errorOf(fourth.body)?.message).toMatch(/^We've sent a few codes to that address/);
    expect(await mailCount(email)).toBe(0);
  });
});

describe('during a live match', () => {
  it('a sign-in is refused at the start, sending nothing', async () => {
    const { players } = await startedLive(deps, admin);
    const email = newEmail();
    const answer = await send(players.a.browser, email);
    expect([answer.status, errorOf(answer.body)?.code]).toStrictEqual([409, 'in_a_match']);
    expect(await mailCount(email)).toBe(0);
  });

  it('a live match both players left is settled first, and no longer refuses', async () => {
    const { id, players } = await startedLive(deps, admin);
    for (const side of ['a', 'b'] as const) {
      await silence(admin, id, side, AWAY_AFTER_MS + GRACE_MS + 1_000);
    }
    expect((await send(players.a.browser, newEmail())).status).toBe(202);
    expect((await liveRow(admin, id)).status).toBe('forfeit');
  });

  it('and at the end, when the match began after the code was sent', async () => {
    const guest = await newPlayer(deps);
    const email = newEmail();
    expect((await send(guest.browser, email)).status).toBe(202);
    const sent = await nextCode(email);
    // The guest starts a live match before typing the code.
    await admin`
      update game.series set player_a = ${guest.userId}
      where id = (${(await startedLive(deps, admin)).id})::uuid`;
    const answer = await guest.browser.call(authEmailVerify, 'POST', '/api/v1/auth/email/verify', {
      code: sent,
    });
    expect([answer.status, errorOf(answer.body)?.code]).toStrictEqual([409, 'in_a_match']);
    const [row] = await admin<{ account: boolean }[]>`
      select account_at is not null as account from game.profiles where user_id = ${guest.userId}`;
    expect(row?.account).toBe(false);
  });
});
