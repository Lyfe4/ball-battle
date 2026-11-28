// Reads counted one in ten, as ten (read-count.ts): a read that only looks writes nothing, one that
// counts adds ten, and both are refused once the window is over, on each of the three ways a read
// is counted (on its own, with the series read, with the record read). A pick still counts its
// move exactly.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorOf } from '../api/errors.ts';
import { loadRecord } from './db/record.ts';
import type { Deps } from './http.ts';
import { LIMITS } from './rate-limit.ts';
import { meMatch } from './routes/me.ts';
import { seriesOne } from './routes/series.ts';
import { TestBrowser } from './test/client.ts';
import { leftOf, newPlayer, newSeries, pick, read, type Player } from './test/series-support.ts';
import { adminSql, testDeps } from './test/support.ts';

const looks: Deps = { ...testDeps(), readWeight: () => 0 };
const counts: Deps = { ...testDeps(), readWeight: () => 10 };
const admin = adminSql();
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
});
afterAll(async () => {
  await Promise.all([looks.sql.end(), counts.sql.end(), admin.end()]);
});

const code = (body: unknown) => errorOf(body)?.code;

/** `player`'s rate-limit rows in `bucket`: how many, and their sum. */
async function rowsOf(player: Player, bucket: string) {
  const [row] = await admin<{ rows: number; sum: number }[]>`
    select count(*)::int as rows, coalesce(sum(count), 0)::int as sum from game.rate_limits
    where subject = ${player.userId} and bucket = ${bucket}`;
  return row ?? { rows: 0, sum: 0 };
}

/** The same player's cookie in a browser on other deps (another weight). */
function as(player: Player, deps: Deps): Player {
  const browser = new TestBrowser(deps);
  browser.cookie = player.browser.cookie;
  return { browser, userId: player.userId };
}

/** Fills `player`'s reads window to `count`, now and the next (a test crossing the line). */
async function filled(player: Player, count: number): Promise<void> {
  await admin`
    insert into game.rate_limits (subject, bucket, window_start, count)
    select ${player.userId}, ${LIMITS.reads.bucket}, w, ${count}
    from (values (date_bin('300 seconds', now(), timestamptz '2000-01-01')),
      (date_bin('300 seconds', now(), timestamptz '2000-01-01') + interval '300 seconds')) as x(w)
    on conflict (subject, bucket, window_start) do update set count = excluded.count`;
}

async function reveal(deps: Deps) {
  const players = { a: await newPlayer(deps), b: await newPlayer(deps) };
  const id = await newSeries(deps, players, 'reveal');
  return { id, players };
}

describe('a counted read, one in ten', () => {
  it('writes nothing when it only looks, on its own and with the series read', async () => {
    const { id, players } = await reveal(looks);
    for (let n = 0; n < 5; n += 1) {
      expect((await players.a.browser.call(meMatch, 'GET', '/api/v1/me/match')).status).toBe(200);
      await read(players.a, id);
    }
    expect(await rowsOf(players.a, LIMITS.reads.bucket)).toStrictEqual({ rows: 0, sum: 0 });
  });

  it('adds ten when it counts', async () => {
    const { id, players } = await reveal(looks);
    const counting = as(players.a, counts);
    expect((await counting.browser.call(meMatch, 'GET', '/api/v1/me/match')).status).toBe(200);
    await read(counting, id);
    expect(await rowsOf(players.a, LIMITS.reads.bucket)).toStrictEqual({ rows: 1, sum: 20 });
  });

  it('is refused once the window is over, whether it counts or only looks', async () => {
    const { id, players } = await reveal(looks);
    await filled(players.a, LIMITS.reads.max);
    // At the line: a look passes, as the 900th read did.
    expect((await players.a.browser.call(meMatch, 'GET', '/api/v1/me/match')).status).toBe(200);
    // A counted read takes it over, and is refused.
    const over = await as(players.a, counts).browser.call(meMatch, 'GET', '/api/v1/me/match');
    expect([over.status, code(over.body)]).toStrictEqual([429, 'rate_limited']);
    // Then every read is, counted or not: a loop is stopped on each request, not one in ten.
    const looking = await players.a.browser.call(meMatch, 'GET', '/api/v1/me/match');
    expect([looking.status, code(looking.body)]).toStrictEqual([429, 'rate_limited']);
    expect(Number(looking.headers.get('Retry-After'))).toBeGreaterThan(0);
    const series = await players.a.browser.call(seriesOne, 'GET', `/api/v1/series/${id}`);
    expect([series.status, code(series.body)]).toStrictEqual([429, 'rate_limited']);
  });

  it('counts with the record read the same way', async () => {
    const player = await newPlayer(looks);
    const looking = { limit: LIMITS.reads, weight: 0 };
    expect((await loadRecord(looks.sql, player.userId, looking)).spent?.count).toBe(0);
    expect(await rowsOf(player, LIMITS.reads.bucket)).toStrictEqual({ rows: 0, sum: 0 });
    const counting = { limit: LIMITS.reads, weight: 10 };
    expect((await loadRecord(looks.sql, player.userId, counting)).spent?.count).toBe(10);
    expect((await loadRecord(looks.sql, player.userId, looking)).spent?.count).toBe(10);
    expect(await rowsOf(player, LIMITS.reads.bucket)).toStrictEqual({ rows: 1, sum: 10 });
  });

  it('leaves a pick counted exactly once against the moves limit', async () => {
    const { id, players } = await reveal(looks);
    const seen = await read(players.a, id);
    const side = seen.turn === 'b' ? ('b' as const) : ('a' as const);
    const picker = players[side];
    const before = await rowsOf(picker, LIMITS.moves.bucket);
    expect((await pick(picker, id, 0, leftOf(seen, side)[0] ?? '')).status).toBe(200);
    expect((await rowsOf(picker, LIMITS.moves.bucket)).sum).toBe(before.sum + 1);
  });
});
