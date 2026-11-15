// A live series' clock against the local database, through the pooler (ADR 0053): the start once
// both are here, the start window, picks that run out, fights the server times, early picks
// refused, and a player who goes quiet. Time is moved by shifting the series' stored past.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorOf } from '../../api/errors.ts';
import { LEAD_MS, PICK_SECONDS, START_WINDOW_MS } from '../../api/live.ts';
import { sweep } from '../sweep.ts';
import {
  liveRounds,
  liveRow,
  newLive,
  silence,
  startedLive,
  storedPicks,
  travel,
} from '../test/live-support.ts';
import { dueSides, leftOf, pick, read, view } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';

const deps = testDeps();
/** A second function instance, with its own connection. */
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

const code = (body: unknown) => errorOf(body)?.code;
const PICK_MS = PICK_SECONDS * 1000;

describe('the start', () => {
  it('waits for both players, refusing picks until then, then opens the first pick for 30 s', async () => {
    const { id, players } = await newLive(deps);
    const before = await liveRow(admin, id);
    expect(before.started).toBeNull();
    expect(before.deadline).toBeNull();
    const waiting = await read(players.b, id);
    const early = await pick(players.b, id, 0, leftOf(waiting, 'b')[0] ?? '');
    expect(early.status).toBe(409);
    expect(code(early.body)).toBe('too_early');

    await read(players.a, id);
    const row = await liveRow(admin, id);
    expect(row.started).not.toBeNull();
    expect(row.opens).toBe(row.started);
    expect(row.deadline).toBe((row.started ?? 0) + PICK_MS);
    expect(row.now - (row.started ?? 0)).toBeLessThan(5_000);
  });

  it('forfeits to the friend who came when the sender misses the start window', async () => {
    const { id, players } = await newLive(deps);
    await travel(admin, id, START_WINDOW_MS - 2_000);
    await read(players.b, id);
    expect((await liveRow(admin, id)).status).toBe('open');
    await travel(admin, id, 3_000);
    const seen = await read(players.b, id);
    expect(seen).toMatchObject({ status: 'forfeit', winner: 'b' });
    expect((await liveRow(admin, id)).end_reason).toBe('start_missed');
  });
});

describe('a pick that runs out', () => {
  it('is made at random from the balls left, as of its deadline, and says so', async () => {
    const { id, players } = await startedLive(deps);
    const seen = await read(players.a, id);
    const [side] = dueSides(seen);
    const { deadline } = await liveRow(admin, id);
    await travel(admin, id, PICK_MS + 1_000);
    const after = await read(players.a, id);
    const [stored] = await storedPicks(admin, id);
    expect(stored).toMatchObject({ round: 0, side, auto: true });
    expect(leftOf(seen, side ?? 'a')).toContain(stored?.ball);
    expect(after.picks).toContainEqual({ round: 0, side, ball: stored?.ball });
    // The answer's pick phase opened when the shown pick was made: at the old deadline.
    const row = await liveRow(admin, id);
    expect(row.opens).toBe((deadline ?? 0) - (PICK_MS + 1_000));
    expect(row.status).toBe('open');
  });

  it('is made once when both players’ reads race to settle it', async () => {
    const { id, players } = await startedLive(deps);
    await travel(admin, id, PICK_MS + 1_000);
    const tab = { ...players.b, browser: players.b.browser.elsewhere(other) };
    const [one, two] = await Promise.all([read(players.a, id), read(tab, id)]);
    const stored = await storedPicks(admin, id);
    expect(stored).toHaveLength(1);
    expect(one.picks).toContainEqual({ round: 0, side: stored[0]?.side, ball: stored[0]?.ball });
    expect(two.picks).toContainEqual({ round: 0, side: stored[0]?.side, ball: stored[0]?.ball });
  });

  it('in Showdown’s opener, is made for each side that hadn’t locked, the locked pick kept', async () => {
    const { id, players } = await startedLive(deps, 'showdown');
    const ball = leftOf(await read(players.a, id), 'a')[0] ?? '';
    view(await pick(players.a, id, 0, ball));
    await travel(admin, id, PICK_MS + 1_000);
    await read(players.a, id);
    const stored = await storedPicks(admin, id);
    expect(stored.map(({ side, ball: b, auto }) => ({ side, b, auto }))).toStrictEqual([
      { side: 'a', b: ball, auto: false },
      { side: 'b', b: stored[1]?.ball, auto: true },
    ]);
    expect(await liveRounds(admin, id)).toHaveLength(1);
  });
});

describe('a fight', () => {
  it('starts 3 s after the lock that completes its round; the next pick opens when it ends', async () => {
    const { id, players } = await startedLive(deps, 'showdown');
    for (const side of ['a', 'b'] as const) {
      view(await pick(players[side], id, 0, leftOf(await read(players[side], id), side)[0] ?? ''));
    }
    const picks = await storedPicks(admin, id);
    const locked = Math.max(...picks.map((p) => p.at));
    const [fight] = await liveRounds(admin, id);
    // The lock time is the database's at the pick's read, a moment before the write.
    expect(locked - ((fight?.fight ?? 0) - LEAD_MS)).toBeLessThan(2_000);
    expect(locked - ((fight?.fight ?? 0) - LEAD_MS)).toBeGreaterThanOrEqual(0);
    const row = await liveRow(admin, id);
    expect(row.opens).toBe(fight?.ends);
    expect(row.deadline).toBe((fight?.ends ?? 0) + PICK_MS);
  });

  it('refuses the next pick while it is on, and takes it once it has ended', async () => {
    const { id, players } = await startedLive(deps, 'showdown');
    for (const side of ['a', 'b'] as const) {
      view(await pick(players[side], id, 0, leftOf(await read(players[side], id), side)[0] ?? ''));
    }
    const seen = await read(players.a, id);
    const [next] = dueSides(seen);
    const player = players[next ?? 'a'];
    const ball = leftOf(await read(player, id), next ?? 'a')[0] ?? '';
    const early = await pick(player, id, 1, ball);
    expect(code(early.body)).toBe('too_early');
    const row = await liveRow(admin, id);
    await travel(admin, id, (row.opens ?? 0) - row.now + 100);
    expect((await pick(player, id, 1, ball)).status).toBe(200);
  });

  it('of Reveal’s last round plays after the one before, and the series ends verified', async () => {
    const { id, players } = await startedLive(deps);
    for (let round = 0; round < 2; round += 1) {
      for (let move = 0; move < 2; move += 1) {
        const [side] = dueSides(await read(players.a, id));
        if (side === undefined) break;
        const row = await liveRow(admin, id);
        if ((row.opens ?? 0) > row.now) await travel(admin, id, (row.opens ?? 0) - row.now + 50);
        const ball = leftOf(await read(players[side], id), side)[0] ?? '';
        view(await pick(players[side], id, round, ball));
      }
    }
    const final = await read(players.b, id);
    expect(final.status).toBe('finished');
    const fights = await liveRounds(admin, id);
    expect(fights.length).toBe(final.rounds.length);
    for (let i = 1; i < fights.length; i += 1) {
      expect(fights[i]?.fight ?? 0).toBeGreaterThanOrEqual((fights[i - 1]?.ends ?? 0) + LEAD_MS);
    }
  });
});

describe('a player who goes quiet', () => {
  it('can come back within the grace period and carry on', async () => {
    const { id, players } = await startedLive(deps);
    await silence(admin, id, 'a', 20_000);
    expect((await read(players.b, id)).status).toBe('open');
    expect((await read(players.a, id)).status).toBe('open');
  });

  it('loses by forfeit once silent past the notice and the grace period', async () => {
    const { id, players } = await startedLive(deps);
    await silence(admin, id, 'a', 37_000);
    expect(await read(players.b, id)).toMatchObject({ status: 'forfeit', winner: 'b' });
    expect((await liveRow(admin, id)).end_reason).toBe('disconnected');
  });

  it('is settled by the sweep when both have gone: whoever went first loses', async () => {
    const { id } = await startedLive(deps);
    await silence(admin, id, 'b', 50_000);
    await silence(admin, id, 'a', 45_000);
    const swept = await sweep(deps);
    expect(swept.live).toBeGreaterThanOrEqual(1);
    expect(await liveRow(admin, id)).toMatchObject({ status: 'forfeit', winner: 'a' });
  });
});
