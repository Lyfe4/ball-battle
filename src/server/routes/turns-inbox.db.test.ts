// Play by turns with a friend (ADR 0085), against the local Supabase: sent to a friend only where
// the playtest switch is on, in their inbox until accepted (no lobby to wait in), and "Your turn"
// in the inbox of whoever must pick; a turn that ran out is settled on the inbox's own read, since
// only production runs the sweep.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Accepted } from '../../api/challenges.ts';
import { errorOf } from '../../api/errors.ts';
import type { InboxResponse } from '../../api/friends.ts';
import type { Deps } from '../http.ts';
import type { Answer } from '../test/client.ts';
import { befriend, newAccount } from '../test/friends-support.ts';
import { tokenOf } from '../test/live-support.ts';
import { dueSides, LINEUP_3, leftOf, pick, read, type Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { challengeOne, challenges } from './challenges.ts';
import { meInbox } from './me.ts';
import { seriesOne } from './series.ts';
import { createSeries } from '../series-service.ts';

const off = testDeps();
const on = testDeps({ BALLBATTLE_TURNS: '1' });
/** A second connection, for two requests at once. */
const other = testDeps({ BALLBATTLE_TURNS: '1' });
const admin = adminSql();
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
});
afterAll(async () => {
  await off.sql.end();
  await on.sql.end();
  await other.sql.end();
  await admin.end();
});

const code = (answer: Answer) => [answer.status, errorOf(answer.body)?.code];

const inbox = async (player: Player): Promise<InboxResponse> => {
  const answer = await player.browser.call(meInbox, 'GET', '/api/v1/me/inbox');
  expect(answer.status, JSON.stringify(answer.body)).toBe(200);
  return answer.body as InboxResponse;
};

/** A challenge by turns from `from` to the friendship `friend`, with `from`'s lineup. */
const sendTurns = (from: Player, friend: string) =>
  from.browser.call(challenges, 'POST', '/api/v1/challenges', {
    format: 'reveal',
    bestOf: 3,
    requestId: crypto.randomUUID(),
    live: false,
    lineup: LINEUP_3.a,
    friend,
  });

const acceptTurns = (by: Player, token: string) =>
  by.browser.call(challengeOne, 'POST', `/api/v1/challenges/${token}/accept`, {
    lineup: LINEUP_3.b,
  });

/** Two friends; `deps` decides the switch (each player's browser calls through its own deps). */
async function friends(deps: Deps) {
  const me = await newAccount(deps, admin);
  const friend = await newAccount(deps, admin);
  return { me, friend, id: await befriend(admin, me, friend) };
}

describe('a challenge by turns to a friend', () => {
  it('is refused while the playtest switch is off', async () => {
    const { me, id } = await friends(off);
    expect(code(await sendTurns(me, id))).toStrictEqual([400, 'bad_request']);
  });

  it('waits in their inbox with no lobby, until they accept it with their lineup', async () => {
    const { me, friend, id } = await friends(on);
    const sent = await sendTurns(me, id);
    expect(sent.status, JSON.stringify(sent.body)).toBe(201);
    const token = tokenOf(sent);
    // Nobody waits in a lobby by turns: an old `creator_seen_at` keeps it in the inbox.
    await admin`
      update game.challenges set creator_seen_at = now() - interval '1 hour'
      where invitee = ${friend.userId}`;
    expect((await inbox(friend)).invites).toStrictEqual([
      { token, from: me.username, friend: id, format: 'reveal', bestOf: 3, live: false },
    ]);
    const accepted = await acceptTurns(friend, token);
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
    expect((accepted.body as Accepted).seriesId).not.toBeNull();
    expect((await inbox(friend)).invites).toStrictEqual([]);
  });
});

describe('your turn in the inbox', () => {
  async function started() {
    const { me, friend, id } = await friends(on);
    const accepted = await acceptTurns(friend, tokenOf(await sendTurns(me, id)));
    // The sender is side a, the friend who accepted side b.
    return { seriesId: (accepted.body as Accepted).seriesId ?? '', players: { a: me, b: friend } };
  }

  it('lists the series for whoever must pick, and moves with the turn', async () => {
    const { seriesId, players } = await started();
    const seen = await read(players.a, seriesId);
    const due = dueSides(seen);
    expect(due).toHaveLength(1);
    const side = due[0] ?? 'a';
    const other = side === 'a' ? 'b' : 'a';
    const mine = (await inbox(players[side])).turns;
    expect(mine.map((turn) => [turn.seriesId, turn.opponent])).toStrictEqual([
      [seriesId, players[other].username],
    ]);
    const left = Date.parse(mine[0]?.deadline ?? '') - Date.now();
    expect(left).toBeGreaterThan(23 * 3_600_000);
    expect(left).toBeLessThanOrEqual(24 * 3_600_000 + 60_000);
    expect((await inbox(players[other])).turns).toStrictEqual([]);

    const moved = await pick(players[side], seriesId, 0, leftOf(seen, side)[0] ?? '');
    expect(moved.status).toBe(200);
    expect((await inbox(players[side])).turns).toStrictEqual([]);
    expect((await inbox(players[other])).turns.map((turn) => turn.seriesId)).toStrictEqual([
      seriesId,
    ]);
  });

  it('settles a turn that ran out on the inbox read: the series is forfeit, no turn listed', async () => {
    const { seriesId, players } = await started();
    await admin`
      update game.series set turn_deadline = now() - interval '1 minute' where id = ${seriesId}`;
    expect((await inbox(players.a)).turns).toStrictEqual([]);
    expect((await inbox(players.b)).turns).toStrictEqual([]);
    const [row] = await admin<{ status: string; end_reason: string }[]>`
      select status, end_reason from game.series where id = ${seriesId}`;
    expect(row).toStrictEqual({ status: 'forfeit', end_reason: 'timeout' });
  });
});

describe('your games and endings (ADR 0086)', () => {
  async function started() {
    const { me, friend, id } = await friends(on);
    const accepted = await acceptTurns(friend, tokenOf(await sendTurns(me, id)));
    const seriesId = (accepted.body as Accepted).seriesId ?? '';
    const players = { a: me, b: friend };
    const side = dueSides(await read(me, seriesId))[0] ?? 'a';
    return { seriesId, due: players[side], waiting: players[side === 'a' ? 'b' : 'a'] };
  }

  it('lists a game waiting on the other player in Your games, never twice', async () => {
    const { seriesId, due, waiting } = await started();
    const theirs = await inbox(waiting);
    expect(theirs.games?.map((game) => [game.seriesId, game.opponent])).toStrictEqual([
      [seriesId, due.username],
    ]);
    expect(theirs.turns).toStrictEqual([]);
    const mine = await inbox(due);
    expect(mine.turns.map((turn) => turn.seriesId)).toStrictEqual([seriesId]);
    expect(mine.games).toStrictEqual([]);
  });

  it('never lists a live match, open or ended: Play and the friend’s sheet lead to it', async () => {
    // 2026-11-27: beside a live lineup, a game by turns between the same two read as that match.
    const { me, friend } = await friends(on);
    const liveId = await on.sql.begin((db) =>
      createSeries(db, on.config, {
        format: 'reveal',
        bestOf: 3,
        players: { a: me.userId, b: friend.userId },
        lineups: LINEUP_3,
        live: true,
      }),
    );
    await admin`
      update game.series set turn = 'b', turn_deadline = now() + interval '30 seconds'
      where id = ${liveId}`;
    const listed = (box: InboxResponse) =>
      [...box.turns, ...(box.games ?? []), ...(box.endings ?? [])].map((one) => one.seriesId);
    expect(listed(await inbox(me))).not.toContain(liveId);
    expect(listed(await inbox(friend))).not.toContain(liveId);
    await admin`
      update game.series set status = 'forfeit', winner = 'a', turn = null, turn_deadline = null,
        finished_at = now()
      where id = ${liveId}`;
    expect(listed(await inbox(me))).not.toContain(liveId);
    expect(listed(await inbox(friend))).not.toContain(liveId);
  });

  it('tells both how it ended, in their own words, until each has seen it', async () => {
    const { seriesId, due, waiting } = await started();
    await admin`
      update game.series set turn_deadline = now() - interval '1 minute' where id = ${seriesId}`;
    const lost = await inbox(due);
    expect(lost.endings).toStrictEqual([
      { seriesId, opponent: waiting.username, outcome: 'lost-ran-out' },
    ]);
    expect(lost.games).toStrictEqual([]);
    expect((await inbox(waiting)).endings).toStrictEqual([
      { seriesId, opponent: due.username, outcome: 'won-ran-out' },
    ]);
    // Seen by reading the ended series: gone for that player alone.
    await read(waiting, seriesId);
    expect((await inbox(waiting)).endings).toStrictEqual([]);
    expect((await inbox(due)).endings?.map((ending) => ending.seriesId)).toStrictEqual([seriesId]);
    const [row] = await admin<{ n: number }[]>`
      select count(*)::int as n from game.series_seen where series_id = ${seriesId}`;
    expect(row?.n).toBe(1);
  });
});

describe('the seen mark (ADR 0086)', () => {
  const marks = async (seriesId: string) =>
    (
      await admin<{ player: string; seen_at: Date }[]>`
      select player, seen_at from game.series_seen where series_id = ${seriesId}`
    ).map((row) => ({ ...row }));

  it('is never written while the series is open, nor by anyone not playing in it', async () => {
    const { me, friend, id } = await friends(on);
    const accepted = await acceptTurns(friend, tokenOf(await sendTurns(me, id)));
    const seriesId = (accepted.body as Accepted).seriesId ?? '';
    await read(me, seriesId);
    expect(await marks(seriesId)).toStrictEqual([]);
    await admin`
      update game.series set turn_deadline = now() - interval '1 minute' where id = ${seriesId}`;
    // Ended (settled on the inbox's read), then read by someone else: refused, and nothing written.
    await inbox(me);
    const stranger = await newAccount(on, admin);
    const answer = await stranger.browser.call(seriesOne, 'GET', `/api/v1/series/${seriesId}`);
    expect(code(answer)).toStrictEqual([404, 'not_found']);
    expect(await marks(seriesId)).toStrictEqual([]);
  });

  it('is written once however often its player reads the ended series', async () => {
    const { me, friend, id } = await friends(on);
    const accepted = await acceptTurns(friend, tokenOf(await sendTurns(me, id)));
    const seriesId = (accepted.body as Accepted).seriesId ?? '';
    await admin`
      update game.series set turn_deadline = now() - interval '1 minute' where id = ${seriesId}`;
    await read(me, seriesId);
    const [first] = await marks(seriesId);
    // Again, and twice at once (two tabs): each read answers, and the first mark stands.
    await read(me, seriesId);
    const twice = await Promise.all([
      me.browser.call(seriesOne, 'GET', `/api/v1/series/${seriesId}`),
      me.browser.elsewhere(other).call(seriesOne, 'GET', `/api/v1/series/${seriesId}`),
    ]);
    expect(twice.map((answer) => answer.status)).toStrictEqual([200, 200]);
    expect(await marks(seriesId)).toStrictEqual([first]);
    expect(first?.player).toBe(me.userId);
  });
});
