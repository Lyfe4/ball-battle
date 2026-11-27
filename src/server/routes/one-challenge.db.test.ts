// One outgoing challenge per player (ADR 0089 addendum of 2026-11-27), against the local database:
// a new challenge calls off the sender's older one in the same transaction and its friend is poked
// once (their banner or row goes at once); a live No thanks or a block ends the lobby, so the sender
// is never left waiting; a challenge sent to a friend whose lobby waits for you is an accept
// (crossed); accepting a live challenge stops your own lobby; and the inbox and home say how long
// a lobby has left, so the page reads again the moment it stops.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Accepted, ChallengeInfo, ChallengeLink } from '../../api/challenges.ts';
import { errorOf } from '../../api/errors.ts';
import type { CurrentMatchResponse } from '../../api/live.ts';
import { LOBBY_SEEN_MS } from '../../api/live.ts';
import type { InboxResponse } from '../../api/friends.ts';
import type { Sql } from '../db.ts';
import { befriend, newAccount } from '../test/friends-support.ts';
import { linkInfo, tokenOf } from '../test/live-support.ts';
import { LINEUP_3, type Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { challengeOne, challenges } from './challenges.ts';
import { friendOne } from './friends.ts';
import { meInbox, meMatch } from './me.ts';

const deps = testDeps({ BALLBATTLE_TURNS: '1' });
/** A second function instance, with its own connection: two phones at once. */
const other = testDeps({ BALLBATTLE_TURNS: '1' });
const admin = adminSql();
let flagWas = false;

const setFlag = async (sql: Sql, on: boolean): Promise<void> => {
  await sql`update game.flags set enabled = ${on}, changed_at = now() where name = 'poke'`;
};

beforeAll(async () => {
  await admin`delete from game.rate_limits`;
  const [row] = await admin<{ enabled: boolean }[]>`
    select enabled from game.flags where name = 'poke'`;
  flagWas = row?.enabled ?? false;
});
beforeEach(async () => {
  await setFlag(admin, true);
});
afterAll(async () => {
  await setFlag(admin, flagWas);
  await deps.sql.end();
  await other.sql.end();
  await admin.end();
});

const account = () => newAccount(deps, admin);
const code = (body: unknown) => errorOf(body)?.code;

function challengeTo(from: Player, friend: string | undefined, live = true) {
  return from.browser.call(challenges, 'POST', '/api/v1/challenges', {
    format: 'reveal',
    bestOf: 3,
    requestId: crypto.randomUUID(),
    live,
    ...(live ? {} : { lineup: LINEUP_3.a }),
    ...(friend === undefined ? {} : { friend }),
  });
}
const accept = (player: Player, token: string) =>
  player.browser.call(challengeOne, 'POST', `/api/v1/challenges/${token}/accept`, {});
const decline = (player: Player, token: string) =>
  player.browser.call(challengeOne, 'POST', `/api/v1/challenges/${token}/decline`, {});
const inboxOf = async (player: Player) =>
  (await player.browser.call(meInbox, 'GET', '/api/v1/me/inbox')).body as InboxResponse;
const matchOf = async (player: Player) =>
  ((await player.browser.call(meMatch, 'GET', '/api/v1/me/match')).body as CurrentMatchResponse)
    .match;
const cardOf = async (player: Player, token: string) =>
  (await linkInfo(player, token)).body as ChallengeInfo;

/** Every poke a player's topic has had, as `event` names, oldest first. */
async function pokesOf(userId: string): Promise<string[]> {
  const rows = await admin<{ event: string }[]>`
    select m.event from realtime.messages m
    join game.profiles p on m.topic = 'p:' || p.poke_key
    where p.user_id = ${userId}
    order by m.inserted_at`;
  return rows.map((row) => row.event);
}

/** What each player is poked with while `act` runs, and what `act` answered. */
async function pokedBy<T>(players: readonly Player[], act: () => Promise<T>) {
  const before = await Promise.all(players.map((player) => pokesOf(player.userId)));
  const answer = await act();
  const after = await Promise.all(players.map((player) => pokesOf(player.userId)));
  return { answer, pokes: after.map((events, i) => events.slice(before[i]?.length ?? 0)) };
}

/** Sam with two friends, Jo and Robin. */
async function threeFriends() {
  const sam = await account();
  const jo = await account();
  const robin = await account();
  const withJo = await befriend(admin, sam, jo);
  const withRobin = await befriend(admin, sam, robin);
  return { sam, jo, robin, withJo, withRobin };
}

describe('one outgoing challenge per player', () => {
  it('a new challenge stops the old one at once, and pokes its friend once', async () => {
    const { sam, jo, robin, withJo, withRobin } = await threeFriends();
    const toJo = tokenOf(await challengeTo(sam, withJo));
    expect((await inboxOf(jo)).invites).toHaveLength(1);
    // Sam challenges Robin instead: one request, no "your lobby is waiting".
    const { answer, pokes } = await pokedBy([jo, robin], () => challengeTo(sam, withRobin));
    expect(answer.status).toBe(201);
    // Jo's inbox is poked (the banner goes) and Robin's (the new one arrives), once each.
    expect(pokes).toStrictEqual([['inbox'], ['inbox']]);
    expect((await inboxOf(jo)).invites).toStrictEqual([]);
    expect((await inboxOf(robin)).invites).toHaveLength(1);
    // Jo opening the old link reads it as stopped; Sam's old lobby says why.
    expect((await cardOf(jo, toJo)).status).toBe('stopped');
    expect(await cardOf(sam, toJo)).toMatchObject({ status: 'stopped', superseded: true });
    // Sam's one lobby is the new one.
    expect(await matchOf(sam)).toMatchObject({ kind: 'lobby', token: tokenOf(answer) });
  });

  it('the same friend twice is one challenge, the newer one', async () => {
    const { sam, jo, withJo } = await threeFriends();
    await challengeTo(sam, withJo);
    await challengeTo(sam, withJo);
    const third = tokenOf(await challengeTo(sam, withJo));
    const invites = (await inboxOf(jo)).invites;
    expect(invites.map((invite) => invite.token)).toStrictEqual([third]);
  });

  it('a retried send answers the same link and calls off nothing more', async () => {
    const { sam, jo, withJo } = await threeFriends();
    const body = {
      format: 'reveal',
      bestOf: 3,
      requestId: crypto.randomUUID(),
      live: true,
      friend: withJo,
    };
    const first = await sam.browser.call(challenges, 'POST', '/api/v1/challenges', body);
    const again = await sam.browser.call(challenges, 'POST', '/api/v1/challenges', body);
    expect(tokenOf(again)).toBe(tokenOf(first));
    expect((await inboxOf(jo)).invites.map((invite) => invite.token)).toStrictEqual([
      tokenOf(first),
    ]);
  });

  it('a link to anyone stops a challenge to a friend too, and a send while sending waits', async () => {
    const { sam, jo, withJo } = await threeFriends();
    await challengeTo(sam, withJo);
    // Two sends at once on two instances (a double tap on two phones): one lobby is left.
    const both = await Promise.all([
      challengeTo(sam, undefined),
      challengeTo({ ...sam, browser: sam.browser.elsewhere(other) }, undefined),
    ]);
    expect(both.map((answer) => answer.status)).toStrictEqual([201, 201]);
    expect((await inboxOf(jo)).invites).toStrictEqual([]);
    const [{ count } = { count: 0 }] = await admin<{ count: number }[]>`
      select count(*)::int as count from game.challenges
      where creator = ${sam.userId} and cancelled_at is null and series_id is null
        and start_id is null`;
    expect(count).toBe(1);
  });

  it('by turns is one at a time as well', async () => {
    const { sam, jo, robin, withJo, withRobin } = await threeFriends();
    await challengeTo(sam, withJo, false);
    expect((await inboxOf(jo)).invites).toHaveLength(1);
    await challengeTo(sam, withRobin, false);
    expect((await inboxOf(jo)).invites).toStrictEqual([]);
    expect((await inboxOf(robin)).invites).toHaveLength(1);
  });

  it('is refused while the sender is in a live match, and calls nothing off then', async () => {
    const { sam, jo, robin, withJo, withRobin } = await threeFriends();
    // Sam and Jo are picking lineups together.
    await accept(jo, tokenOf(await challengeTo(sam, withJo)));
    const refused = await challengeTo(sam, withRobin);
    expect(refused.status).toBe(409);
    expect(code(refused.body)).toBe('in_a_match');
    expect((await inboxOf(robin)).invites).toStrictEqual([]);
    expect(await matchOf(sam)).toMatchObject({ kind: 'start' });
  });
});

describe('the sender is never left waiting', () => {
  it('a No thanks ends a live challenge: the lobby says so and home has no way back to it', async () => {
    const { sam, jo, withJo } = await threeFriends();
    const token = tokenOf(await challengeTo(sam, withJo));
    const { answer, pokes } = await pokedBy([sam, jo], () => decline(jo, token));
    expect(answer.status).toBe(204);
    // Sam's lobby is poked (it says "Jo said no thanks"), Jo's inbox (the banner goes).
    expect(pokes).toStrictEqual([['match'], ['inbox']]);
    expect(await cardOf(sam, token)).toMatchObject({ status: 'stopped', declined: true });
    expect(await matchOf(sam)).toBeNull();
    // Nobody else can take it either.
    const stranger = await account();
    expect(code((await accept(stranger, token)).body)).toBe('challenge_stopped');
  });

  it('a block ends it the same way, read by the sender as a No thanks', async () => {
    const { sam, jo, withJo } = await threeFriends();
    const token = tokenOf(await challengeTo(sam, withJo));
    await jo.browser.call(friendOne, 'POST', `/api/v1/friends/${withJo}/block`, {});
    expect(await cardOf(sam, token)).toMatchObject({ status: 'stopped', declined: true });
    expect(await matchOf(sam)).toBeNull();
  });

  it('accepting a live challenge stops your own lobby, and its friend is poked', async () => {
    const { sam, jo, robin, withJo, withRobin } = await threeFriends();
    // Sam waits for Robin; Jo challenges Sam; Sam accepts Jo's.
    const samToRobin = tokenOf(await challengeTo(sam, withRobin));
    const joToSam = tokenOf(await challengeTo(jo, withJo));
    const { answer, pokes } = await pokedBy([robin], () => accept(sam, joToSam));
    expect(answer.status).toBe(200);
    expect((answer.body as Accepted).startId).not.toBeNull();
    expect(pokes).toStrictEqual([['inbox']]);
    expect((await inboxOf(robin)).invites).toStrictEqual([]);
    expect((await cardOf(sam, samToRobin)).status).toBe('stopped');
  });
});

describe('crossed challenges', () => {
  it('a challenge sent to a friend whose lobby waits for you is an accept', async () => {
    const { sam, jo, withJo } = await threeFriends();
    const samsLink = tokenOf(await challengeTo(sam, withJo));
    const sent = await challengeTo(jo, withJo);
    expect(sent.status).toBe(201);
    const link = sent.body as ChallengeLink;
    // Jo is answered with Sam's link and the lineups both pick now.
    expect(link.token).toBe(samsLink);
    expect(link.startId).toBeDefined();
    expect(await matchOf(sam)).toMatchObject({ kind: 'start', id: link.startId });
    expect(await matchOf(jo)).toMatchObject({ kind: 'start', id: link.startId });
    expect((await inboxOf(jo)).invites).toStrictEqual([]);
    expect((await inboxOf(sam)).invites).toStrictEqual([]);
  });

  it('two friends challenging each other at once make one pair of lineups', async () => {
    const { sam, jo, withJo } = await threeFriends();
    const both = await Promise.all([
      challengeTo(sam, withJo),
      challengeTo({ ...jo, browser: jo.browser.elsewhere(other) }, withJo),
    ]);
    expect(both.map((answer) => answer.status)).toStrictEqual([201, 201]);
    const starts = both.map((answer) => (answer.body as ChallengeLink).startId);
    // Whoever came second accepted the first's challenge.
    expect(starts.filter((id) => id !== undefined)).toHaveLength(1);
    const sams = await matchOf(sam);
    expect(sams?.kind).toBe('start');
    expect(await matchOf(jo)).toStrictEqual(sams);
  });
});

describe('how long a lobby has left', () => {
  it('rides on the friend’s invite and on the sender’s way back home', async () => {
    const { sam, jo, withJo } = await threeFriends();
    await challengeTo(sam, withJo);
    const [invite] = (await inboxOf(jo)).invites;
    expect(invite?.stopsInMs).toBeGreaterThan(LOBBY_SEEN_MS - 10_000);
    expect(invite?.stopsInMs).toBeLessThanOrEqual(LOBBY_SEEN_MS);
    const lobby = await matchOf(sam);
    expect(lobby?.kind === 'lobby' ? lobby.stopsInMs : undefined).toBeGreaterThan(
      LOBBY_SEEN_MS - 10_000,
    );
    // Silent for 50 s: 10 s left, said to both.
    await admin`
      update game.challenges set creator_seen_at = now() - interval '50 seconds'
      where creator = ${sam.userId} and cancelled_at is null`;
    const [later] = (await inboxOf(jo)).invites;
    expect(later?.stopsInMs).toBeGreaterThan(5_000);
    expect(later?.stopsInMs).toBeLessThanOrEqual(10_000);
  });
});
