// The series read and the pick read the session's profile in their own statement (`sessionWith`,
// cost proposal decision 4): what `sessionOf` did in a query of its own must still hold. A deleted
// player's cookie is refused and nothing is counted or written for it, a series that isn't there is
// a 404, the reader is marked seen, and a pick counts against the moves limit, once.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorOf } from '../../api/errors.ts';
import { LIMITS } from '../rate-limit.ts';
import { TestBrowser } from '../test/client.ts';
import { leftOf, newPlayer, newSeries, pick, read, type Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { me } from './me.ts';
import { seriesOne } from './series.ts';

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

/** The rate-limit count of `player` in `bucket`, over every window. */
async function counted(player: Player, bucket: string): Promise<number> {
  const [row] = await admin<{ n: number }[]>`
    select coalesce(sum(count), 0)::int as n from game.rate_limits
    where subject = ${player.userId} and bucket = ${bucket}`;
  return row?.n ?? 0;
}

/** A Reveal series and the player whose pick is due first. */
async function started() {
  const players = { a: await newPlayer(deps), b: await newPlayer(deps) };
  const id = await newSeries(deps, players, 'reveal');
  const seen = await read(players.a, id);
  const side = seen.turn === 'b' ? ('b' as const) : ('a' as const);
  return { id, players, picker: players[side], ball: leftOf(seen, side)[0] ?? '' };
}

describe('a series read and a pick, with the session in the same statement', () => {
  it('refuse a deleted player’s old cookie, counting and writing nothing for it', async () => {
    const { id, players } = await started();
    const old = players.a.browser.cookie;
    /** Another tab of the deleted player's, with the cookie it still holds. */
    const tab = () => {
      const browser = new TestBrowser(deps);
      browser.cookie = old;
      return browser;
    };
    expect((await players.a.browser.call(me, 'DELETE', '/api/v1/me')).status).toBe(204);
    const before = await admin`select 1 from game.rate_limits where subject = ${players.a.userId}`;

    const reader = tab();
    const reading = await reader.call(seriesOne, 'GET', `/api/v1/series/${id}`);
    expect([reading.status, code(reading.body)]).toStrictEqual([401, 'unauthenticated']);
    expect(reader.cookie).toBeUndefined();
    const picking = await tab().call(seriesOne, 'POST', `/api/v1/series/${id}/picks`, {
      round: 0,
      ball: 'archer',
    });
    expect([picking.status, code(picking.body)]).toStrictEqual([401, 'unauthenticated']);
    const after = await admin`select 1 from game.rate_limits where subject = ${players.a.userId}`;
    expect(after.length).toBe(before.length);
  });

  it('answer 404 for a series that isn’t there, the read still counted', async () => {
    const player = await newPlayer(deps);
    const reads = await counted(player, LIMITS.reads.bucket);
    const answer = await player.browser.call(
      seriesOne,
      'GET',
      '/api/v1/series/00000000-0000-4000-8000-000000000000',
    );
    expect([answer.status, code(answer.body)]).toStrictEqual([404, 'not_found']);
    expect(await counted(player, LIMITS.reads.bucket)).toBe(reads + 1);
  });

  it('mark the reader seen, as every request does', async () => {
    const { id, players } = await started();
    await admin`
      update game.profiles set last_seen_at = now() - interval '3 days'
      where user_id = ${players.b.userId}`;
    await read(players.b, id);
    const [row] = await admin<{ fresh: boolean }[]>`
      select last_seen_at > now() - interval '1 minute' as fresh from game.profiles
      where user_id = ${players.b.userId}`;
    expect(row?.fresh).toBe(true);
  });

  it('count a pick against the moves limit once, and refuse one past it', async () => {
    const { id, picker, ball } = await started();
    const moves = await counted(picker, LIMITS.moves.bucket);
    const reads = await counted(picker, LIMITS.reads.bucket);
    expect((await pick(picker, id, 0, ball)).status).toBe(200);
    expect(await counted(picker, LIMITS.moves.bucket)).toBe(moves + 1);
    expect(await counted(picker, LIMITS.reads.bucket)).toBe(reads);

    await admin`
      update game.rate_limits set count = ${LIMITS.moves.max}
      where subject = ${picker.userId} and bucket = ${LIMITS.moves.bucket}`;
    const refused = await pick(picker, id, 0, ball);
    expect([refused.status, code(refused.body)]).toStrictEqual([429, 'rate_limited']);
    expect(Number(refused.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});
