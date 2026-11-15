import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiError } from './http.ts';
import { ipSubject, spend } from './rate-limit.ts';
import { adminSql, testDeps } from './test/support.ts';

const deps = testDeps();
const admin = adminSql();
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
});
afterAll(async () => {
  await deps.sql.end();
  await admin.end();
});

const limit = { bucket: 'test', max: 3, windowSeconds: 3600 };

describe('a rate limit', () => {
  it('lets the limit through, then refuses with how long to wait', async () => {
    for (let n = 0; n < 3; n += 1) await spend(deps.sql, 'player-1', limit);
    const refused = await spend(deps.sql, 'player-1', limit).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(ApiError);
    const { status, code, headers } = refused as ApiError;
    expect([status, code]).toStrictEqual([429, 'rate_limited']);
    expect(Number(headers['Retry-After'])).toBeGreaterThan(0);
    expect(Number(headers['Retry-After'])).toBeLessThanOrEqual(3600);
  });

  it('counts each subject on its own, on every host alike (one count in the database)', async () => {
    // Three hosts at once, each with its own connection (one connection never sends two at once).
    const hosts = [0, 1, 2].map(() => testDeps());
    await Promise.all(hosts.map((host) => spend(host.sql, 'player-2', limit)));
    await Promise.all(hosts.map((host) => host.sql.end()));
    await expect(spend(deps.sql, 'player-3', limit)).resolves.toBeUndefined();
    await expect(spend(deps.sql, 'player-2', limit)).rejects.toThrow(ApiError);
  });

  it('keys guest creation on an IP it never stores', async () => {
    const subject = await ipSubject(deps.config, '203.0.113.77');
    expect(subject).toMatch(/^ip:[0-9a-f]{32}$/);
    expect(subject).not.toContain('203');
    expect(await ipSubject(deps.config, '203.0.113.77')).toBe(subject);
    expect(await ipSubject(deps.config, '203.0.113.78')).not.toBe(subject);
  });
});
