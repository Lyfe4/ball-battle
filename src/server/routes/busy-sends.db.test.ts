// One game at a time (ADR 0089 addendum of 2026-11-27, the setup phase), against the local
// database: while a player is picking lineups (a live start) or in a live match, every challenge
// they send and every other challenge they accept is refused (`in_a_match`), live or by turns,
// whatever their page shows; and two players never have two open challenges, or a live start and a
// challenge, between them at once, in either direction (`their_challenge_waiting`,
// `playing_together`). An open series by turns between them never blocks a live match.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Accepted } from '../../api/challenges.ts';
import { errorOf } from '../../api/errors.ts';
import type { CurrentMatchResponse } from '../../api/live.ts';
import type { InboxResponse } from '../../api/friends.ts';
import { befriend, newAccount } from '../test/friends-support.ts';
import { tokenOf } from '../test/live-support.ts';
import { LINEUP_3, type Player } from '../test/series-support.ts';
import type { Answer } from '../test/client.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { startOne } from './starts.ts';
import { challengeOne, challenges } from './challenges.ts';
import { meInbox, meMatch } from './me.ts';

const deps = testDeps({ BALLBATTLE_TURNS: '1' });
const admin = adminSql();

beforeAll(async () => {
  await admin`delete from game.rate_limits`;
});
afterAll(async () => {
  await deps.sql.end();
  await admin.end();
});

const account = () => newAccount(deps, admin);
const code = (answer: Answer) => errorOf(answer.body)?.code;

function send(from: Player, friend: string | undefined, live: boolean) {
  return from.browser.call(challenges, 'POST', '/api/v1/challenges', {
    format: 'reveal',
    bestOf: 3,
    requestId: crypto.randomUUID(),
    live,
    ...(live ? {} : { lineup: LINEUP_3.a }),
    ...(friend === undefined ? {} : { friend }),
  });
}
const accept = (player: Player, token: string, live: boolean) =>
  player.browser.call(
    challengeOne,
    'POST',
    `/api/v1/challenges/${token}/accept`,
    live ? {} : { lineup: LINEUP_3.b },
  );
const inboxOf = async (player: Player) =>
  (await player.browser.call(meInbox, 'GET', '/api/v1/me/inbox')).body as InboxResponse;
const matchOf = async (player: Player) =>
  ((await player.browser.call(meMatch, 'GET', '/api/v1/me/match')).body as CurrentMatchResponse)
    .match;

/** How many challenges `player` has sent that still wait. */
async function waitingFrom(player: Player): Promise<number> {
  const [row] = await admin<{ count: number }[]>`
    select count(*)::int as count from game.challenges
    where creator = ${player.userId} and cancelled_at is null and series_id is null
      and start_id is null`;
  return row?.count ?? 0;
}

/** Sam and Jo picking lineups together (Jo accepted Sam's live challenge); Robin, everyone's friend. */
async function inALineup() {
  const sam = await account();
  const jo = await account();
  const robin = await account();
  const samJo = await befriend(admin, sam, jo);
  const samRobin = await befriend(admin, sam, robin);
  const joRobin = await befriend(admin, jo, robin);
  const accepted = await accept(jo, tokenOf(await send(sam, samJo, true)), true);
  const startId = (accepted.body as Accepted).startId ?? '';
  expect(startId).toEqual(expect.any(String));
  expect(startId).not.toBe('');
  return { sam, jo, robin, samJo, samRobin, joRobin, startId };
}

/** Both lock in: the start becomes its live series. */
async function lockBoth(sam: Player, jo: Player, startId: string): Promise<void> {
  for (const [player, lineup] of [
    [sam, LINEUP_3.a],
    [jo, LINEUP_3.b],
  ] as const) {
    await player.browser.call(startOne, 'POST', `/api/v1/starts/${startId}`, {
      lineup,
      lock: true,
      seq: 1,
    });
  }
}

/** The send was refused as `expected`, and nothing new waits from `from`. */
async function refused(answer: Answer, from: Player, expected: string): Promise<void> {
  expect({ status: answer.status, code: code(answer) }).toStrictEqual({
    status: 409,
    code: expected,
  });
  expect(await waitingFrom(from)).toBe(0);
}

describe('while picking lineups, no player starts anything else', () => {
  for (const live of [true, false]) {
    const how = live ? 'live' : 'by turns';
    it(`the sender can't challenge the same friend again, ${how}, either way round`, async () => {
      const { sam, jo, samJo } = await inALineup();
      await refused(await send(sam, samJo, live), sam, 'in_a_match');
      await refused(await send(jo, samJo, live), jo, 'in_a_match');
      expect(await matchOf(sam)).toMatchObject({ kind: 'start' });
      expect(await matchOf(jo)).toMatchObject({ kind: 'start' });
    });

    it(`neither can challenge another friend, ${how}, nor send a link`, async () => {
      const { sam, jo, robin, samRobin, joRobin } = await inALineup();
      await refused(await send(sam, samRobin, live), sam, 'in_a_match');
      await refused(await send(jo, joRobin, live), jo, 'in_a_match');
      await refused(await send(sam, undefined, live), sam, 'in_a_match');
      expect((await inboxOf(robin)).invites).toStrictEqual([]);
    });

    it(`neither can accept another friend's challenge, ${how}`, async () => {
      const { sam, jo, robin, samRobin, joRobin, startId } = await inALineup();
      // Robin isn't busy, so Robin's challenges go out; Sam and Jo can't take them.
      const toSam = await send(robin, samRobin, live);
      expect(toSam.status).toBe(201);
      const samTook = await accept(sam, tokenOf(toSam), live);
      expect({ status: samTook.status, code: code(samTook) }).toStrictEqual({
        status: 409,
        code: 'in_a_match',
      });
      const toJo = await send(robin, joRobin, live);
      const joTook = await accept(jo, tokenOf(toJo), live);
      expect(code(joTook)).toBe('in_a_match');
      // The lineups go on untouched.
      expect(await matchOf(sam)).toMatchObject({ kind: 'start', id: startId });
      expect(await matchOf(jo)).toMatchObject({ kind: 'start', id: startId });
    });
  }

  it('the same holds once the lineups became the live match', async () => {
    const { sam, jo, robin, samJo, samRobin, startId } = await inALineup();
    await lockBoth(sam, jo, startId);
    expect(await matchOf(sam)).toMatchObject({ kind: 'series' });
    await refused(await send(sam, samJo, false), sam, 'in_a_match');
    await refused(await send(sam, samRobin, false), sam, 'in_a_match');
    const toJo = await send(robin, undefined, false);
    expect(code(await accept(jo, tokenOf(toJo), false))).toBe('in_a_match');
  });
});

describe('two players have one thing between them at a time', () => {
  it('a challenge waiting from a friend is answered, not crossed with another', async () => {
    const sam = await account();
    const jo = await account();
    const samJo = await befriend(admin, sam, jo);
    // Jo challenged Sam by turns; Sam can't send Jo a second challenge either way.
    expect((await send(jo, samJo, false)).status).toBe(201);
    await refused(await send(sam, samJo, false), sam, 'their_challenge_waiting');
    await refused(await send(sam, samJo, true), sam, 'their_challenge_waiting');
    // Jo's live lobby for Sam: a live send is the accept (crossed); by turns is refused.
    const lobby = await send(jo, samJo, true);
    expect(lobby.status).toBe(201);
    await refused(await send(sam, samJo, false), sam, 'their_challenge_waiting');
    expect((await inboxOf(sam)).invites).toHaveLength(1);
  });

  it('a series by turns together blocks another by turns, never a live match', async () => {
    const sam = await account();
    const jo = await account();
    const samJo = await befriend(admin, sam, jo);
    const accepted = await accept(jo, tokenOf(await send(sam, samJo, false)), false);
    expect((accepted.body as Accepted).seriesId).toEqual(expect.any(String));
    await refused(await send(sam, samJo, false), sam, 'playing_together');
    await refused(await send(jo, samJo, false), jo, 'playing_together');
    // A link by turns from Sam, opened by Jo: the same pair, refused at the accept.
    const link = await send(sam, undefined, false);
    expect(code(await accept(jo, tokenOf(link), false))).toBe('playing_together');
    // Live is still fine: a match now, beside the game by turns.
    const live = await send(sam, samJo, true);
    expect(live.status).toBe(201);
    expect((await accept(jo, tokenOf(live), true)).status).toBe(200);
  });
});
