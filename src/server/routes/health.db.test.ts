import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { endpoint } from '../http.ts';
import { EVERYONE, LIMITS } from '../rate-limit.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { RULESET_VERSION } from '../current-ruleset.ts';
import { health, NEAR_DAILY, NEAR_MONTHLY } from './health.ts';

const deps = testDeps();
const admin = adminSql();
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
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
