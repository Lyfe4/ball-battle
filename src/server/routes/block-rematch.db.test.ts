// A block after a live match (the overnight bug hunt of 2026-11-29): the blocked player can never
// reach the blocker again (ADR 0079 addendum of 2026-11-25), and a rematch is a way to reach them.
// A block ends a rematch offer still waiting either way, and neither can ask one afterwards.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorOf } from '../../api/errors.ts';
import type { RematchView } from '../../api/rematch.ts';
import type { SeriesView } from '../../api/series.ts';
import { befriend, makeAccount } from '../test/friends-support.ts';
import { startedLive } from '../test/live-support.ts';
import type { Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { friendOne } from './friends.ts';
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

const rematch = (player: Player, id: string, body?: unknown) =>
  player.browser.call(
    seriesOne,
    body === undefined ? 'GET' : 'POST',
    `/api/v1/series/${id}/rematch`,
    body,
  );
const block = (player: Player, friendship: string) =>
  player.browser.call(friendOne, 'POST', `/api/v1/friends/${friendship}/block`, {});

/** Two friends whose live match just ended (A left it); the friendship's id. */
async function endedBetweenFriends() {
  const made = await startedLive(deps, admin);
  const { a, b } = made.players;
  await makeAccount(admin, a);
  await makeAccount(admin, b);
  const friendship = await befriend(admin, a, b);
  const left = await a.browser.call(seriesOne, 'POST', `/api/v1/series/${made.id}/forfeit`, {});
  expect((left.body as SeriesView).status).toBe('forfeit');
  return { id: made.id, a, b, friendship };
}

describe('a block after a live match', () => {
  it('ends the blocked player’s rematch offer: the blocker can’t be taken into lineups', async () => {
    const { id, a, b, friendship } = await endedBetweenFriends();
    expect((await rematch(b, id, { answer: 'yes' })).status).toBe(200);
    expect(((await rematch(a, id)).body as RematchView).state).toBe('asked');
    expect((await block(a, friendship)).status).toBe(200);
    expect(((await rematch(a, id)).body as RematchView).state).not.toBe('asked');
    const yes = await rematch(a, id, { answer: 'yes' });
    expect((yes.body as RematchView).startId ?? null).toBeNull();
  });

  it('lets the blocked player ask no rematch of the blocker', async () => {
    const { id, a, b, friendship } = await endedBetweenFriends();
    expect((await block(a, friendship)).status).toBe(200);
    const asked = await rematch(b, id, { answer: 'yes' });
    expect(asked.status, JSON.stringify(asked.body)).toBe(409);
    expect(errorOf(asked.body)?.code).toBe('rematch_closed');
    expect(((await rematch(a, id)).body as RematchView).state).not.toBe('asked');
  });
});
