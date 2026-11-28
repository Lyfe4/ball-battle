// Removing a friend while a challenge between the two waits (the overnight bug hunt of
// 2026-11-29): it ends as a block ends it. Without this, the banner of the challenge they sent
// stayed on the remover's home and could still be accepted, and the remover's own challenge kept
// calling on someone who is no longer a friend. A game by turns already started plays on.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorOf } from '../../api/errors.ts';
import type { InboxResponse } from '../../api/friends.ts';
import type { Answer } from '../test/client.ts';
import { befriend, newAccount } from '../test/friends-support.ts';
import type { Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { challengeOne, challenges } from './challenges.ts';
import { friendOne } from './friends.ts';
import { meInbox } from './me.ts';

const deps = testDeps({ BALLBATTLE_TURNS: '1' });
const admin = adminSql();
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
});
afterAll(async () => {
  await deps.sql.end();
  await admin.end();
});

const code = (answer: Answer) => [answer.status, errorOf(answer.body)?.code];
const inbox = async (player: Player): Promise<InboxResponse> => {
  const answer = await player.browser.call(meInbox, 'GET', '/api/v1/me/inbox');
  expect(answer.status).toBe(200);
  return answer.body as InboxResponse;
};
const challengeTo = (from: Player, friend: string, live = true) =>
  from.browser.call(challenges, 'POST', '/api/v1/challenges', {
    format: 'reveal',
    bestOf: 3,
    requestId: crypto.randomUUID(),
    live,
    friend,
    ...(live ? {} : { lineup: ['archer', 'brawler', 'frost'] }),
  });
const remove = (player: Player, id: string) =>
  player.browser.call(friendOne, 'DELETE', `/api/v1/friends/${id}`);

async function pair() {
  const me = await newAccount(deps, admin);
  const them = await newAccount(deps, admin);
  return { me, them, id: await befriend(admin, me, them) };
}

describe('removing a friend while a challenge waits', () => {
  it('ends theirs as a No thanks does: the banner goes and it can no longer be accepted', async () => {
    const { me, them, id } = await pair();
    const sent = await challengeTo(them, id);
    expect(sent.status).toBe(201);
    expect((await inbox(me)).invites).toHaveLength(1);
    expect((await remove(me, id)).status).toBe(200);
    expect((await inbox(me)).invites).toStrictEqual([]);
    const { token } = sent.body as { token: string };
    const accepted = await me.browser.call(
      challengeOne,
      'POST',
      `/api/v1/challenges/${token}/accept`,
      {},
    );
    expect(code(accepted)[0]).toBeGreaterThanOrEqual(400);
  });

  it('calls off the remover’s own: the ex-friend is no longer asked', async () => {
    const { me, them, id } = await pair();
    expect((await challengeTo(me, id)).status).toBe(201);
    expect((await inbox(them)).invites).toHaveLength(1);
    expect((await remove(me, id)).status).toBe(200);
    expect((await inbox(them)).invites).toStrictEqual([]);
  });

  it('ends a challenge by turns either way too, before it starts', async () => {
    const { me, them, id } = await pair();
    expect((await challengeTo(them, id, false)).status).toBe(201);
    expect((await inbox(me)).invites).toHaveLength(1);
    expect((await remove(me, id)).status).toBe(200);
    expect((await inbox(me)).invites).toStrictEqual([]);
  });
});
