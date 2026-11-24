// Blocking and "Report this name" (ADR 0079 addendum of 2026-11-25), against the local Supabase:
// a block ends the friendship and calls off challenges, and the blocked player can never reach the
// blocker again yet reads nothing they couldn't read after a decline or a removal; Unblock is a
// clean slate. A report is stored once, counted a day, and hides that name from the reporter alone.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorOf } from '../../api/errors.ts';
import type { FriendsResponse, InboxResponse } from '../../api/friends.ts';
import { purgeReports } from '../blocks.ts';
import { purgeDeclines } from '../db/friends.ts';
import { LIMITS } from '../rate-limit.ts';
import type { Answer } from '../test/client.ts';
import { newPlayer, type Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { challenges } from './challenges.ts';
import { friendOne, friends } from './friends.ts';
import { meInbox } from './me.ts';

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
interface Account extends Player {
  readonly username: string;
  readonly playerName: string;
}

/** A new account with a username of its own, and its "Player 1234" name. */
async function account(): Promise<Account> {
  const player = await newPlayer(deps);
  names += 1;
  const username = `b${String(Date.now() % 1e7)}x${String(names)}`.slice(0, 15);
  const [row] = await admin<{ display_name: string }[]>`
    update game.profiles set account_at = now(), username = ${username}
    where user_id = ${player.userId} returning display_name`;
  return { ...player, username, playerName: row?.display_name ?? '' };
}

const list = async (player: Player): Promise<FriendsResponse> => {
  const answer = await player.browser.call(friends, 'GET', '/api/v1/friends');
  expect(answer.status, JSON.stringify(answer.body)).toBe(200);
  return answer.body as FriendsResponse;
};
const add = (player: Player, to: string) =>
  player.browser.call(friends, 'POST', '/api/v1/friends', { to });
const act = (player: Player, id: string, action: string, body: unknown = {}) =>
  player.browser.call(friendOne, 'POST', `/api/v1/friends/${id}/${action}`, body);
const inbox = async (player: Player): Promise<InboxResponse> => {
  const answer = await player.browser.call(meInbox, 'GET', '/api/v1/me/inbox');
  expect(answer.status).toBe(200);
  return answer.body as InboxResponse;
};
const namesOf = (entries: readonly { name: string }[]) => entries.map((entry) => entry.name);
const reportsBy = async (player: Player) => [
  ...(await admin<{ name: string; reason: string }[]>`
    select name, reason from game.name_reports where reporter = ${player.userId}`),
];

/** Friends, `a` having asked; the friendship's id. */
async function friendsWith(a: Account, b: Account): Promise<string> {
  await add(a, b.username);
  await add(b, a.username);
  const id = (await list(a)).friends.find((f) => f.name === b.username)?.id;
  if (id === undefined) throw new Error('not friends');
  return id;
}

const challengeTo = (from: Player, friend: string) =>
  from.browser.call(challenges, 'POST', '/api/v1/challenges', {
    format: 'reveal',
    bestOf: 3,
    requestId: crypto.randomUUID(),
    live: true,
    friend,
  });

describe('blocking', () => {
  it('ends a friendship: to them a friend gone, to the blocker a blocked player', async () => {
    const me = await account();
    const them = await account();
    const id = await friendsWith(me, them);
    const after = (await act(me, id, 'block')).body as FriendsResponse;
    expect(namesOf(after.friends)).toStrictEqual([]);
    expect(after.blocked).toStrictEqual([{ id, name: them.username }]);
    // To them, exactly a removal: no friend, nothing sent, nothing waiting, nothing blocked.
    const theirs = await list(them);
    expect([theirs.friends, theirs.incoming, theirs.outgoing, theirs.blocked]).toStrictEqual([
      [],
      [],
      [],
      [],
    ]);
  });

  it('never lets them reach the blocker again, while it reads as sent to them', async () => {
    const me = await account();
    const them = await account();
    const id = await friendsWith(me, them);
    await act(me, id, 'block');
    const again = await add(them, me.username);
    expect(again.status).toBe(200);
    expect((again.body as { outcome: string }).outcome).toBe('requested');
    expect(namesOf((await list(them)).outgoing)).toStrictEqual([me.username]);
    const mine = await list(me);
    expect([mine.incoming, mine.friends]).toStrictEqual([[], []]);
    expect((await inbox(me)).requests).toBe(0);
    // Cancelling, the decline's 30 days and the sweep, then asking again: still nothing arrives.
    await them.browser.call(friendOne, 'DELETE', `/api/v1/friends/${id}`);
    await admin`
      update game.friendships set declined_at = now() - interval '40 days' where id = ${id}`;
    await purgeDeclines(deps.sql);
    const late = await add(them, me.username);
    expect([late.status, (late.body as { outcome?: string }).outcome]).toStrictEqual([
      200,
      'requested',
    ]);
    expect((await list(me)).incoming).toStrictEqual([]);
    expect(code(await act(me, id, 'accept'))).toStrictEqual([404, 'not_found']);
    expect((await list(me)).blocked).toStrictEqual([{ id, name: them.username }]);
  });

  it('keeps a blocked request reading as sent to its sender, as a decline does', async () => {
    const me = await account();
    const them = await account();
    await add(them, me.username);
    const id = (await list(me)).incoming[0]?.id ?? '';
    await act(me, id, 'block');
    expect(namesOf((await list(them)).outgoing)).toStrictEqual([me.username]);
    expect((await list(me)).incoming).toStrictEqual([]);
  });

  it('calls off challenges both ways, and no new one can be sent', async () => {
    const me = await account();
    const them = await account();
    const id = await friendsWith(me, them);
    expect((await challengeTo(me, id)).status).toBe(201);
    expect((await challengeTo(them, id)).status).toBe(201);
    expect((await inbox(me)).invites.map((invite) => invite.friend)).toStrictEqual([id]);
    await act(me, id, 'block');
    expect((await inbox(me)).invites).toStrictEqual([]);
    expect((await inbox(them)).invites).toStrictEqual([]);
    const rows = await admin<{ mine: boolean; cancelled: boolean; declined: boolean }[]>`
      select creator = ${me.userId} as mine, cancelled_at is not null as cancelled,
        invitee_declined_at is not null as declined
      from game.challenges where ${me.userId} in (creator, invitee) order by 1`;
    // Theirs reads as No thanks, the answer any friend may give; mine is called off.
    expect([...rows]).toStrictEqual([
      { mine: false, cancelled: false, declined: true },
      { mine: true, cancelled: true, declined: false },
    ]);
    expect(code(await challengeTo(them, id))).toStrictEqual([404, 'not_found']);
  });

  it('refuses the blocker’s own request until Unblock, which is a clean slate', async () => {
    const me = await account();
    const them = await account();
    const id = await friendsWith(me, them);
    await act(me, id, 'block');
    expect(code(await add(me, them.username))).toStrictEqual([409, 'friend_blocked']);
    // Only the blocker can unblock.
    await act(them, id, 'unblock');
    expect((await list(me)).blocked).toHaveLength(1);
    const after = (await act(me, id, 'unblock')).body as FriendsResponse;
    expect(after.blocked).toStrictEqual([]);
    expect((await list(them)).outgoing).toStrictEqual([]);
    expect((await add(me, them.username)).status).toBe(200);
    expect(namesOf((await list(them)).incoming)).toStrictEqual([me.username]);
  });

  it('is one block for a double tap; a stranger can’t block by someone else’s row', async () => {
    const me = await account();
    const them = await account();
    const id = await friendsWith(me, them);
    await act(me, id, 'block');
    expect((await act(me, id, 'block')).status).toBe(200);
    const stranger = await account();
    expect(code(await act(stranger, id, 'block'))).toStrictEqual([404, 'not_found']);
  });
});

describe('reporting a name', () => {
  it('stores it once, and hides that name from the reporter alone', async () => {
    const me = await account();
    const them = await account();
    const bystander = await account();
    const id = await friendsWith(me, them);
    await friendsWith(bystander, them);
    const after = (await act(me, id, 'report', { reason: 'offensive' })).body as FriendsResponse;
    expect(namesOf(after.friends)).toStrictEqual([them.playerName]);
    expect(namesOf((await inbox(me)).friends)).toStrictEqual([them.playerName]);
    expect(namesOf((await list(bystander)).friends)).toStrictEqual([them.username]);
    await act(me, id, 'report', { reason: 'other' });
    expect(await reportsBy(me)).toStrictEqual([{ name: them.username, reason: 'offensive' }]);
    // A new name shows again.
    const renamed = `${them.username.slice(0, 12)}_v2`;
    await admin`update game.profiles set username = ${renamed} where user_id = ${them.userId}`;
    expect(namesOf((await list(me)).friends)).toStrictEqual([renamed]);
  });

  it('works from a request and from a challenge, hiding the name in both', async () => {
    const me = await account();
    const them = await account();
    await add(them, me.username);
    const id = (await list(me)).incoming[0]?.id ?? '';
    await act(me, id, 'report', { reason: 'impersonation' });
    expect(namesOf((await list(me)).incoming)).toStrictEqual([them.playerName]);
    await act(me, id, 'accept');
    expect((await challengeTo(them, id)).status).toBe(201);
    expect((await inbox(me)).invites.map((invite) => invite.from)).toStrictEqual([them.playerName]);
  });

  it('refuses a bad reason and a player with no username, and counts a day’s reports', async () => {
    const me = await account();
    const them = await account();
    const id = await friendsWith(me, them);
    expect(code(await act(me, id, 'report', { reason: 'spam' }))).toStrictEqual([
      400,
      'bad_request',
    ]);
    await admin`update game.profiles set username = null where user_id = ${them.userId}`;
    expect(code(await act(me, id, 'report', { reason: 'other' }))).toStrictEqual([
      400,
      'nothing_to_report',
    ]);
    await admin`
      update game.profiles set username = ${them.username} where user_id = ${them.userId}`;
    await admin`
      insert into game.rate_limits (subject, bucket, window_start, count)
      values (${me.userId}, ${LIMITS.nameReports.bucket},
        date_bin(interval '1 day', now(), timestamptz '2000-01-01'), ${LIMITS.nameReports.max})`;
    expect(code(await act(me, id, 'report', { reason: 'other' }))).toStrictEqual([
      429,
      'rate_limited',
    ]);
    expect(await reportsBy(me)).toStrictEqual([]);
  });

  it('keeps reports 90 days, and they go with either account', async () => {
    const me = await account();
    const them = await account();
    const id = await friendsWith(me, them);
    await act(me, id, 'report', { reason: 'offensive' });
    await admin`
      update game.name_reports set created_at = now() - interval '91 days'
      where reporter = ${me.userId}`;
    expect(await purgeReports(deps.sql)).toBeGreaterThanOrEqual(1);
    expect(await reportsBy(me)).toStrictEqual([]);
    await act(me, id, 'report', { reason: 'offensive' });
    await admin`delete from game.profiles where user_id = ${them.userId}`;
    expect(await reportsBy(me)).toStrictEqual([]);
  });
});
