// The inbox and challenging a friend (ADR 0079, PR (d)), against the local Supabase: status for
// accepted friends only (never a stranger, a request or a removed friend), online from an
// account's own requests, in a match from a live series or a waiting lobby; a challenge to a
// friend in their inbox until they say No thanks, the sender's lobby told; and only a friend.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ChallengeInfo } from '../../api/challenges.ts';
import { errorOf } from '../../api/errors.ts';
import type { InboxResponse } from '../../api/friends.ts';
import type { Answer } from '../test/client.ts';
import { linkInfo, newLive, sendLive, silence, tokenOf } from '../test/live-support.ts';
import { newPlayer, read, type Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { challengeOne, challenges } from './challenges.ts';
import { me as meRoute, meInbox } from './me.ts';

const deps = testDeps();
const admin = adminSql();
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
});
afterAll(async () => {
  await deps.sql.end();
  await admin.end();
});

const code = (answer: Answer) => [answer.status, errorOf(answer.body)?.code];

let names = 0;
/** Makes `player` an account with a username of its own; returns the username. */
async function makeAccount(player: Player): Promise<string> {
  names += 1;
  const username = `i${String(Date.now() % 1e7)}x${String(names)}`.slice(0, 15);
  await admin`
    update game.profiles set account_at = now(), username = ${username}
    where user_id = ${player.userId}`;
  return username;
}

async function account(): Promise<Player & { username: string }> {
  const player = await newPlayer(deps);
  return { ...player, username: await makeAccount(player) };
}

/** Rows between two players: accepted friends, or a request from `a`. */
async function befriend(a: Player, b: Player, accepted = true): Promise<string> {
  const [low, high] = a.userId < b.userId ? [a.userId, b.userId] : [b.userId, a.userId];
  const [row] = await admin<{ id: string }[]>`
    insert into game.friendships (low, high, requested_by, accepted_at)
    values (${low}, ${high}, ${a.userId}, ${accepted ? new Date() : null}) returning id`;
  return row?.id ?? '';
}

const inbox = async (player: Player): Promise<InboxResponse> => {
  const answer = await player.browser.call(meInbox, 'GET', '/api/v1/me/inbox');
  expect(answer.status, JSON.stringify(answer.body)).toBe(200);
  return answer.body as InboxResponse;
};
const statuses = async (player: Player) =>
  Object.fromEntries((await inbox(player)).friends.map((f) => [f.name, f.status]));
/** Any request of `player`'s: marks an account active (session.ts). */
const touch = (player: Player) => player.browser.call(meRoute, 'GET', '/api/v1/me');
const quiet = (player: Player, seconds: number) => admin`
  update game.profiles set active_at = now() - make_interval(secs => ${seconds})
  where user_id = ${player.userId}`;

describe('the inbox', () => {
  it('is for accounts', async () => {
    const guest = await newPlayer(deps);
    const answer = await guest.browser.call(meInbox, 'GET', '/api/v1/me/inbox');
    expect(code(answer)).toStrictEqual([403, 'not_an_account']);
  });

  it('shows status for accepted friends only: never a stranger, a request or a removed friend', async () => {
    const me = await account();
    const friend = await account();
    const asked = await account();
    const asker = await account();
    const gone = await account();
    await account(); // a stranger, active too
    await befriend(me, friend);
    await befriend(me, asked, false);
    await befriend(asker, me, false);
    const removed = await befriend(me, gone);
    await admin`delete from game.friendships where id = ${removed}`;
    const seen = await inbox(me);
    expect(seen.friends.map((f) => f.name)).toStrictEqual([friend.username]);
    expect(seen.requests).toBe(1);
    // Nor does any of them learn mine.
    expect((await inbox(asked)).friends).toStrictEqual([]);
    expect((await inbox(asker)).friends).toStrictEqual([]);
  });

  it('says online from the friend’s own requests within 75 s, offline after', async () => {
    const me = await account();
    const friend = await account();
    await befriend(me, friend);
    await touch(friend);
    expect(await statuses(me)).toStrictEqual({ [friend.username]: 'online' });
    await quiet(friend, 80);
    expect(await statuses(me)).toStrictEqual({ [friend.username]: 'offline' });
    // A request within 30 s of the last doesn't write; past it, it does.
    await quiet(friend, 40);
    await touch(friend);
    expect(await statuses(me)).toStrictEqual({ [friend.username]: 'online' });
  });

  it('never marks a guest active', async () => {
    const guest = await newPlayer(deps);
    await touch(guest);
    const [row] = await admin<{ active_at: Date | null }[]>`
      select active_at from game.profiles where user_id = ${guest.userId}`;
    expect(row?.active_at).toBeNull();
  });

  it('says in a match while a friend plays live or waits in a lobby, not once they left', async () => {
    const { id, players } = await newLive(deps);
    await makeAccount(players.a);
    const me = await account();
    await befriend(me, players.a);
    await read(players.a, id);
    expect(Object.values(await statuses(me))).toStrictEqual(['in_a_match']);
    // Away past the grace period (the series not yet settled): not in a match.
    await silence(admin, id, 'a', 120_000);
    await quiet(players.a, 120);
    expect(Object.values(await statuses(me))).toStrictEqual(['offline']);

    const waiting = await account();
    await befriend(me, waiting);
    expect((await sendLive(waiting)).status).toBe(201);
    expect((await statuses(me))[waiting.username]).toBe('in_a_match');
  });
});

describe('challenging a friend', () => {
  const challengeTo = (from: Player, friend: string, live = true) =>
    from.browser.call(challenges, 'POST', '/api/v1/challenges', {
      format: 'reveal',
      bestOf: 3,
      requestId: crypto.randomUUID(),
      live,
      friend,
    });

  it('reaches their inbox while the lobby waits; No thanks takes it away and the lobby says so', async () => {
    const me = await account();
    const friend = await account();
    const id = await befriend(me, friend);
    const sent = await challengeTo(me, id);
    expect(sent.status).toBe(201);
    const token = tokenOf(sent);
    const { invites } = await inbox(friend);
    expect(invites).toStrictEqual([{ token, from: me.username, format: 'reveal', bestOf: 3 }]);
    const lobby = (await linkInfo(me, token)).body as ChallengeInfo;
    expect([lobby.invitee, lobby.declined]).toStrictEqual([friend.username, false]);
    // Only the sender sees who it was for.
    expect(((await linkInfo(friend, token)).body as ChallengeInfo).invitee).toBeNull();

    const stranger = await account();
    const refused = await stranger.browser.call(
      challengeOne,
      'POST',
      `/api/v1/challenges/${token}/decline`,
      {},
    );
    expect(code(refused)).toStrictEqual([404, 'not_found']);
    const no = await friend.browser.call(
      challengeOne,
      'POST',
      `/api/v1/challenges/${token}/decline`,
      {},
    );
    expect(no.status).toBe(204);
    expect((await inbox(friend)).invites).toStrictEqual([]);
    expect(((await linkInfo(me, token)).body as ChallengeInfo).declined).toBe(true);
  });

  it('leaves the inbox once the sender stops waiting', async () => {
    const me = await account();
    const friend = await account();
    const sent = await challengeTo(me, await befriend(me, friend));
    await admin`
      update game.challenges set creator_seen_at = now() - interval '5 minutes'
      where invitee = ${friend.userId}`;
    expect(sent.status).toBe(201);
    expect((await inbox(friend)).invites).toStrictEqual([]);
  });

  it('is only for a friend, from an account, and live', async () => {
    const me = await account();
    const friend = await account();
    const asked = await account();
    const request = await befriend(me, asked, false);
    expect(code(await challengeTo(me, request))).toStrictEqual([404, 'not_found']);
    const other = await account();
    const theirs = await befriend(friend, other);
    expect(code(await challengeTo(me, theirs))).toStrictEqual([404, 'not_found']);
    const guest = await newPlayer(deps);
    expect(code(await challengeTo(guest, await befriend(me, friend)))).toStrictEqual([
      403,
      'not_an_account',
    ]);
    expect(code(await challengeTo(me, theirs, false))).toStrictEqual([400, 'bad_request']);
  });
});
