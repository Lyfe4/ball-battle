// A game by turns runs out on time (ADR 0085, 0086), proved by moving the series back in time rather
// than setting its deadline by hand: a turn opens with TURN_HOURS to pick; a minute before then it
// is still open for both players (the one due sees "your turn", the other waits); a minute after,
// either player's read settles it by the database's clock, both see it forfeit to the one who
// waited, a late pick is refused, and each is told how it ended in their own words.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Accepted } from '../../api/challenges.ts';
import { errorOf } from '../../api/errors.ts';
import type { InboxResponse } from '../../api/friends.ts';
import { TURN_HOURS } from '../../api/series.ts';
import { befriend, newAccount } from '../test/friends-support.ts';
import { tokenOf, travel } from '../test/live-support.ts';
import { dueSides, LINEUP_3, leftOf, pick, read, type Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { challengeOne, challenges } from './challenges.ts';
import { meInbox } from './me.ts';

const on = testDeps({ BALLBATTLE_TURNS: '1' });
const admin = adminSql();
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
});
afterAll(async () => {
  await on.sql.end();
  await admin.end();
});

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

const inbox = async (player: Player): Promise<InboxResponse> => {
  const answer = await player.browser.call(meInbox, 'GET', '/api/v1/me/inbox');
  expect(answer.status, JSON.stringify(answer.body)).toBe(200);
  return answer.body as InboxResponse;
};

/** A Reveal Best of 3 by turns between two friends, accepted: the one due and the one waiting. */
async function started() {
  const me = await newAccount(on, admin);
  const friend = await newAccount(on, admin);
  const id = await befriend(admin, me, friend);
  const sent = await me.browser.call(challenges, 'POST', '/api/v1/challenges', {
    format: 'reveal',
    bestOf: 3,
    requestId: crypto.randomUUID(),
    live: false,
    lineup: LINEUP_3.a,
    friend: id,
  });
  const accepted = await friend.browser.call(
    challengeOne,
    'POST',
    `/api/v1/challenges/${tokenOf(sent)}/accept`,
    { lineup: LINEUP_3.b },
  );
  const seriesId = (accepted.body as Accepted).seriesId ?? '';
  const players = { a: me, b: friend };
  const side = dueSides(await read(me, seriesId))[0] ?? 'a';
  return {
    seriesId,
    side,
    due: players[side],
    waiting: players[side === 'a' ? 'b' : 'a'],
  };
}

describe('a game by turns runs out on time', () => {
  it('stays open until its deadline, then both players see it forfeit to the one who waited', async () => {
    const { seriesId, side, due, waiting } = await started();
    const [opened] = await admin<{ left_ms: number }[]>`
      select extract(epoch from (turn_deadline - now())) * 1000 as left_ms
      from game.series where id = ${seriesId}`;
    // The turn opened just now, with TURN_HOURS to pick.
    expect(Math.abs((opened?.left_ms ?? 0) - TURN_HOURS * HOUR_MS)).toBeLessThan(MINUTE_MS);

    // A minute before the deadline: open for both, the turn the due player's.
    await travel(admin, seriesId, TURN_HOURS * HOUR_MS - MINUTE_MS);
    const before = await read(waiting, seriesId);
    expect(before.status).toBe('open');
    expect(dueSides(await read(due, seriesId))).toStrictEqual([side]);
    expect((await inbox(due)).turns.map((turn) => turn.seriesId)).toStrictEqual([seriesId]);
    expect((await inbox(waiting)).games?.map((game) => game.seriesId)).toStrictEqual([seriesId]);

    // Two minutes on: a minute past it. The due player's inbox read settles it by the database's
    // clock: each is told how it ended in their own words, with no turn or game left to list.
    await travel(admin, seriesId, 2 * MINUTE_MS);
    const lost = await inbox(due);
    expect(lost.turns).toStrictEqual([]);
    expect(lost.endings?.map((ending) => ending.outcome)).toStrictEqual(['lost-ran-out']);
    const gained = await inbox(waiting);
    expect(gained.games).toStrictEqual([]);
    expect(gained.endings?.map((ending) => ending.outcome)).toStrictEqual(['won-ran-out']);
    // Both see the same end: forfeit, to the one who waited, for time.
    const won = side === 'a' ? 'b' : 'a';
    const mine = await read(due, seriesId);
    for (const seen of [await read(waiting, seriesId), mine]) {
      expect([seen.status, seen.winner]).toStrictEqual(['forfeit', won]);
    }
    const [row] = await admin<{ end_reason: string }[]>`
      select end_reason from game.series where id = ${seriesId}`;
    expect(row?.end_reason).toBe('timeout');
    // A pick after the end is refused.
    const late = await pick(due, seriesId, 0, leftOf(mine, side)[0] ?? '');
    expect(late.status).toBeGreaterThanOrEqual(400);
    expect(errorOf(late.body)?.code).toBeDefined();
  });
});
