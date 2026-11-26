// All matches a page at a time, how each match ended from each side, and "Your stats" (ADR
// 0089), against the local Supabase.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorOf } from '../../api/errors.ts';
import { RECENT_SERIES, type MatchesPage, type RecordResponse } from '../../api/record.ts';
import { newAccount } from '../test/friends-support.ts';
import { recordSupport } from '../test/record-support.ts';
import { newPlayer, newSeries, type Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { meMatches, meRecordRoutes } from './record.ts';

const deps = testDeps();
const admin = adminSql();
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
});
afterAll(async () => {
  await deps.sql.end();
  await admin.end();
});

const account = () => newAccount(deps, admin);
const { recordOf, played } = recordSupport(deps, admin);

/** All matches' next page after `after`. */
const pageAfter = async (player: Player, after: string): Promise<MatchesPage> => {
  const answer = await player.browser.call(
    meMatches,
    'GET',
    `/api/v1/me/matches?after=${encodeURIComponent(after)}`,
  );
  expect(answer.status, JSON.stringify(answer.body)).toBe(200);
  return answer.body as MatchesPage;
};

describe('how a match ended, said from each side (ADR 0089)', () => {
  it('says who left or whose time ran out, from the reader’s side', async () => {
    const me = await account();
    const jo = await account();
    // Jo left a live match; I disconnected from one; my turn ran out; Jo's did; Jo never opened
    // the lineup; neither of us did; one played out.
    const left = { status: 'forfeit', live: true } as const;
    await played(me, jo, { ...left, winner: 'a', reason: 'left', ago: 70 });
    await played(jo, me, { ...left, winner: 'a', reason: 'disconnected', ago: 60 });
    await played(me, jo, { status: 'forfeit', winner: 'b', reason: 'timeout', ago: 50 });
    await played(jo, me, { status: 'forfeit', winner: 'b', reason: 'timeout', ago: 40 });
    await played(me, jo, { ...left, winner: 'a', reason: 'start_missed', ago: 30 });
    await played(me, jo, { ...left, winner: null, reason: 'start_missed', ago: 20 });
    await played(me, jo, { status: 'finished', winner: 'a', rounds: { a: 2, b: 0 }, ago: 10 });
    const endings = async (player: Player) =>
      (await recordOf(player)).recent.map((row) => row.ending).reverse();
    expect(await endings(me)).toStrictEqual([
      'theyLeft',
      'youLeft',
      'yourTime',
      'theirTime',
      'theirTime',
      'yourTime',
      null,
    ]);
    expect(await endings(jo)).toStrictEqual([
      'youLeft',
      'theyLeft',
      'theirTime',
      'yourTime',
      'yourTime',
      'yourTime',
      null,
    ]);
  });

  it('says a deleted player left', async () => {
    const me = await account();
    const jo = await account();
    await newSeries(deps, { a: me, b: jo }, 'reveal');
    // The deletion's own trigger forfeits the open series to me, with no reason.
    await admin`delete from game.profiles where user_id = ${jo.userId}`;
    const [row] = (await recordOf(me)).recent;
    expect(row).toMatchObject({ opponent: null, won: true, forfeit: true, ending: 'theyLeft' });
  });
});

describe('Your stats (ADR 0089)', () => {
  it('splits live from by turns and Best of 3 from Best of 5, with the best streak', async () => {
    const me = await account();
    const jo = await account();
    const mine = ['vampire', 'archer', 'storm'];
    const theirs = ['brawler', 'magnet', 'frost'];
    // In finishing order: W W L W W W L; live the first three, Best of 5 the 4th and 7th.
    const results: readonly (readonly [boolean, boolean, 3 | 5])[] = [
      [true, true, 3],
      [true, true, 3],
      [false, true, 3],
      [true, false, 5],
      [true, false, 3],
      [true, false, 3],
      [false, false, 5],
    ];
    for (const [index, [won, live, bestOf]] of results.entries()) {
      // The last leaves out the Vampire, so the Archer (in all 7) is the favourite.
      const lineup = index === 6 ? ['archer', 'storm', 'hex', 'quake', 'ghost'] : mine;
      await played(
        me,
        jo,
        { status: 'finished', winner: won ? 'a' : 'b', live, bestOf, ago: 100 - index },
        [
          bestOf === 5 && lineup.length === 3 ? [...lineup, 'hex', 'quake'] : lineup,
          bestOf === 5 ? [...theirs, 'thorns', 'titan'] : theirs,
        ],
      );
    }
    const { stats, favourite } = await recordOf(me);
    expect(favourite).toBe('archer');
    expect(stats).toStrictEqual({
      live: { wins: 2, played: 3 },
      turns: { wins: 3, played: 4 },
      bestOf3: { wins: 4, played: 5 },
      bestOf5: { wins: 1, played: 2 },
      bestStreak: 3,
      favouriteIn: 7,
    });
    // From Jo's side: the two wins were never in a row.
    expect((await recordOf(jo)).stats.bestStreak).toBe(1);
  });
});

describe('All matches, a page at a time (ADR 0089)', () => {
  it('carries on from the cursor to the end, each match once, the latest first', async () => {
    const me = await account();
    const jo = await account();
    const ids: string[] = [];
    // 45 matches, two finishing at the same moment across the first page's edge (the keyset's
    // tie on id).
    for (let n = 0; n < 45; n += 1) {
      ids.push(await played(me, jo, { status: 'finished', winner: 'a', ago: n === 20 ? 19 : n }));
    }
    const first = await recordOf(me);
    expect(first.recent).toHaveLength(RECENT_SERIES);
    const second = await pageAfter(me, first.next ?? '');
    expect(second.matches).toHaveLength(RECENT_SERIES);
    const third = await pageAfter(me, second.next ?? '');
    expect(third.matches).toHaveLength(5);
    expect(third.next).toBeNull();
    const all = [...first.recent, ...second.matches, ...third.matches];
    expect(new Set(all.map((row) => row.id))).toStrictEqual(new Set(ids));
    expect(all).toHaveLength(45);
    const times = all.map((row) => Date.parse(row.finishedAt));
    expect(times).toStrictEqual([...times].sort((x, y) => y - x));
  });

  it('gives no cursor when the record is exactly one page', async () => {
    const me = await account();
    const jo = await account();
    for (let n = 0; n < RECENT_SERIES; n += 1) {
      await played(me, jo, { status: 'finished', winner: 'a', ago: n });
    }
    const mine = await recordOf(me);
    expect([mine.recent.length, mine.next]).toStrictEqual([RECENT_SERIES, null]);
  });

  it('counts each page as a read, refuses what isn’t a cursor, and lists only the reader’s', async () => {
    const me = await account();
    const sam = await account();
    const kim = await account();
    for (let n = 0; n <= RECENT_SERIES; n += 1) {
      await played(me, sam, { status: 'finished', winner: 'a', ago: n });
      await played(sam, kim, { status: 'finished', winner: 'a', ago: n });
    }
    const { next } = await recordOf(me);
    const reads = async () => {
      const [row] = await admin<{ count: number }[]>`
        select coalesce(sum(count), 0)::int as count from game.rate_limits
        where subject = ${me.userId} and bucket = 'read'`;
      return row?.count ?? 0;
    };
    const before = await reads();
    const page = await pageAfter(me, next ?? '');
    expect(await reads()).toBe(before + 1);
    expect(page.matches.map((row) => row.opponent)).toStrictEqual([sam.username]);
    // My cursor in Kim's hands only says where in time to carry on: Kim's own series from there.
    const kims = await pageAfter(kim, next ?? '');
    expect(kims.matches.every((row) => row.opponent === sam.username)).toBe(true);
    for (const after of ['', 'nonsense', '2026-11-27T10:00:00Z_x', `${next ?? ''}x`]) {
      const answer = await me.browser.call(
        meMatches,
        'GET',
        `/api/v1/me/matches?after=${encodeURIComponent(after)}`,
      );
      expect([answer.status, errorOf(answer.body)?.code]).toStrictEqual([400, 'bad_request']);
    }
    const guest = await newPlayer(deps);
    const refused = await guest.browser.call(
      meMatches,
      'GET',
      `/api/v1/me/matches?after=${encodeURIComponent(next ?? '')}`,
    );
    expect([refused.status, errorOf(refused.body)?.code]).toStrictEqual([403, 'not_an_account']);
  });

  it('answers both paths from the one function', async () => {
    const me = await account();
    const record = await me.browser.call(meRecordRoutes, 'GET', '/api/v1/me/record');
    expect((record.body as RecordResponse).recent).toStrictEqual([]);
    const cursor = '2026-11-27T10:00:00.000000Z_00000000-0000-0000-0000-000000000000';
    const page = await me.browser.call(
      meRecordRoutes,
      'GET',
      `/api/v1/me/matches?after=${encodeURIComponent(cursor)}`,
    );
    expect(page.body).toStrictEqual({ matches: [], next: null });
  });
});
