// The live match API against the local database, through the pooler (ADR 0053): the live view and
// the database's clock, the opponent shown away, "Leave and forfeit", Cancel in the lobby, home's
// "Back to your match", and the rate limit on reads.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ChallengeInfo } from '../../api/challenges.ts';
import { errorOf } from '../../api/errors.ts';
import { AWAY_AFTER_MS, GRACE_MS, NOW_HEADER, type CurrentMatchResponse } from '../../api/live.ts';
import type { Player } from '../test/series-support.ts';
import {
  acceptLink,
  playLink,
  linkInfo,
  liveRow,
  sendLive,
  silence,
  startedLive,
  tokenOf,
  travel,
} from '../test/live-support.ts';
import { newPlayer, newSeries, read, view } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { challengeOne } from './challenges.ts';
import { meMatch } from './me.ts';
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
const get = (player: Player, id: string, headers: Record<string, string> = {}) =>
  player.browser.call(seriesOne, 'GET', `/api/v1/series/${id}`, undefined, headers);
const leave = (player: Player, id: string) =>
  player.browser.call(seriesOne, 'POST', `/api/v1/series/${id}/forfeit`, {});
const cancel = (player: Player, token: string) =>
  player.browser.call(challengeOne, 'POST', `/api/v1/challenges/${token}/cancel`, {});
const matchOf = async (player: Player) => {
  const answer = await player.browser.call(meMatch, 'GET', '/api/v1/me/match');
  expect(answer.status).toBe(200);
  return (answer.body as CurrentMatchResponse).match;
};

describe('the live view', () => {
  it('carries the clock, and every answer the database’s time, a 304’s too', async () => {
    const { id, players } = await startedLive(deps, admin);
    const answer = await get(players.a, id);
    const seen = view(answer);
    const row = await liveRow(admin, id);
    expect(seen.live).toMatchObject({ startedAt: row.started, opensAt: row.opens, away: null });
    expect(seen.live?.fights).toStrictEqual([]);
    const now = Number(answer.headers.get(NOW_HEADER));
    expect(Math.abs(now - row.now)).toBeLessThan(5_000);
    const again = await get(players.a, id, { 'If-None-Match': answer.headers.get('ETag') ?? '' });
    expect(again.status).toBe(304);
    expect(Number(again.headers.get(NOW_HEADER))).toBeGreaterThanOrEqual(now);
  });

  it('names the picks made at random and the fights the server timed', async () => {
    const { id, players } = await startedLive(deps, admin, 'showdown');
    await travel(admin, id, 31_000);
    const seen = await read(players.b, id);
    expect(seen.live?.auto).toHaveLength(2);
    expect(seen.live?.fights).toHaveLength(1);
    const [fight] = seen.live?.fights ?? [];
    expect(seen.live?.opensAt).toBe(fight?.endsAt);
  });

  it('shows the opponent away after 6 s, with when they lose, and changes the ETag', async () => {
    const { id, players } = await startedLive(deps, admin);
    const before = await get(players.b, id);
    await silence(admin, id, 'a', AWAY_AFTER_MS + 1_000);
    const after = await get(players.b, id, { 'If-None-Match': before.headers.get('ETag') ?? '' });
    expect(after.status).toBe(200);
    const away = view(after).live?.away;
    expect(away).not.toBeNull();
    expect((away?.forfeitAt ?? 0) - (away?.since ?? 0)).toBe(AWAY_AFTER_MS + GRACE_MS);
    // A's own read is their heartbeat: back, and never shown away to themselves.
    expect((await read(players.a, id)).live?.away).toBeNull();
    expect((await read(players.b, id)).live?.away).toBeNull();
  });

  it('is null for a series by turns, which sends no clock', async () => {
    const players = { a: await newPlayer(deps), b: await newPlayer(deps) };
    const id = await newSeries(deps, players, 'reveal');
    const answer = await get(players.a, id);
    expect(view(answer).live).toBeNull();
    expect(answer.headers.get(NOW_HEADER)).toBeNull();
  });
});

describe('leave and forfeit', () => {
  it('ends the live series at once, the other player winning, and says why', async () => {
    const { id, players } = await startedLive(deps, admin);
    const left = view(await leave(players.a, id));
    expect(left).toMatchObject({ status: 'forfeit', winner: 'b' });
    expect(left.live?.endReason).toBe('left');
    expect(await read(players.b, id)).toMatchObject({ status: 'forfeit', winner: 'b' });
    // Twice (a double tap): the ended series, as it is.
    expect(view(await leave(players.a, id)).winner).toBe('b');
  });

  it('answers a series that already ended as it ended', async () => {
    const { id, players } = await startedLive(deps, admin);
    await silence(admin, id, 'b', 40_000);
    expect(view(await leave(players.a, id))).toMatchObject({ winner: 'a' });
    expect((await liveRow(admin, id)).end_reason).toBe('disconnected');
  });

  it('is only for live matches, and only for their players', async () => {
    const players = { a: await newPlayer(deps), b: await newPlayer(deps) };
    const byTurns = await newSeries(deps, players, 'reveal');
    expect(code((await leave(players.a, byTurns)).body)).toBe('not_your_turn');
    const { id } = await startedLive(deps, admin);
    expect((await leave(await newPlayer(deps), id)).status).toBe(404);
  });
});

describe('cancel in the lobby', () => {
  it('stops the link: the friend is told, can’t accept, and the sender can send another', async () => {
    const [sender, friend] = [await newPlayer(deps), await newPlayer(deps)];
    const token = tokenOf(await sendLive(sender));
    const cancelled = await cancel(sender, token);
    expect((cancelled.body as ChallengeInfo).status).toBe('stopped');
    expect((await linkInfo(friend, token)).body).toMatchObject({ status: 'stopped' });
    expect(code((await acceptLink(friend, token)).body)).toBe('challenge_stopped');
    expect((await sendLive(sender)).status).toBe(201);
  });

  it('after the friend accepted, answers the series to go to', async () => {
    const [sender, friend] = [await newPlayer(deps), await newPlayer(deps)];
    const token = tokenOf(await sendLive(sender));
    const id = await playLink(sender, friend, token);
    expect((await cancel(sender, token)).body).toMatchObject({ status: 'yours', seriesId: id });
  });

  it('is the sender’s alone', async () => {
    const sender = await newPlayer(deps);
    const token = tokenOf(await sendLive(sender));
    expect((await cancel(await newPlayer(deps), token)).status).toBe(404);
    expect((await linkInfo(await newPlayer(deps), token)).body).toMatchObject({ status: 'open' });
  });
});

describe('the match to go back to', () => {
  it('is the lobby, then the series for both, then nothing once it ends', async () => {
    const [sender, friend] = [await newPlayer(deps), await newPlayer(deps)];
    expect(await matchOf(sender)).toBeNull();
    const token = tokenOf(await sendLive(sender, 'showdown'));
    expect(await matchOf(sender)).toStrictEqual({
      kind: 'lobby',
      token,
      format: 'showdown',
      bestOf: 3,
      // A link to anyone waits for nobody by name (ADR 0086).
      invitee: null,
      // Home asks again when it would stop (ADR 0089 addendum of 2026-11-27).
      stopsInMs: expect.any(Number) as unknown,
    });
    const id = await playLink(sender, friend, token);
    for (const player of [sender, friend]) {
      expect(await matchOf(player)).toMatchObject({ kind: 'series', id, format: 'showdown' });
    }
    await leave(friend, id);
    expect(await matchOf(sender)).toBeNull();
    expect(await matchOf(friend)).toBeNull();
  });

  it('is gone once the player has been away past the grace period (asking from home is not being there)', async () => {
    const { id, players } = await startedLive(deps, admin);
    await silence(admin, id, 'a', 20_000);
    expect(await matchOf(players.a)).toMatchObject({ id });
    await silence(admin, id, 'a', AWAY_AFTER_MS + GRACE_MS + 1_000);
    expect(await matchOf(players.a)).toBeNull();
    expect(await liveRow(admin, id)).toMatchObject({ status: 'forfeit', winner: 'b' });
  });
});

describe('reads', () => {
  it('are rate limited per account, in the same statement as the read', async () => {
    const { id, players } = await startedLive(deps, admin);
    await admin`
      insert into game.rate_limits (subject, bucket, window_start, count)
      values (${players.a.userId}, 'read',
        date_bin('300 seconds'::interval, now(), timestamptz '2000-01-01'), 900)
      on conflict (subject, bucket, window_start) do update set count = 900`;
    const refused = await get(players.a, id);
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get('Retry-After'))).toBeGreaterThan(0);
    // The other player is counted on their own.
    expect((await get(players.b, id)).status).toBe(200);
  });
});
