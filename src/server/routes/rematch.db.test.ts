// A rematch after a live friend match (ADR 0055), against the local database: offered once a live
// match ends (a forfeit too), asked and answered once per series, both answering at once, a no or
// the ask running out ending it for both, and once both say yes the lineups picked together (ADR
// 0080) whose clock makes the new match: a new live series between the same two players, the same
// format and length, new lineups and new seeds.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorOf } from '../../api/errors.ts';
import { REMATCH_ANSWER_MS, type RematchView } from '../../api/rematch.ts';
import { startLineupMs, type StartView } from '../../api/start.ts';
import type { SeriesView } from '../../api/series.ts';
import { newLive, sendLive, startedLive } from '../test/live-support.ts';
import { newPlayer, newSeries, type Player } from '../test/series-support.ts';
import { adminSql, testDeps } from '../test/support.ts';
import { seriesOne } from './series.ts';
import { startOne } from './starts.ts';

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

const NEW = { a: ['storm', 'quake', 'ghost'], b: ['spartan', 'titan', 'venom'] } as const;

const rematch = (player: Player, id: string, body?: unknown) =>
  player.browser.call(
    seriesOne,
    body === undefined ? 'GET' : 'POST',
    `/api/v1/series/${id}/rematch`,
    body,
  );
const view = async (player: Player, id: string, body?: unknown) =>
  (await rematch(player, id, body)).body as RematchView;
const code = (body: unknown) => errorOf(body)?.code;
/** `player` locks `lineup` into the rematch's lineups picked together. */
const lockIn = async (player: Player, startId: string | null, lineup: readonly string[]) =>
  (
    await player.browser.call(startOne, 'POST', `/api/v1/starts/${startId ?? ''}`, {
      lineup,
      lock: true,
      seq: 1,
    })
  ).body as StartView;

/** A live match that ended: A left it, so B won by forfeit. */
async function ended() {
  const made = await startedLive(deps, admin);
  const left = await made.players.a.browser.call(
    seriesOne,
    'POST',
    `/api/v1/series/${made.id}/forfeit`,
    {},
  );
  expect((left.body as SeriesView).status).toBe('forfeit');
  return made;
}

/** Moves the rematch's times `ms` into the past. */
const travelRematch = (id: string, ms: number) => {
  const by = `${String(ms)} milliseconds`;
  return admin`
    update game.rematches set asked_at = asked_at - ${by}::interval,
      agreed_at = agreed_at - ${by}::interval
    where series_id = ${id}`;
};

describe('a rematch', () => {
  it('is offered once a live match ends, a forfeit too, and not before', async () => {
    const live = await startedLive(deps, admin);
    expect(await view(live.players.a, live.id)).toMatchObject({ state: 'none', offered: false });
    const asked = await rematch(live.players.a, live.id, { answer: 'yes' });
    expect(asked.status).toBe(409);
    expect(code(asked.body)).toBe('rematch_closed');

    const { id, players } = await ended();
    for (const player of [players.a, players.b]) {
      expect(await view(player, id)).toMatchObject({
        state: 'none',
        offered: true,
        seriesId: null,
      });
    }
  });

  it('is offered for 2 minutes from the end both players watch, not from the deciding pick', async () => {
    // The deciding pick writes finished_at; the last fight still plays until its ends_at, up to
    // about 70 s later (and longer after a drawn attempt).
    const { id, players } = await ended();
    const lastFightEndsIn = async (seconds: number) => {
      await admin`delete from game.rounds where series_id = ${id}`;
      await admin`
        insert into game.rounds
          (series_id, round, a, b, seeds, outcomes, winner, sudden_death, fight_at, ends_at)
        values (${id}, 0, 'storm', 'titan', '{1}', '{a}', 'a', false,
          now() + make_interval(secs => ${seconds - 70}), now() + make_interval(secs => ${seconds}))`;
    };
    await admin`update game.series set finished_at = now() - interval '130 seconds' where id = ${id}`;

    await lastFightEndsIn(20);
    expect((await view(players.a, id)).offered).toBe(false);
    await lastFightEndsIn(-30);
    expect((await view(players.a, id)).offered).toBe(true);
    await lastFightEndsIn(-125);
    expect((await view(players.a, id)).offered).toBe(false);
  });

  it('is never offered for a series by turns, nor to anyone outside the match', async () => {
    const players = { a: await newPlayer(deps), b: await newPlayer(deps) };
    const id = await newSeries(deps, players, 'reveal');
    expect((await view(players.a, id)).offered).toBe(false);
    const { id: live } = await ended();
    const stranger = await newPlayer(deps);
    expect((await rematch(stranger, live)).status).toBe(404);
  });

  it('is asked once, answered yes, and starts a new live match when both lineups are in', async () => {
    const { id, players } = await ended();
    const asked = await view(players.a, id, { answer: 'yes' });
    expect(asked).toMatchObject({ state: 'asked', askedBy: 'a' });
    expect((asked.deadline ?? 0) - asked.now).toBeGreaterThan(REMATCH_ANSWER_MS - 5_000);
    // A second tap by the asker changes nothing.
    expect(await view(players.a, id, { answer: 'yes' })).toMatchObject({ state: 'asked' });
    expect(await view(players.b, id)).toMatchObject({ state: 'asked', askedBy: 'a' });

    const agreed = await view(players.b, id, { answer: 'yes' });
    expect(agreed).toMatchObject({ state: 'agreed' });
    // The lineups are picked together from the yes (ADR 0080), on their own clock.
    expect((agreed.deadline ?? 0) - agreed.now).toBeGreaterThan(startLineupMs(3) - 5_000);
    expect(await lockIn(players.a, agreed.startId, NEW.a)).toMatchObject({ rematchOf: id });
    expect(await view(players.a, id)).toMatchObject({ state: 'agreed', lineupIn: true });
    await lockIn(players.b, agreed.startId, NEW.b);
    const started = await view(players.b, id);
    expect(started.state).toBe('started');
    expect(started.seriesId).not.toBeNull();
    expect((await view(players.a, id)).seriesId).toBe(started.seriesId);

    const [row] = await admin<
      { live: boolean; format: string; best_of: number; lineup_a: string[]; lineup_b: string[] }[]
    >`select live, format, best_of, lineup_a, lineup_b from game.series where id = ${started.seriesId ?? ''}`;
    expect(row).toStrictEqual({
      live: true,
      format: 'reveal',
      best_of: 3,
      lineup_a: [...NEW.a],
      lineup_b: [...NEW.b],
    });
    // New seeds: none of the new series' commitments is one of the old one's.
    const commitments = (series: string) =>
      admin<
        { commitment: string }[]
      >`select encode(commitment, 'hex') as commitment from game.series_seeds where series_id = ${series}`;
    const old = new Set((await commitments(id)).map((seed) => seed.commitment));
    for (const seed of await commitments(started.seriesId ?? '')) {
      expect(old.has(seed.commitment)).toBe(false);
    }
    // One rematch per series: asking again answers the match it already started.
    expect(await view(players.b, id, { answer: 'yes' })).toMatchObject({
      state: 'started',
      seriesId: started.seriesId,
    });
  });

  it('agrees when both players ask at once, on two hosts', async () => {
    // Five times, so the two asks really meet on the series row. One connection takes one query
    // at a time, so each pair runs on two hosts and the pairs one after another.
    for (let tries = 0; tries < 5; tries += 1) {
      const { id, players } = await ended();
      const tab = { ...players.b, browser: players.b.browser.elsewhere(other) };
      const [one, two] = await Promise.all([
        view(players.a, id, { answer: 'yes' }),
        view(tab, id, { answer: 'yes' }),
      ]);
      expect([one.state, two.state].sort()).toStrictEqual(['agreed', 'asked']);
      expect((await view(players.a, id)).state).toBe('agreed');
    }
  });

  it('ends for both on a no, and can’t be asked again', async () => {
    const { id, players } = await ended();
    await view(players.b, id, { answer: 'yes' });
    expect(await view(players.a, id, { answer: 'no' })).toMatchObject({
      state: 'declined',
      declinedBy: 'a',
    });
    expect(await view(players.b, id)).toMatchObject({ state: 'declined', declinedBy: 'a' });
    const again = await rematch(players.b, id, { answer: 'yes' });
    expect(code(again.body)).toBe('rematch_closed');
  });

  it('refuses a lineup on its own route: the lineups are picked on the start (ADR 0080)', async () => {
    const { id, players } = await ended();
    await view(players.a, id, { answer: 'yes' });
    const agreed = await view(players.b, id, { answer: 'yes' });
    const old = await rematch(players.a, id, { lineup: NEW.a });
    expect(old.status).toBe(400);
    expect(code(old.body)).toBe('bad_request');
    expect(await view(players.a, id)).toMatchObject({ state: 'agreed', lineupIn: false });
    expect(agreed.startId).not.toBeNull();
  });

  it('ends for both when the answer runs out; lineups out of time still make the match', async () => {
    const unanswered = await ended();
    await view(unanswered.players.a, unanswered.id, { answer: 'yes' });
    await travelRematch(unanswered.id, REMATCH_ANSWER_MS + 1_000);
    expect((await view(unanswered.players.b, unanswered.id)).state).toBe('expired');
    const late = await rematch(unanswered.players.b, unanswered.id, { answer: 'yes' });
    expect(code(late.body)).toBe('rematch_closed');

    const slow = await ended();
    await view(slow.players.a, slow.id, { answer: 'yes' });
    const agreed = await view(slow.players.b, slow.id, { answer: 'yes' });
    await lockIn(slow.players.a, agreed.startId, NEW.a);
    // B opened the lineup but never finished it: finished at random when the clock runs out.
    await slow.players.b.browser.call(startOne, 'GET', `/api/v1/starts/${agreed.startId ?? ''}`);
    await admin`update game.starts set deadline_at = now() - interval '1 second',
      agreed_at = now() - interval '61 seconds' where id = ${agreed.startId ?? ''}`;
    const started = await view(slow.players.a, slow.id);
    expect(started.state).toBe('started');
    const [row] = await admin<{ status: string; lineup_a: string[] }[]>`
      select status, lineup_a from game.series where id = ${started.seriesId ?? ''}`;
    expect(row).toStrictEqual({ status: 'open', lineup_a: [...NEW.a] });
  });

  it('refuses a yes from a player who is in another live match by then', async () => {
    const { id, players } = await ended();
    await view(players.a, id, { answer: 'yes' });
    const busy = await newLive(deps);
    await admin`update game.series set player_b = ${players.b.userId} where id = ${busy.id}`;
    const refused = await rematch(players.b, id, { answer: 'yes' });
    expect(refused.status).toBe(409);
    expect(code(refused.body)).toBe('in_a_match');
    // Still asked: they can still say no, and the asker's clock runs on.
    expect((await view(players.a, id)).state).toBe('asked');
    expect((await view(players.b, id, { answer: 'no' })).state).toBe('declined');
  });

  it('holds both players to it from the yes', async () => {
    const { id, players } = await ended();
    await view(players.a, id, { answer: 'yes' });
    await view(players.b, id, { answer: 'yes' });
    // Choosing the rematch's lineup is their live match: neither can start another one.
    for (const player of [players.a, players.b]) {
      const sent = await sendLive(player);
      expect(sent.status).toBe(409);
      expect(code(sent.body)).toBe('in_a_match');
    }
    const [{ n } = { n: 0 }] = await admin<{ n: number }[]>`
      select count(*)::int as n from game.starts where rematch_of = ${id} and series_id is null`;
    expect(n).toBe(1);
    expect((await view(players.a, id)).state).toBe('agreed');
  });
});
