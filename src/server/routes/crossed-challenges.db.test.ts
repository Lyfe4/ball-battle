// Crossed challenges and a blocked sender's link (ADR 0086), against the local database. Since one
// outgoing challenge per player (ADR 0089 addendum of 2026-11-27) a challenge sent to a friend who
// waits for you is an accept (one-challenge.db.test.ts); here, an Accept stops the acceptor's own
// lobby, and a player who blocked the sender sees so on the card and can't accept, while the sender
// learns nothing.
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

describe('crossed challenges', () => {
  it('an Accept while your own lobby waits for someone else stops that lobby', async () => {
    const sam = await account();
    const jo = await account();
    const kim = await account();
    const samJo = await befriend(admin, sam, jo);
    const joKim = await befriend(admin, jo, kim);
    const samsLink = tokenOf(await challengeTo(sam, samJo));
    const josLink = tokenOf(await challengeTo(jo, joKim));
    const taken = await accept(jo, samsLink);
    expect(taken.status).toBe(200);
    const { startId } = taken.body as Accepted;
    // Kim's banner goes; Jo's lobby reads as stopped; both Sam and Jo are in the lineups.
    expect((await inboxOf(kim)).invites).toStrictEqual([]);
    expect(((await linkInfo(jo, josLink)).body as ChallengeInfo).status).toBe('stopped');
    expect(await matchOf(sam)).toMatchObject({ kind: 'start', id: startId });
    expect(await matchOf(jo)).toMatchObject({ kind: 'start', id: startId });
  });

  it('a crossed lobby that reached Accept after the send merged reads as the same lineups', async () => {
    const sam = await account();
    const jo = await account();
    const id = await befriend(admin, sam, jo);
    const samsLink = tokenOf(await challengeTo(sam, id));
    // Jo's send to Sam accepts Sam's; Jo opening Sam's link afterwards accepts nothing new.
    const sent = await challengeTo(jo, id);
    expect(sent.status).toBe(201);
    const again = await accept(jo, samsLink);
    expect(again.status).toBe(200);
    expect((again.body as Accepted).startId).toBe((sent.body as { startId?: string }).startId);
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
    // Sending again is one challenge, the new one (ADR 0089 addendum of 2026-11-27).
    const again = tokenOf(await challengeTo(sam, id));
    expect(await matchOf(sam)).toMatchObject({ kind: 'lobby', token: again, invitee: jo.username });
  });
});
