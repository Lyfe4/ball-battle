// An account's record and its head-to-head with each friend (ADR 0088), against the local Supabase: online series counted once finished,
// a forfeit a loss for the side that left, void and open series never; the favourite ball and its
// tie; only the reader's own series; guests and pages without a session get nothing. Series are
// made by the service and ended in SQL, with the columns the series service writes.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorOf } from '../../api/errors.ts';
import { RECENT_SERIES, type RecordResponse } from '../../api/record.ts';
import type { Side } from '../../sim/index.ts';
import type { FriendsResponse } from '../../api/friends.ts';
import { TestBrowser } from '../test/client.ts';
import { befriend, newAccount } from '../test/friends-support.ts';
import { newPlayer, newSeries, type Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { friends } from './friends.ts';
import { meRecord } from './record.ts';

const deps = testDeps();
const admin = adminSql();
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
});
afterAll(async () => {
  await deps.sql.end();
  await admin.end();
});

/** A new account with a username of its own. */
const account = () => newAccount(deps, admin);

const call = (player: Player) => player.browser.call(meRecord, 'GET', '/api/v1/me/record');

const recordOf = async (player: Player): Promise<RecordResponse> => {
  const answer = await call(player);
  expect(answer.status, JSON.stringify(answer.body)).toBe(200);
  return answer.body as RecordResponse;
};

interface Ending {
  readonly status: 'finished' | 'forfeit' | 'void';
  /** Null: a forfeit both sides missed, or a void series. */
  readonly winner: Side | null;
  /** The rounds each side won. */
  readonly rounds?: { readonly a: number; readonly b: number };
  /** Minutes ago it finished, so a test can order them. */
  readonly ago?: number;
  readonly live?: boolean;
}

/** A Reveal series between `a` and `b`, ended as `ending` says. */
async function played(
  a: Player,
  b: Player,
  ending: Ending,
  lineups?: readonly [string[], string[]],
): Promise<string> {
  const id = await newSeries(deps, { a, b }, 'reveal');
  const { a: wonA, b: wonB } = ending.rounds ?? { a: 0, b: 0 };
  const winners: Side[] = [...Array<Side>(wonA).fill('a'), ...Array<Side>(wonB).fill('b')];
  for (const [round, winner] of winners.entries()) {
    await admin`
      insert into game.rounds (series_id, round, a, b, seeds, outcomes, winner, sudden_death)
      values (${id}, ${round}, 'archer', 'brawler', ${[1]}, ${[winner]}, ${winner}, false)`;
  }
  await admin`
    update game.series set status = ${ending.status}, winner = ${ending.winner}, turn = null,
      turn_deadline = null, live = ${ending.live ?? false},
      finished_at = now() - make_interval(mins => ${ending.ago ?? 0}),
      lineup_a = coalesce(${lineups?.[0] ?? null}::text[], lineup_a),
      lineup_b = coalesce(${lineups?.[1] ?? null}::text[], lineup_b)
    where id = ${id}`;
  return id;
}

describe('an account’s record (ADR 0088)', () => {
  it('counts finished series and forfeits, never open or void ones, the latest first', async () => {
    const me = await account();
    const jo = await account();
    expect(await recordOf(me)).toStrictEqual({ wins: 0, played: 0, favourite: null, recent: [] });

    const won = await played(me, jo, {
      status: 'finished',
      winner: 'a',
      rounds: { a: 2, b: 1 },
      ago: 30,
    });
    // Jo left a live match: a forfeit, my win.
    const left = await played(jo, me, {
      status: 'forfeit',
      winner: 'b',
      rounds: { a: 1, b: 0 },
      ago: 20,
      live: true,
    });
    // My turn ran out, by turns: my loss.
    const ranOut = await played(me, jo, { status: 'forfeit', winner: 'b', ago: 10 });
    // Neither opened the lineup: played, lost for both.
    const missed = await played(me, jo, { status: 'forfeit', winner: null, ago: 5 });
    await played(me, jo, { status: 'void', winner: null, ago: 1 });
    await newSeries(deps, { a: me, b: jo }, 'showdown');

    const mine = await recordOf(me);
    expect([mine.wins, mine.played]).toStrictEqual([2, 4]);
    expect(mine.recent.map((row) => row.id)).toStrictEqual([missed, ranOut, left, won]);
    expect(mine.recent.map((row) => [row.won, row.forfeit])).toStrictEqual([
      [false, true],
      [false, true],
      [true, true],
      [true, false],
    ]);
    expect(mine.recent[3]).toMatchObject({
      opponent: jo.username,
      live: false,
      bestOf: 3,
      format: 'reveal',
      score: { you: 2, them: 1 },
    });
    expect(mine.recent[2]).toMatchObject({ live: true, score: { you: 0, them: 1 } });
    expect(Number.isNaN(Date.parse(mine.recent[3]?.finishedAt ?? ''))).toBe(false);
    expect(typeof mine.recent[3]?.ruleset).toBe('number');

    // The same series from Jo's side.
    const theirs = await recordOf(jo);
    expect([theirs.wins, theirs.played]).toStrictEqual([1, 4]);
    expect(theirs.recent[3]).toMatchObject({
      opponent: me.username,
      won: false,
      score: { you: 1, them: 2 },
    });
  });

  it('lists only the reader’s own series, at most RECENT_SERIES', async () => {
    const me = await account();
    const sam = await account();
    const kim = await account();
    await played(sam, kim, { status: 'finished', winner: 'a' });
    expect((await recordOf(me)).played).toBe(0);
    for (let n = 0; n <= RECENT_SERIES; n += 1) {
      await played(me, sam, { status: 'finished', winner: 'a', ago: n });
    }
    const mine = await recordOf(me);
    expect(mine.played).toBe(RECENT_SERIES + 1);
    expect(mine.recent).toHaveLength(RECENT_SERIES);
    expect(new Set(mine.recent.map((row) => row.opponent))).toStrictEqual(new Set([sam.username]));
  });

  it('names the favourite ball by lineups, a tie going to the most recent', async () => {
    const me = await account();
    const jo = await account();
    const theirs = ['brawler', 'magnet', 'frost'];
    await played(me, jo, { status: 'finished', winner: 'a', ago: 30 }, [
      ['vampire', 'archer', 'storm'],
      theirs,
    ]);
    await played(jo, me, { status: 'finished', winner: 'a', ago: 20 }, [
      theirs,
      ['vampire', 'hex', 'quake'],
    ]);
    expect((await recordOf(me)).favourite).toBe('vampire');
    // The Archer and the Vampire twice each now; the Archer's series is the most recent.
    await played(me, jo, { status: 'finished', winner: 'b', ago: 10 }, [
      ['archer', 'thorns', 'venom'],
      theirs,
    ]);
    // A void series' lineup never counts.
    await played(me, jo, { status: 'void', winner: null, ago: 1 }, [
      ['vampire', 'thorns', 'venom'],
      theirs,
    ]);
    expect((await recordOf(me)).favourite).toBe('archer');
  });

  it('answers privately, and refuses a guest (403) and a page without a session (401)', async () => {
    const me = await account();
    const answer = await call(me);
    expect(answer.headers.get('Cache-Control')).toBe('private, no-store');
    const guest = await call(await newPlayer(deps));
    expect([guest.status, errorOf(guest.body)?.code]).toStrictEqual([403, 'not_an_account']);
    const stranger = new TestBrowser(deps, '10.8.0.1');
    const none = await stranger.call(meRecord, 'GET', '/api/v1/me/record');
    expect([none.status, errorOf(none.body)?.code]).toStrictEqual([401, 'unauthenticated']);
  });

  it('gives each friend in the Friends list the head-to-head, from the same counted series', async () => {
    const me = await account();
    const jo = await account();
    const sam = await account();
    const kim = await account();
    await befriend(admin, me, jo);
    await befriend(admin, sam, me);
    // Kim is no friend: no row at all, nothing of a stranger.
    await played(me, kim, { status: 'finished', winner: 'a' });
    await played(me, jo, { status: 'finished', winner: 'a' });
    await played(jo, me, { status: 'finished', winner: 'b' });
    await played(me, jo, { status: 'forfeit', winner: 'b' });
    await played(jo, me, { status: 'forfeit', winner: null });
    await played(me, jo, { status: 'void', winner: null });
    await newSeries(deps, { a: me, b: jo }, 'reveal');
    const list = async (player: Player) => {
      const answer = await player.browser.call(friends, 'GET', '/api/v1/friends');
      expect(answer.status).toBe(200);
      return (answer.body as FriendsResponse).friends;
    };
    const mine = await list(me);
    expect(mine.find((row) => row.name === jo.username)?.record).toStrictEqual({
      wins: 2,
      losses: 1,
    });
    // Sam and I never finished a series: no record, not "0 – 0".
    const samRow = mine.find((row) => row.name === sam.username);
    expect(samRow).toBeDefined();
    expect(samRow?.record).toBeUndefined();
    expect(mine.some((row) => row.name === kim.username)).toBe(false);
    // Jo's side of it.
    expect((await list(jo)).find((row) => row.name === me.username)?.record).toStrictEqual({
      wins: 1,
      losses: 2,
    });
  });
});
