// Lineups picked together (ADR 0080), against the local database: a live challenge is sent without
// a lineup and accepted into a start; both players build theirs at once on one clock, each seeing
// only whether the other is ready; the series (and its seeds) is made only when both are locked in
// or the clock has run out, a draft then finished at random and a player who never opened the
// lineup losing by forfeit. One start per challenge, one live match per player.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Accepted, ChallengeInfo } from '../../api/challenges.ts';
import { errorOf } from '../../api/errors.ts';
import { startLineupMs, type StartView } from '../../api/start.ts';
import { linkInfo, tokenOf } from '../test/live-support.ts';
import { newPlayer, read, type Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { challengeOne, challenges } from './challenges.ts';
import { startOne } from './starts.ts';
import { sweep } from '../sweep.ts';

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

const A = ['storm', 'quake', 'ghost'];
const B = ['spartan', 'titan', 'venom'];
const code = (body: unknown) => errorOf(body)?.code;

const send = (from: Player, bestOf = 3, friendLineup?: readonly string[]) =>
  from.browser.call(challenges, 'POST', '/api/v1/challenges', {
    format: 'reveal',
    bestOf,
    requestId: crypto.randomUUID(),
    live: true,
    ...(friendLineup === undefined ? {} : { lineup: friendLineup }),
  });
const accept = (by: Player, token: string) =>
  by.browser.call(challengeOne, 'POST', `/api/v1/challenges/${token}/accept`, {});
const startOf = async (player: Player, id: string) =>
  (await player.browser.call(startOne, 'GET', `/api/v1/starts/${id}`)).body as StartView;
const move = (player: Player, id: string, lineup: readonly string[], lock: boolean, seq: number) =>
  player.browser.call(startOne, 'POST', `/api/v1/starts/${id}`, { lineup, lock, seq });
const moved = async (...args: Parameters<typeof move>) => (await move(...args)).body as StartView;

/** Two players, a live challenge sent without a lineup and accepted: its start. */
async function agreed(bestOf = 3) {
  const players = { a: await newPlayer(deps), b: await newPlayer(deps) };
  const sent = await send(players.a, bestOf);
  expect(sent.status).toBe(201);
  const token = tokenOf(sent);
  const answer = await accept(players.b, token);
  expect(answer.status).toBe(200);
  const { startId, seriesId } = answer.body as Accepted;
  expect(seriesId).toBeNull();
  if (startId === null) throw new Error('No start');
  return { players, token, id: startId };
}

/** Moves the start's clock `ms` into the past. */
const travelStart = (id: string, ms: number) => {
  const by = `${String(ms)} milliseconds`;
  return admin`
    update game.starts set agreed_at = agreed_at - ${by}::interval,
      deadline_at = deadline_at - ${by}::interval, opened_a = opened_a - ${by}::interval,
      opened_b = opened_b - ${by}::interval, locked_a = locked_a - ${by}::interval,
      locked_b = locked_b - ${by}::interval
    where id = ${id}`;
};
const seedCount = async (seriesId: string | null) => {
  if (seriesId === null) return 0;
  const [row] = await admin<{ n: number }[]>`
    select count(*)::int as n from game.series_seeds where series_id = ${seriesId}`;
  return row?.n ?? 0;
};
const lineupsOf = async (seriesId: string) => {
  const [row] = await admin<{ lineup_a: string[]; lineup_b: string[] }[]>`
    select lineup_a, lineup_b from game.series where id = ${seriesId}`;
  return row;
};

describe('a live challenge accepted', () => {
  it('is sent without a lineup and starts the lineups, not the series', async () => {
    const { players, token, id } = await agreed();
    const seen = await startOf(players.a, id);
    expect(seen).toMatchObject({ you: 'a', bestOf: 3, draft: [], locked: false, seriesId: null });
    expect(seen.deadline - seen.now).toBeGreaterThan(startLineupMs(3) - 5_000);
    expect(seen.deadline - seen.now).toBeLessThanOrEqual(startLineupMs(3));
    // The sender's lobby and the friend both learn of the start; nobody else does.
    const info = (await linkInfo(players.a, token)).body as ChallengeInfo;
    expect(info).toMatchObject({ status: 'yours', startId: id, seriesId: null });
    const stranger = await newPlayer(deps);
    expect((await linkInfo(stranger, token)).body).toMatchObject({
      status: 'taken',
      startId: null,
    });
    expect((await stranger.browser.call(startOne, 'GET', `/api/v1/starts/${id}`)).status).toBe(404);
  });

  it('gives Best of 5 longer: 75 s', async () => {
    const { players, id } = await agreed(5);
    const seen = await startOf(players.b, id);
    expect(seen.deadline - seen.now).toBeGreaterThan(startLineupMs(5) - 5_000);
    expect(startLineupMs(5)).toBe(75_000);
    expect(startLineupMs(3)).toBe(60_000);
  });

  it('is one start however many times or from however many hosts it is accepted', async () => {
    const players = { a: await newPlayer(deps), b: await newPlayer(deps) };
    const token = tokenOf(await send(players.a));
    const [one, two] = [
      await accept(players.b, token),
      await players.b.browser.call(challengeOne, 'POST', `/api/v1/challenges/${token}/accept`, {}),
    ];
    expect((one.body as Accepted).startId).toBe((two.body as Accepted).startId);
    const third = await newPlayer(deps);
    const late = await accept(third, token);
    expect(late.status).toBe(409);
    expect(code(late.body)).toBe('challenge_taken');
  });

  it('counts as the live match of both players from the Accept (in_a_match)', async () => {
    const { players } = await agreed();
    for (const player of [players.a, players.b]) {
      const again = await send(player);
      expect(again.status).toBe(409);
      expect(code(again.body)).toBe('in_a_match');
    }
  });

  it('refuses at Accept a friend already in another live match', async () => {
    const busy = await agreed();
    const sender = await newPlayer(deps);
    const token = tokenOf(await send(sender));
    const refused = await accept(busy.players.b, token);
    expect(refused.status).toBe(409);
    expect(code(refused.body)).toBe('in_a_match');
  });
});

describe('the lineups picked together', () => {
  it('shows each player only their own draft and whether the other is ready', async () => {
    const { players, id } = await agreed();
    await moved(players.a, id, ['storm'], false, 1);
    const locked = await moved(players.b, id, B, true, 1);
    expect(locked).toMatchObject({ draft: B, locked: true, theirsLocked: false, seriesId: null });
    const a = await startOf(players.a, id);
    expect(a).toMatchObject({ draft: ['storm'], locked: false, theirsLocked: true });
    expect(JSON.stringify(a)).not.toContain('spartan');
  });

  it('keeps the newest draft when an older one arrives late', async () => {
    const { players, id } = await agreed();
    await moved(players.a, id, ['storm', 'quake'], false, 2);
    const late = await moved(players.a, id, ['ghost'], false, 1);
    expect(late.draft).toStrictEqual(['storm', 'quake']);
    expect(late.seq).toBe(2);
  });

  it('refuses a lineup that is not different balls of the roster, or too long', async () => {
    const { players, id } = await agreed();
    for (const lineup of [['storm', 'storm'], ['nope'], ['storm', 'quake', 'ghost', 'titan']]) {
      const refused = await move(players.a, id, lineup, false, 9);
      expect(refused.status).toBe(400);
    }
    const short = await move(players.a, id, ['storm'], true, 10);
    expect(short.status).toBe(400);
  });

  it('makes the series, and only then its seeds, once both are locked in', async () => {
    const { players, id } = await agreed();
    await moved(players.a, id, A, true, 1);
    expect(await seedCount((await startOf(players.a, id)).seriesId)).toBe(0);
    const [{ n: before } = { n: 0 }] = await admin<{ n: number }[]>`
      select count(*)::int as n from game.series where player_a = ${players.a.userId}`;
    expect(before).toBe(0);
    const made = await moved(players.b, id, B, true, 1);
    expect(made.seriesId).not.toBeNull();
    const seriesId = made.seriesId ?? '';
    expect(await seedCount(seriesId)).toBeGreaterThan(0);
    expect(await lineupsOf(seriesId)).toStrictEqual({ lineup_a: A, lineup_b: B });
    expect(made).toMatchObject({ filled: [], missed: [] });
    // Both go into the live series from there: a player and their side as accepted.
    const view = await read(players.a, seriesId);
    expect(view).toMatchObject({ you: 'a', status: 'open' });
    // Lock again changes nothing.
    expect((await moved(players.a, id, B, true, 2)).seriesId).toBe(seriesId);
  });

  it('refuses nothing after the deadline but lets the clock decide first', async () => {
    const { players, id } = await agreed();
    await startOf(players.a, id);
    await startOf(players.b, id);
    await travelStart(id, startLineupMs(3) + 1);
    const late = await moved(players.a, id, A, true, 1);
    expect(late.seriesId).not.toBeNull();
    // The lock after the deadline never went in: A's lineup was finished at random.
    expect(late.filled).toStrictEqual(['a', 'b']);
  });

  it('finishes a draft at random when the clock runs out, keeping what was chosen', async () => {
    const { players, id } = await agreed();
    await moved(players.a, id, ['storm'], false, 1);
    await moved(players.b, id, B, true, 1);
    await travelStart(id, startLineupMs(3) + 1);
    const made = await startOf(players.b, id);
    expect(made).toMatchObject({ filled: ['a'], missed: [] });
    const lineups = await lineupsOf(made.seriesId ?? '');
    expect(lineups?.lineup_b).toStrictEqual(B);
    expect(lineups?.lineup_a[0]).toBe('storm');
    expect(new Set(lineups?.lineup_a).size).toBe(3);
    const series = await read(players.a, made.seriesId ?? '');
    expect(series.status).toBe('open');
  });

  it('forfeits by start_missed only a player who never opened the lineup', async () => {
    const { players, id } = await agreed();
    await moved(players.b, id, ['spartan'], false, 1);
    await travelStart(id, startLineupMs(3) + 1);
    // A reads only now, after the deadline: too late to count as opened.
    const made = await startOf(players.a, id);
    expect(made).toMatchObject({ filled: ['b'], missed: ['a'] });
    const series = await read(players.b, made.seriesId ?? '');
    expect(series).toMatchObject({ status: 'forfeit', winner: 'b' });
    expect(series.live?.endReason).toBe('start_missed');
  });

  it('wins nobody when neither opened it, settled by the sweep', async () => {
    const { players, id } = await agreed();
    // Accepting is not opening: B never read the start either.
    await travelStart(id, startLineupMs(3) + 1);
    await sweep(deps);
    const [row] = await admin<{ series_id: string | null }[]>`
      select series_id from game.starts where id = ${id}`;
    const series = await read(players.a, row?.series_id ?? '');
    expect(series).toMatchObject({ status: 'forfeit', winner: null });
  });

  it('settles out of time when a player tries to start another match', async () => {
    const { players, id } = await agreed();
    await travelStart(id, startLineupMs(3) + 1);
    // Neither opened it: the start becomes a forfeit at once, so both are free again.
    const again = await send(players.a);
    expect(again.status).toBe(201);
    const [row] = await admin<{ series_id: string | null }[]>`
      select series_id from game.starts where id = ${id}`;
    expect(row?.series_id).not.toBeNull();
  });

  it('makes one series when both lock in at once on two hosts', async () => {
    const { players, id } = await agreed();
    const bOther = { ...players.b, browser: players.b.browser.elsewhere(other) };
    const [one, two] = await Promise.all([
      moved(players.a, id, A, true, 1),
      moved(bOther, id, B, true, 1),
    ]);
    const made = one.seriesId ?? two.seriesId;
    expect(made).not.toBeNull();
    const [{ n } = { n: 0 }] = await admin<{ n: number }[]>`
      select count(*)::int as n from game.series where player_a = ${players.a.userId}`;
    expect(n).toBe(1);
  });
});

describe('a page of the last release', () => {
  it('sends a live challenge with its lineup: the sender is locked in, the friend picks', async () => {
    const players = { a: await newPlayer(deps), b: await newPlayer(deps) };
    const token = tokenOf(await send(players.a, 3, A));
    const { startId } = (await accept(players.b, token)).body as Accepted;
    const made = await moved(players.b, startId ?? '', B, true, 1);
    expect(made.seriesId).not.toBeNull();
    expect(await lineupsOf(made.seriesId ?? '')).toStrictEqual({ lineup_a: A, lineup_b: B });
    // The old lobby waits for a series id on the link: it gets one.
    expect((await linkInfo(players.a, token)).body).toMatchObject({ seriesId: made.seriesId });
  });

  it('is told to reload when it accepts a challenge sent without a lineup', async () => {
    const players = { a: await newPlayer(deps), b: await newPlayer(deps) };
    const token = tokenOf(await send(players.a));
    const old = await players.b.browser.call(
      challengeOne,
      'POST',
      `/api/v1/challenges/${token}/accept`,
      { lineup: B },
    );
    expect(old.status).toBe(409);
    expect(code(old.body)).toBe('conflict');
  });
});
