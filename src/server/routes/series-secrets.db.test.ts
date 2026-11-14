// Nothing seed-shaped, and nothing a format hides, reaches a player before its lock (ADR 0051,
// ADR 0052 "What a player is sent"): every format and length played to its end by two players
// through the real routes, with both players' views checked after every lock.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isCommitted } from '../../api/fairness.ts';
import type { SeriesView } from '../../api/series.ts';
import { verifySeries, type BestOf, type Format, type Side } from '../../sim/index.ts';
import { importSeedKey, seriesSeeds } from '../seeds.ts';
import { adminSql, testDeps } from '../test/support.ts';
import {
  dueSides,
  leftOf,
  newPlayer,
  newSeries,
  pick,
  read,
  view,
} from '../test/series-support.ts';

const deps = testDeps();
const admin = adminSql();
beforeAll(async () => {
  await admin`delete from game.rate_limits`;
});
afterAll(async () => {
  await deps.sql.end();
  await admin.end();
});

/** Every value that must not be in a view yet: unrevealed salts, and the seeds behind them. */
async function secretsOf(id: string, format: Format, bestOf: BestOf): Promise<string[]> {
  const key = await importSeedKey(deps.config.currentSeedKey.raw);
  const { seeds } = await seriesSeeds(key, id, { bestOf, format, bot: false });
  const hidden = await admin<{ purpose: string; idx: number; salt: Buffer }[]>`
    select purpose, idx, salt from game.series_seeds where series_id = ${id} and seed is null`;
  return hidden.flatMap(({ purpose, idx, salt }) => {
    const seed = purpose === 'toss' ? seeds.toss : seeds.rounds[idx];
    return [salt.toString('hex'), String(seed)];
  });
}

async function expectNothingEarly(seen: SeriesView, viewer: Side, secrets: readonly string[]) {
  const text = JSON.stringify(seen);
  for (const secret of secrets) {
    expect(new RegExp(`(?<![0-9a-f])${secret}(?![0-9a-f])`).test(text), `leaked ${secret}`).toBe(
      false,
    );
  }
  for (const revealed of seen.revealed) expect(await isCommitted(revealed)).toBe(true);
  if (seen.status === 'open') {
    // A round's seed is revealed only once the round is played.
    for (const revealed of seen.revealed.filter((r) => r.purpose === 'round')) {
      expect(revealed.index).toBeLessThan(seen.rounds.length);
    }
    expect(seen.final).toBeNull();
  }
  // Showdown's round 1 is picked blind: the opponent's opener stays hidden until both lock.
  if (seen.format === 'showdown' && seen.rounds.length === 0) {
    expect(seen.picks.filter((p) => p.side !== viewer)).toStrictEqual([]);
  }
}

const CASES: readonly (readonly [Format, BestOf])[] = [
  ['blind', 3],
  ['reveal', 3],
  ['showdown', 3],
  ['blind', 5],
  ['reveal', 5],
  ['showdown', 5],
];

describe('a series by turns, seen by each player', () => {
  it.each(CASES)(
    '%s, best of %i: shows nothing before its lock, and verifies at the end',
    async (format, bestOf) => {
      const players = { a: await newPlayer(deps), b: await newPlayer(deps) };
      const id = await newSeries(deps, players, format, bestOf);
      let views = { a: await read(players.a, id), b: await read(players.b, id) };
      const check = async () => {
        const secrets = await secretsOf(id, format, bestOf);
        for (const side of ['a', 'b'] as const)
          await expectNothingEarly(views[side], side, secrets);
      };
      for (let step = 0; views.a.status === 'open'; step += 1) {
        expect(step, 'the series never ended').toBeLessThan(4 * bestOf);
        await check();
        // One lock at a time, then both views again: Showdown's opener is locked B side first.
        const side = dueSides(views.a).at(-1);
        if (side === undefined) break;
        const ball = leftOf(views[side], side)[0] ?? '';
        view(await pick(players[side], id, views[side].rounds.length, ball));
        views = { a: await read(players.a, id), b: await read(players.b, id) };
      }
      await check();
      const end = views.a;
      expect(end.status).toBe('finished');
      expect(end.winner).not.toBeNull();
      expect(end.revealed).toHaveLength(end.commitments.length);
      for (const revealed of end.revealed) expect(await isCommitted(revealed)).toBe(true);
      // Anyone can check the whole series from its final setup, here with the live sim.
      const verdict = verifySeries(end.final);
      expect(verdict.ok).toBe(true);
      if (verdict.ok) expect(verdict.state.winner).toBe(end.winner);
      expect(views.b).toStrictEqual({ ...end, you: 'b' });
    },
  );
});
