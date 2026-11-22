// Friends (ADR 0079, PR (c)), against the local Supabase: adding by username or friend code,
// requests answered, declines that stop repeats, the caps on lookups and requests, and deleting an
// account. Accounts here are guests marked as accounts in SQL (rules read `account_at` alone).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddFriendResponse, FriendsResponse } from '../../api/friends.ts';
import { errorOf } from '../../api/errors.ts';
import { purgeDeclines } from '../db/friends.ts';
import { ipSubject, LIMITS } from '../rate-limit.ts';
import type { Answer } from '../test/client.ts';
import { newPlayer, type Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { friendOne, friends } from './friends.ts';
import { me } from './me.ts';

const deps = testDeps();
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

const code = (answer: Answer) => [answer.status, errorOf(answer.body)?.code];

let names = 0;
/** A username no other test (or run) has. */
const fresh = () => {
  names += 1;
  return `f${String(Date.now() % 1e7)}x${String(names)}`.slice(0, 15);
};

interface Account extends Player {
  readonly username: string;
}

/** A new account with a username of its own. */
async function account(): Promise<Account> {
  const player = await newPlayer(deps);
  const username = fresh();
  await admin`
    update game.profiles set account_at = now(), username = ${username}
    where user_id = ${player.userId}`;
  return { ...player, username };
}

const list = async (player: Player): Promise<FriendsResponse> => {
  const answer = await player.browser.call(friends, 'GET', '/api/v1/friends');
  expect(answer.status).toBe(200);
  return answer.body as FriendsResponse;
};
const add = (player: Player, to: string) =>
  player.browser.call(friends, 'POST', '/api/v1/friends', { to });
const added = async (player: Player, to: string): Promise<AddFriendResponse> => {
  const answer = await add(player, to);
  expect(answer.status, JSON.stringify(answer.body)).toBe(200);
  return answer.body as AddFriendResponse;
};
const accept = (player: Player, id: string) =>
  player.browser.call(friendOne, 'POST', `/api/v1/friends/${id}/accept`);
const remove = (player: Player, id: string) =>
  player.browser.call(friendOne, 'DELETE', `/api/v1/friends/${id}`);
const namesOf = (entries: readonly { name: string }[]) => entries.map((entry) => entry.name);

describe('friends are for accounts', () => {
  it('asks a guest to sign in, for the list and for a request', async () => {
    const guest = await newPlayer(deps);
    const someone = await account();
    expect(code(await guest.browser.call(friends, 'GET', '/api/v1/friends'))).toStrictEqual([
      403,
      'not_an_account',
    ]);
    expect(code(await add(guest, someone.username))).toStrictEqual([403, 'not_an_account']);
  });

  it('never finds a guest, which has neither a username nor a code', async () => {
    const asker = await account();
    const guest = await newPlayer(deps);
    const [row] = await admin<{ display_name: string }[]>`
      select display_name from game.profiles where user_id = ${guest.userId}`;
    const answer = await add(asker, row?.display_name ?? 'Player 1234');
    expect(code(answer)).toStrictEqual([404, 'friend_not_found']);
  });

  it('answers accounts_off while accounts are switched off', async () => {
    const asker = await account();
    const off = { ...deps, config: { ...deps.config, accounts: false } };
    const answer = await asker.browser.elsewhere(off).call(friends, 'GET', '/api/v1/friends');
    expect(code(answer)).toStrictEqual([404, 'accounts_off']);
  });
});

describe('a friend code', () => {
  it('is made on first use, 8 Crockford characters, and stays', async () => {
    const player = await account();
    const first = await list(player);
    expect(first.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    expect((await list(player)).code).toBe(first.code);
  });
});

describe('adding a friend', () => {
  it('sends a request by username, any case; both see it, and no user id leaves', async () => {
    const asker = await account();
    const friend = await account();
    const answer = await added(asker, friend.username.toUpperCase());
    expect({ outcome: answer.outcome, name: answer.name }).toStrictEqual({
      outcome: 'requested',
      name: friend.username,
    });
    expect(namesOf(answer.outgoing)).toStrictEqual([friend.username]);
    const theirs = await list(friend);
    expect(namesOf(theirs.incoming)).toStrictEqual([asker.username]);
    const text = JSON.stringify([answer, theirs]);
    expect(text.includes(asker.userId) || text.includes(friend.userId)).toBe(false);
  });

  it('sends one by friend code, typed with a dash, in lower case, O for 0', async () => {
    const asker = await account();
    const friend = await account();
    const { code: theirs } = await list(friend);
    const typed = `${theirs.slice(0, 4)}-${theirs.slice(4)}`.toLowerCase().replaceAll('0', 'o');
    expect((await added(asker, typed)).name).toBe(friend.username);
  });

  it('refuses an unknown name and the player themself', async () => {
    const asker = await account();
    expect(code(await add(asker, fresh()))).toStrictEqual([404, 'friend_not_found']);
    expect(code(await add(asker, asker.username))).toStrictEqual([400, 'friend_self']);
    expect(code(await add(asker, (await list(asker)).code))).toStrictEqual([400, 'friend_self']);
  });

  it('keeps one request for a double tap, and for two taps at once', async () => {
    const asker = await account();
    const friend = await account();
    await added(asker, friend.username);
    await added(asker, friend.username);
    const [a, b] = await Promise.all([
      add(asker, friend.username),
      asker.browser.elsewhere(other).call(friends, 'POST', '/api/v1/friends', {
        to: friend.username,
      }),
    ]);
    expect([a.status, b.status]).toStrictEqual([200, 200]);
    expect((await list(friend)).incoming).toHaveLength(1);
  });

  it('makes friends when both ask, one after the other or at once', async () => {
    const one = await account();
    const two = await account();
    await added(one, two.username);
    const answer = await added(two, one.username);
    expect(answer.outcome).toBe('friends');
    expect(namesOf((await list(one)).friends)).toStrictEqual([two.username]);

    const three = await account();
    const four = await account();
    await Promise.all([
      add(three, four.username),
      four.browser.elsewhere(other).call(friends, 'POST', '/api/v1/friends', {
        to: three.username,
      }),
    ]);
    expect(namesOf((await list(three)).friends)).toStrictEqual([four.username]);
    expect(namesOf((await list(four)).friends)).toStrictEqual([three.username]);
  });
});

describe('answering a request', () => {
  it('accepts: both are friends, and nothing waits', async () => {
    const asker = await account();
    const friend = await account();
    await added(asker, friend.username);
    const [request] = (await list(friend)).incoming;
    const answer = await accept(friend, request?.id ?? '');
    expect(answer.status).toBe(200);
    const theirs = answer.body as FriendsResponse;
    expect([namesOf(theirs.friends), theirs.incoming]).toStrictEqual([[asker.username], []]);
    expect([namesOf((await list(asker)).friends), (await list(asker)).outgoing]).toStrictEqual([
      [friend.username],
      [],
    ]);
  });

  it('declines: the sender still sees it sent, and sending again reaches nobody', async () => {
    const asker = await account();
    const friend = await account();
    await added(asker, friend.username);
    const [request] = (await list(friend)).incoming;
    expect((await remove(friend, request?.id ?? '')).status).toBe(200);
    expect((await list(friend)).incoming).toStrictEqual([]);
    expect(namesOf((await list(asker)).outgoing)).toStrictEqual([friend.username]);
    expect((await added(asker, friend.username)).outcome).toBe('requested');
    expect((await list(friend)).incoming).toStrictEqual([]);

    // Cancelling it doesn't clear the way: gone from the sender's list, still no request.
    const [sent] = (await list(asker)).outgoing;
    await remove(asker, sent?.id ?? '');
    expect((await list(asker)).outgoing).toStrictEqual([]);
    expect((await added(asker, friend.username)).outcome).toBe('requested');
    expect((await list(friend)).incoming).toStrictEqual([]);
    expect(namesOf((await list(asker)).outgoing)).toStrictEqual([friend.username]);

    // The one declined may still ask: they changed their mind, and the asker wanted it.
    expect((await added(friend, asker.username)).outcome).toBe('friends');
  });

  it('lets a declined sender ask again after 30 days, once the sweep has dropped it', async () => {
    const asker = await account();
    const friend = await account();
    await added(asker, friend.username);
    const [request] = (await list(friend)).incoming;
    await remove(friend, request?.id ?? '');
    await admin`
      update game.friendships set declined_at = now() - interval '31 days'
      where id = ${request?.id ?? ''}`;
    expect(await purgeDeclines(deps.sql)).toBeGreaterThanOrEqual(1);
    await added(asker, friend.username);
    expect(namesOf((await list(friend)).incoming)).toStrictEqual([asker.username]);
  });

  it('cancels a request and removes a friend; either may ask again after', async () => {
    const asker = await account();
    const friend = await account();
    const [sent] = (await added(asker, friend.username)).outgoing;
    await remove(asker, sent?.id ?? '');
    expect([(await list(asker)).outgoing, (await list(friend)).incoming]).toStrictEqual([[], []]);
    await added(asker, friend.username);
    await added(friend, asker.username);
    const [pal] = (await list(asker)).friends;
    expect((await remove(asker, pal?.id ?? '')).status).toBe(200);
    expect([(await list(asker)).friends, (await list(friend)).friends]).toStrictEqual([[], []]);
    // A second tap on a row that's gone: nothing to do.
    expect((await remove(asker, pal?.id ?? '')).status).toBe(200);
    expect((await added(friend, asker.username)).outcome).toBe('requested');
  });

  it('never touches another pair’s row', async () => {
    const asker = await account();
    const friend = await account();
    const stranger = await account();
    await added(asker, friend.username);
    const [request] = (await list(friend)).incoming;
    expect(code(await accept(stranger, request?.id ?? ''))).toStrictEqual([404, 'not_found']);
    await remove(stranger, request?.id ?? '');
    expect(namesOf((await list(friend)).incoming)).toStrictEqual([asker.username]);
  });
});

describe('limits', () => {
  /** Fills `bucket`'s current window for `subject` to its max. */
  const fill = (subject: string, bucket: string, seconds: number, max: number) => admin`
    insert into game.rate_limits (subject, bucket, window_start, count)
    values (${subject}, ${bucket},
      date_bin(make_interval(secs => ${seconds}), now(), timestamptz '2000-01-01'), ${max})
    on conflict (subject, bucket, window_start) do update set count = ${max}`;

  it('counts lookups per account: past the hour’s, refused before looking', async () => {
    const asker = await account();
    const { bucket, windowSeconds, max } = LIMITS.friendLookups;
    await fill(asker.userId, bucket, windowSeconds, max);
    expect(code(await add(asker, fresh()))).toStrictEqual([429, 'rate_limited']);
  });

  it('counts lookups per network, whoever asks', async () => {
    const asker = await account();
    const subject = await ipSubject(deps.config, asker.browser.ip);
    const { bucket, windowSeconds, max } = LIMITS.friendLookupsFromNetwork;
    await fill(subject, bucket, windowSeconds, max);
    expect(code(await add(asker, fresh()))).toStrictEqual([429, 'rate_limited']);
  });

  it('caps new requests a day, but not answering one', async () => {
    const asker = await account();
    const friend = await account();
    const late = await account();
    await added(late, asker.username);
    const { bucket, windowSeconds, max } = LIMITS.friendRequests;
    await fill(asker.userId, bucket, windowSeconds, max);
    expect(code(await add(asker, friend.username))).toStrictEqual([429, 'rate_limited']);
    expect((await list(friend)).incoming).toStrictEqual([]);
    expect((await added(asker, late.username)).outcome).toBe('friends');
  });
});

describe('deleting an account', () => {
  it('takes its friendships and requests with it', async () => {
    const asker = await account();
    const friend = await account();
    const gone = await account();
    await added(asker, friend.username);
    await added(friend, asker.username);
    await added(gone, asker.username);
    await added(gone, friend.username);
    expect((await friend.browser.call(me, 'DELETE', '/api/v1/me')).status).toBe(204);
    const left = await list(asker);
    expect([left.friends, namesOf(left.incoming)]).toStrictEqual([[], [gone.username]]);
    const rows = await admin`
      select 1 from game.friendships where ${friend.userId} in (low, high)`;
    expect(rows).toHaveLength(0);
  });
});
