// How real players use a series by turns (ADR 0052, section 10): double taps, two tabs, a slow
// connection, a dropped connection, a turn running out, and a player deleted mid-series.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorOf } from '../../api/errors.ts';
import type { SeriesSummary } from '../../api/series.ts';
import { sweep } from '../sweep.ts';
import { adminSql, testDeps } from '../test/support.ts';
import {
  leftOf,
  newPlayer,
  newSeries,
  pick,
  read,
  view,
  type Player,
} from '../test/series-support.ts';
import { me } from './me.ts';
import { seriesList, seriesOne } from './series.ts';

const deps = testDeps();
/** A second function instance, with its own connection. */
const other = testDeps();
const admin = adminSql();
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
});
afterAll(async () => {
  await deps.sql.end();
  await other.sql.end();
  await admin.end();
});

const code = (body: unknown) => errorOf(body)?.code;

/** A Reveal Best of 3 and the side that shows first (the toss). */
async function reveal() {
  const players = { a: await newPlayer(deps), b: await newPlayer(deps) };
  const id = await newSeries(deps, players, 'reveal');
  const seen = await read(players.a, id);
  const first = seen.turn === 'a' || seen.turn === 'b' ? seen.turn : 'a';
  const second = first === 'a' ? 'b' : 'a';
  return { players, id, first: players[first], second: players[second], showSide: first };
}

const storedPicks = (id: string) =>
  admin<{ round: number; side: string; ball: string }[]>`
    select round, side, ball from game.picks where series_id = ${id} order by round, side`;

describe('locking a pick', () => {
  it('twice (a double tap or a retry) stores one pick and answers the same both times', async () => {
    const { id, first, showSide } = await reveal();
    const ball = leftOf(await read(first, id), showSide)[0] ?? '';
    const one = view(await pick(first, id, 0, ball));
    const two = view(await pick(first, id, 0, ball));
    expect(two).toStrictEqual(one);
    expect(await storedPicks(id)).toHaveLength(1);
  });

  it('from two tabs at once, with different balls: the first lock wins and both see it', async () => {
    const { id, first, showSide } = await reveal();
    const [x, y] = leftOf(await read(first, id), showSide);
    const tab = { ...first, browser: first.browser.elsewhere(other) };
    const answers = await Promise.all([pick(first, id, 0, x ?? ''), pick(tab, id, 0, y ?? '')]);
    expect(answers.map((answer) => answer.status)).toStrictEqual([200, 200]);
    const stored = await storedPicks(id);
    expect(stored).toHaveLength(1);
    for (const answer of answers) {
      expect(view(answer).picks).toContainEqual({
        round: 0,
        side: showSide,
        ball: stored[0]?.ball,
      });
    }
  });

  it('that ends a round, from two instances at once: the round is played and stored once', async () => {
    const { id, first, second, showSide } = await reveal();
    const answerSide = showSide === 'a' ? 'b' : 'a';
    view(await pick(first, id, 0, leftOf(await read(first, id), showSide)[0] ?? ''));
    const [x, y] = leftOf(await read(second, id), answerSide);
    const tab = { ...second, browser: second.browser.elsewhere(other) };
    const answers = await Promise.all([pick(second, id, 0, x ?? ''), pick(tab, id, 0, y ?? '')]);
    expect(answers.map((answer) => answer.status)).toStrictEqual([200, 200]);
    const rounds = await admin`select 1 from game.rounds where series_id = ${id}`;
    expect(rounds).toHaveLength(1);
    const [one, two] = answers.map(view);
    expect(one?.version).toBe(two?.version);
  });

  it('out of turn, or for a round that is not due, is refused', async () => {
    const { id, second } = await reveal();
    const answer = await pick(second, id, 0, leftOf(await read(second, id), 'a')[0] ?? 'archer');
    expect(code(answer.body)).toBe('not_your_turn');
    expect(await storedPicks(id)).toHaveLength(0);
  });

  it('from a stale tab after the round played: the stored pick is answered, never a second', async () => {
    const { id, first, second, showSide } = await reveal();
    const answerSide = showSide === 'a' ? 'b' : 'a';
    const shown = leftOf(await read(first, id), showSide)[0] ?? '';
    view(await pick(first, id, 0, shown));
    const answered = leftOf(await read(second, id), answerSide)[0] ?? '';
    const played = view(await pick(second, id, 0, answered));
    expect(played.rounds).toHaveLength(1);
    // The other tab still shows round 1 and sends its pick again: the stored one comes back.
    expect(view(await pick(second, id, 0, answered)).version).toBe(played.version);
    // A different ball for that round gets the stored pick back (the first lock won).
    const other = leftOf(played, answerSide)[0] ?? '';
    const again = view(await pick(second, id, 0, other));
    expect(again.rounds[0]?.[answerSide]).toBe(answered);
    // Round 2 is shown by the side that answered round 1: the other side's pick is refused.
    const early = leftOf(played, showSide)[0] ?? '';
    expect(code((await pick(first, id, 1, early)).body)).toBe('not_your_turn');
  });

  it('refuses a ball the side has not got, and a series the player is not in', async () => {
    const { id, first, showSide } = await reveal();
    const notMine = showSide === 'a' ? 'brawler' : 'archer';
    expect(code((await pick(first, id, 0, notMine)).body)).toBe('bad_request');
    const stranger = await newPlayer(deps);
    expect((await pick(stranger, id, 0, 'archer')).status).toBe(404);
    expect((await stranger.browser.call(seriesOne, 'GET', `/api/v1/series/${id}`)).status).toBe(
      404,
    );
  });
});

describe('reading a series', () => {
  it('answers 304 to a tab whose copy is current, and the new state once it moved', async () => {
    const { id, first, showSide } = await reveal();
    const read1 = await first.browser.call(seriesOne, 'GET', `/api/v1/series/${id}`);
    const etag = read1.headers.get('ETag') ?? '';
    const again = await first.browser.call(seriesOne, 'GET', `/api/v1/series/${id}`, undefined, {
      'If-None-Match': etag,
    });
    expect(again.status).toBe(304);
    view(await pick(first, id, 0, leftOf(view(read1), showSide)[0] ?? ''));
    const moved = await first.browser.call(seriesOne, 'GET', `/api/v1/series/${id}`, undefined, {
      'If-None-Match': etag,
    });
    expect(moved.status).toBe(200);
  });

  it('after a dropped connection between lock and answer, shows the lock made', async () => {
    const { id, first, showSide } = await reveal();
    const ball = leftOf(await read(first, id), showSide)[0] ?? '';
    await pick(first, id, 0, ball); // The answer is "lost"; the player reconnects and reads.
    const seen = await read(first, id);
    expect(seen.picks).toContainEqual({ round: 0, side: showSide, ball });
    expect(seen.turn).not.toBe(showSide);
  });
});

/** Moves a series' deadline into the past, as 24 hours passing would. */
const expire = (id: string) =>
  admin`update game.series set turn_deadline = now() - interval '1 minute' where id = ${id}`;

describe('a turn running out', () => {
  it('forfeits the series to the other side when anyone reads it', async () => {
    const { id, first, second } = await reveal();
    const before = await read(second, id);
    expect(new Date(before.deadline ?? 0).getTime()).toBeGreaterThan(Date.now() + 23 * 3600_000);
    await expire(id);
    const after = await read(second, id);
    expect(after.status).toBe('forfeit');
    expect(after.winner).toBe(second === first ? null : after.you);
    expect(code((await pick(first, id, 0, 'archer')).body)).toBe('not_your_turn');
  });

  it('forfeits by the scheduled sweep too, and nobody wins when both missed Showdown’s opener', async () => {
    const players = { a: await newPlayer(deps), b: await newPlayer(deps) };
    const id = await newSeries(deps, players, 'showdown');
    await expire(id);
    expect((await sweep(deps)).forfeits).toBeGreaterThanOrEqual(1);
    const [row] = await admin<{ status: string; winner: string | null }[]>`
      select status, winner from game.series where id = ${id}`;
    expect(row).toStrictEqual({ status: 'forfeit', winner: null });
  });

  it('keeps the other side’s clock when one side locks Showdown’s opener first', async () => {
    const players = { a: await newPlayer(deps), b: await newPlayer(deps) };
    const id = await newSeries(deps, players, 'showdown');
    const before = (await read(players.a, id)).deadline;
    view(await pick(players.b, id, 0, 'frost'));
    const after = await read(players.a, id);
    expect(after.turn).toBe('a');
    expect(after.deadline).toBe(before);
  });
});

describe('a player deleted mid-series', () => {
  it('forfeits to the opponent, whose history keeps the series as "Deleted player"', async () => {
    const { players, id } = await reveal();
    expect((await players.b.browser.call(me, 'DELETE', '/api/v1/me')).status).toBe(204);
    const seen = await read(players.a, id);
    expect(seen.status).toBe('forfeit');
    expect(seen.winner).toBe('a');
    expect(seen.names.b).toBeNull();
    const list = (await players.a.browser.call(seriesList, 'GET', '/api/v1/series')).body as {
      series: SeriesSummary[];
    };
    expect(list.series.find((s) => s.id === id)).toMatchObject({
      opponent: null,
      status: 'forfeit',
    });
  });
});

describe('the series list', () => {
  it('puts series that are the player’s turn first', async () => {
    const a: Player = await newPlayer(deps);
    const b: Player = await newPlayer(deps);
    const waiting = await newSeries(deps, { a, b }, 'showdown');
    view(await pick(a, waiting, 0, 'archer'));
    const mine = await newSeries(deps, { a, b }, 'showdown');
    const list = (await a.browser.call(seriesList, 'GET', '/api/v1/series')).body as {
      series: SeriesSummary[];
    };
    expect(list.series.map((s) => [s.id, s.yourTurn])).toStrictEqual([
      [mine, true],
      [waiting, false],
    ]);
  });
});
