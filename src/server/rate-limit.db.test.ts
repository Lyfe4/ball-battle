import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiError } from './http.ts';
import { ipSubject, LIMITS, purgeRateLimits, spend, waitWords } from './rate-limit.ts';
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

/** Spends `max` times, then once more: the refusal. */
async function spendUntilRefused(subject: string, over: typeof limit): Promise<ApiError> {
  for (let n = 0; n < over.max; n += 1) await spend(deps.sql, subject, over);
  const refused = await spend(deps.sql, subject, over).catch((error: unknown) => error);
  expect(refused).toBeInstanceOf(ApiError);
  return refused as ApiError;
}

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

  it('keys an IPv6 client on its /64, so changing the rest of the address makes no new count', async () => {
    const home = await ipSubject(deps.config, '2001:db8:aa:bb::1');
    expect(await ipSubject(deps.config, '2001:db8:aa:bb:dead:beef:0:7')).toBe(home);
    expect(await ipSubject(deps.config, '2001:db8:aa:bc::1')).not.toBe(home);
  });

  it('counts guests by the hour and by the day, the day the tighter over time', async () => {
    const day = await spendUntilRefused('net-day', { ...LIMITS.guestsDaily, max: 2 });
    expect(day.message).toMatch(/^Lots of new players on this network just now: try again in /);
    expect(Number(day.headers['Retry-After'])).toBeLessThanOrEqual(86_400);
    expect(LIMITS.guestsDaily.max).toBeLessThan(LIMITS.guests.max * 24);
    expect(LIMITS.guestsDaily.bucket).not.toBe(LIMITS.guests.bucket);
  });

  it('drops each window once it has ended, by its own length', async () => {
    await admin`delete from game.rate_limits`;
    const windowAgo = (bucket: string, seconds: number) => admin`
      insert into game.rate_limits (subject, bucket, window_start, count)
      values ('purge-test', ${bucket}, now() - make_interval(secs => ${seconds}), 1)`;
    // An hour's count of a network, ended a minute ago; one still running.
    await windowAgo(LIMITS.guests.bucket, 3_660);
    await windowAgo(LIMITS.guests.bucket, 1_800);
    // A day's count still running; a 5-minute read window ended.
    await windowAgo(LIMITS.guestsDaily.bucket, 3_660);
    await windowAgo(LIMITS.reads.bucket, 360);
    // A bucket no longer counted, kept a day.
    await windowAgo('retired', 3_660);
    await windowAgo('retired', 86_460);

    expect(await purgeRateLimits(deps.sql)).toBe(3);
    const left = await admin<{ bucket: string }[]>`
      select bucket from game.rate_limits where subject = 'purge-test' order by bucket`;
    expect(left.map((row) => row.bucket)).toStrictEqual([
      LIMITS.guests.bucket,
      LIMITS.guestsDaily.bucket,
      'retired',
    ]);
  });

  it('says how long to wait in words a player reads', () => {
    expect([waitWords(1), waitWords(60), waitWords(61), waitWords(3_540)]).toStrictEqual([
      '1 min',
      '1 min',
      '2 min',
      '59 min',
    ]);
    expect([waitWords(3_600), waitWords(3_601), waitWords(20_000)]).toStrictEqual([
      '1 h',
      '2 h',
      '6 h',
    ]);
  });
});
