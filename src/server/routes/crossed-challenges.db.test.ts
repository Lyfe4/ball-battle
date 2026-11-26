// Crossed challenges and a blocked sender's link (ADR 0086), against the local database: two friends
// who challenge each other merge on Accept (the acceptor's own lobby is cancelled in the same
// transaction, the other's lobby moves on to the lineups), both accepting at once make one pair of
// lineups and never deadlock, and a player who blocked the sender sees so on the card and can't
// accept, while the sender learns nothing.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Accepted, ChallengeInfo } from '../../api/challenges.ts';
import { errorOf } from '../../api/errors.ts';
import type { CurrentMatchResponse } from '../../api/live.ts';
import type { InboxResponse } from '../../api/friends.ts';
import { befriend, newAccount } from '../test/friends-support.ts';
import { linkInfo, tokenOf } from '../test/live-support.ts';
import type { Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { challengeOne, challenges } from './challenges.ts';
import { friendOne } from './friends.ts';
import { meInbox, meMatch } from './me.ts';

const deps = testDeps();
/** A second function instance, with its own connection: two phones at once. */
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

const account = () => newAccount(deps, admin);
const code = (body: unknown) => errorOf(body)?.code;
const challengeTo = (from: Player, friend: string) =>
  from.browser.call(challenges, 'POST', '/api/v1/challenges', {
    format: 'reveal',
    bestOf: 3,
    requestId: crypto.randomUUID(),
    live: true,
    friend,
  });
const accept = (player: Player, token: string) =>
  player.browser.call(challengeOne, 'POST', `/api/v1/challenges/${token}/accept`, {});
const inboxOf = async (player: Player) =>
  (await player.browser.call(meInbox, 'GET', '/api/v1/me/inbox')).body as InboxResponse;
const matchOf = async (player: Player) =>
  ((await player.browser.call(meMatch, 'GET', '/api/v1/me/match')).body as CurrentMatchResponse)
    .match;

/** Two friends, each with a live challenge out to the other: Sam's to Jo, then Jo's to Sam. */
async function crossed() {
  const sam = await account();
  const jo = await account();
  const id = await befriend(admin, sam, jo);
  const samsLink = tokenOf(await challengeTo(sam, id));
  const josLink = tokenOf(await challengeTo(jo, id));
  return { sam, jo, samsLink, josLink };
}

describe('crossed challenges', () => {
  it('merge on Accept: the acceptor’s lobby goes, and both are in one pair of lineups', async () => {
    const { sam, jo, samsLink, josLink } = await crossed();
    expect((await matchOf(jo))?.kind).toBe('lobby');
    // Jo accepts Sam's challenge although Jo's own lobby waits for Sam.
    const taken = await accept(jo, samsLink);
    expect(taken.status).toBe(200);
    const { startId } = taken.body as Accepted;
    expect(startId).not.toBeNull();
    // Jo's lobby was cancelled in the same transaction: gone from Sam's inbox, stopped to Jo.
    expect((await inboxOf(sam)).invites).toStrictEqual([]);
    expect(((await linkInfo(jo, josLink)).body as ChallengeInfo).status).toBe('stopped');
    // Sam's lobby moves on to the lineups; both are in that one start.
    expect((await linkInfo(sam, samsLink)).body).toMatchObject({ status: 'yours', startId });
    expect(await matchOf(sam)).toMatchObject({ kind: 'start', id: startId });
    expect(await matchOf(jo)).toMatchObject({ kind: 'start', id: startId });
  });

  it('accepted by both at once, make one pair of lineups, with no deadlock', async () => {
    const { sam, jo, samsLink, josLink } = await crossed();
    // Each on its own function instance, as two phones would be.
    const both = await Promise.all([
      accept(jo, samsLink),
      accept({ ...sam, browser: sam.browser.elsewhere(other) }, josLink),
    ]);
    expect(both.map((answer) => answer.status)).toStrictEqual([200, 200]);
    const ids = both.map((answer) => (answer.body as Accepted).startId);
    expect(ids[0]).not.toBeNull();
    expect(ids[1]).toBe(ids[0]);
    const [{ count } = { count: 0 }] = await admin<{ count: number }[]>`
      select count(*)::int as count from game.starts
      where ${sam.userId} in (player_a, player_b) and series_id is null`;
    expect(count).toBe(1);
  });

  it('leaves a lobby for someone else alone: accepting is still one match at a time', async () => {
    const sam = await account();
    const jo = await account();
    const kim = await account();
    const samJo = await befriend(admin, sam, jo);
    const joKim = await befriend(admin, jo, kim);
    const samsLink = tokenOf(await challengeTo(sam, samJo));
    expect((await challengeTo(jo, joKim)).status).toBe(201);
    expect(code((await accept(jo, samsLink)).body)).toBe('in_a_match');
    expect((await matchOf(jo))?.kind).toBe('lobby');
  });
});

describe('a blocked sender’s link', () => {
  it('tells the blocker, with Unblock; Accept is refused; the sender learns nothing', async () => {
    const sam = await account();
    const jo = await account();
    const id = await befriend(admin, sam, jo);
    // A link to anyone (Sam shared it), opened by Jo after Jo blocked Sam.
    const sent = await sam.browser.call(challenges, 'POST', '/api/v1/challenges', {
      format: 'reveal',
      bestOf: 3,
      requestId: crypto.randomUUID(),
      live: true,
    });
    const token = tokenOf(sent);
    expect(
      (await jo.browser.call(friendOne, 'POST', `/api/v1/friends/${id}/block`, {})).status,
    ).toBe(200);
    const card = (await linkInfo(jo, token)).body as ChallengeInfo;
    expect([card.status, card.blocked]).toStrictEqual(['open', id]);
    const refused = await accept(jo, token);
    expect([refused.status, code(refused.body)]).toStrictEqual([403, 'friend_blocked']);
    // The sender's lobby reads as before: waiting, nothing said.
    const lobby = (await linkInfo(sam, token)).body as ChallengeInfo;
    expect([lobby.status, lobby.declined, lobby.blocked]).toStrictEqual(['yours', false, null]);
    // A stranger's view of it never says blocked.
    const kim = await account();
    expect(((await linkInfo(kim, token)).body as ChallengeInfo).blocked).toBeNull();
    // Unblock, and the link can be taken.
    await jo.browser.call(friendOne, 'POST', `/api/v1/friends/${id}/unblock`, {});
    expect((await accept(jo, token)).status).toBe(200);
  });
});

describe('the lobby on /me/match', () => {
  it('names the friend it waits for, for "You already challenged Jo"', async () => {
    const sam = await account();
    const jo = await account();
    const id = await befriend(admin, sam, jo);
    expect((await challengeTo(sam, id)).status).toBe(201);
    expect(await matchOf(sam)).toMatchObject({ kind: 'lobby', invitee: jo.username });
    // Sending again is refused by the one-match rule (the page reads /me/match to say whose).
    expect(code((await challengeTo(sam, id)).body)).toBe('in_a_match');
  });
});
