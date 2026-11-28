import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { endpoint } from '../http.ts';
import { EVERYONE, LIMITS } from '../rate-limit.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { RULESET_VERSION } from '../current-ruleset.ts';
import { health, NEAR_DAILY, NEAR_MONTHLY } from './health.ts';

const deps = testDeps();
const admin = adminSql();
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
  await admin`delete from game.mail_sends`;
});
afterEach(() => {
  vi.unstubAllGlobals();
});
afterAll(async () => {
  await deps.sql.end();
  await admin.end();
});

describe('GET /api/v1/health', () => {
  it('reads the database as the API role and loads the current ruleset’s frozen bundle', async () => {
    const handler = endpoint(
      'health',
      health,
      () => deps,
      () => undefined,
    );
    const response = await handler(new Request('http://localhost/api/v1/health'));
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      status: 'ok',
      database: 'ok',
      auth: 'ok',
      ruleset: RULESET_VERSION,
      failed: [],
      emailCodes: 'ok',
      accounts: 'ok',
      accountsFailed: [],
      emailSends: 'ok',
      pokes: 'off',
      turns: deps.config.turns ? 'on' : 'off',
      dbMatchesUrl: true,
    });
  });

  it('says the poke and by-turns switches as this deploy runs them (2026-11-28 audit)', async () => {
    const on = testDeps({
      BALLBATTLE_POKE: '1',
      SUPABASE_BROWSER_KEY: 'sb_publishable_browser_test',
      BALLBATTLE_TURNS: '1',
    });
    const [was] = await admin<{ enabled: boolean }[]>`
      select enabled from game.flags where name = 'poke'`;
    const read = async () => {
      const handler = endpoint(
        'health',
        health,
        () => on,
        () => undefined,
      );
      const body = (await (
        await handler(new Request('http://localhost/api/v1/health'))
      ).json()) as {
        pokes: string;
        turns: string;
      };
      return { pokes: body.pokes, turns: body.turns };
    };
    try {
      await admin`update game.flags set enabled = true where name = 'poke'`;
      expect(await read()).toStrictEqual({ pokes: 'on', turns: 'on' });
      await admin`update game.flags set enabled = false where name = 'poke'`;
      expect(await read()).toStrictEqual({ pokes: 'off', turns: 'on' });
    } finally {
      await admin`update game.flags set enabled = ${was?.enabled ?? false} where name = 'poke'`;
      await on.sql.end();
    }
  });

  it('says whether its database is SUPABASE_URL’s project, and stays 200 when it isn’t', async () => {
    // Only the connection string differs: the checks still read the local database and Auth.
    const other =
      'postgresql://game_api_v2.abcdefghijklmnopqrst:x@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres';
    const handler = endpoint(
      'health',
      health,
      () => ({ ...deps, config: { ...deps.config, databaseUrl: other } }),
      () => undefined,
    );
    const response = await handler(new Request('http://localhost/api/v1/health'));
    const text = await response.text();
    expect(response.status).toBe(200);
    expect((JSON.parse(text) as { dbMatchesUrl: boolean }).dbMatchesUrl).toBe(false);
    expect(text).not.toContain('abcdefghijklmnopqrst');
    expect(text).not.toContain('game_api');
  });

  it('says a code email the relay refused today, and stays 200 (ADR 0082, the mail watch)', async () => {
    const handler = endpoint(
      'health',
      health,
      () => deps,
      () => undefined,
    );
    const sends = async () => {
      const response = await handler(new Request('http://localhost/api/v1/health'));
      return [response.status, ((await response.json()) as { emailSends: string }).emailSends];
    };
    await admin`insert into game.mail_sends (request_id, sent_at) values (-11, now() - interval '7 hours')`;
    expect(await sends()).toStrictEqual([200, 'unseen']);
    await admin`insert into game.mail_sends (request_id, answered, status_code) values (-12, true, 401)`;
    expect(await sends()).toStrictEqual([200, 'failing']);
    await admin`delete from game.mail_sends`;
    expect(await sends()).toStrictEqual([200, 'ok']);
  });

  it('names a sign-in setting that is wrong in `accounts`, and stays 200 (ADR 0079)', async () => {
    // Auth as it is, but with "Confirm email" off and no Google provider.
    const real = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const answer = await real(input, init);
      if (!String(input instanceof Request ? input.url : input).endsWith('/auth/v1/settings')) {
        return answer;
      }
      const settings = (await answer.json()) as { external: object };
      return Response.json({
        ...settings,
        mailer_autoconfirm: true,
        external: { ...settings.external, google: false },
      });
    });
    const handler = endpoint(
      'health',
      health,
      () => deps,
      () => undefined,
    );
    const response = await handler(new Request('http://localhost/api/v1/health'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'ok',
      auth: 'ok',
      failed: [],
      accounts: 'misconfigured',
      accountsFailed: ['auth_email_confirmations', 'auth_google'],
    });
  });

  it('says everyone’s email codes are near their cap at 70 today, and stays 200 (ADR 0079)', async () => {
    const handler = endpoint(
      'health',
      health,
      () => deps,
      () => undefined,
    );
    const codes = async () => {
      const response = await handler(new Request('http://localhost/api/v1/health'));
      return [response.status, ((await response.json()) as { emailCodes: string }).emailCodes];
    };
    const today = (count: number) => admin`
      insert into game.rate_limits (subject, bucket, window_start, count)
      values (${EVERYONE}, ${LIMITS.codesDaily.bucket},
        date_bin(interval '1 day', now(), timestamptz '2000-01-01'), ${count})
      on conflict (subject, bucket, window_start) do update set count = excluded.count`;
    await today(NEAR_DAILY - 1);
    expect(await codes()).toStrictEqual([200, 'ok']);
    await today(NEAR_DAILY);
    expect(await codes()).toStrictEqual([200, 'near']);
    await today(LIMITS.codesDaily.max);
    expect(await codes()).toStrictEqual([200, 'full']);
    await admin`delete from game.rate_limits where subject = ${EVERYONE}`;
    await admin`
      insert into game.rate_limits (subject, bucket, window_start, count)
      values (${EVERYONE}, ${LIMITS.codesMonthly.bucket}, date_trunc('month', now(), 'UTC'),
        ${NEAR_MONTHLY})`;
    expect(await codes()).toStrictEqual([200, 'near']);
    await admin`delete from game.rate_limits where subject = ${EVERYONE}`;
  });

  it('answers an uptime monitor every few minutes, and refuses a flood from one network', async () => {
    const handler = endpoint('health', health, () => deps);
    const ask = (ip: string) =>
      handler(new Request('http://localhost/api/v1/health'), { ip }).then(
        (answer) => answer.status,
      );
    for (let n = 0; n < 6; n += 1) expect(await ask('198.51.100.7')).toBe(200);
    await admin`
      update game.rate_limits set count = ${LIMITS.health.max} where bucket = ${LIMITS.health.bucket}`;
    expect(await ask('198.51.100.7')).toBe(429);
    expect(await ask('198.51.100.99')).toBe(200);
  });
});
