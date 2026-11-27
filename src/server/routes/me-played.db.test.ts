// /me says whether an account has finished an online series (ADR 0090 addendum), read in the same
// statement as its profile: any device it signs in on is past the guided first series. Never for
// a guest, never for open or void series.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PlayerResponse } from '../../api/session.ts';
import { newAccount } from '../test/friends-support.ts';
import { recordSupport } from '../test/record-support.ts';
import { newPlayer, newSeries, type Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { me } from './me.ts';

const deps = testDeps();
const admin = adminSql();
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
});
afterAll(async () => {
  await deps.sql.end();
  await admin.end();
});

const { played } = recordSupport(deps, admin);
async function meOf(player: Player): Promise<PlayerResponse> {
  const answer = await player.browser.call(me, 'GET', '/api/v1/me');
  expect(answer.status, JSON.stringify(answer.body)).toBe(200);
  return answer.body as PlayerResponse;
}

describe('/me and the first series (ADR 0090 addendum)', () => {
  it('says played once an account has finished an online series, never before', async () => {
    const sam = await newAccount(deps, admin);
    const jo = await newAccount(deps, admin);
    expect((await meOf(sam)).played).toBe(false);
    // An open series and a void one are not played.
    await newSeries(deps, { a: sam, b: jo }, 'reveal');
    await played(sam, jo, { status: 'void', winner: null });
    expect((await meOf(sam)).played).toBe(false);
    await played(jo, sam, { status: 'forfeit', winner: 'b', live: true });
    expect((await meOf(sam)).played).toBe(true);
    expect((await meOf(jo)).played).toBe(true);
  });

  it('says nothing of it for a guest', async () => {
    const guest = await newPlayer(deps);
    expect(Object.keys(await meOf(guest))).not.toContain('played');
  });
});
