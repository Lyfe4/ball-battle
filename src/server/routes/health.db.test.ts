import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { endpoint } from '../http.ts';
import { LIMITS } from '../rate-limit.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { RULESET_VERSION } from '../current-ruleset.ts';
import { health } from './health.ts';

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
    });
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
