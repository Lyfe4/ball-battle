import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP, BALLS } from '../sim/balls/index.ts';
import { botPick, easyBot } from '../sim/bot.ts';
import { standingOf } from '../sim/counter-map.ts';
import { recordOutcome, recordPick, startSeries } from '../sim/series.ts';
import { revealFirst } from '../sim/series-seeds.ts';
import { WHOLE_RUN_TIMEOUT_MS } from '../sim/test-support.ts';
import {
  firstSeriesOn,
  firstSeriesSeed,
  firstSeriesSeedSliced,
  gridOf,
  isNaturalGrid,
} from './first-series-seed.ts';
import { STARTER_TRIO } from './first-series-setup.ts';

const roster = BALLS.map((ball) => ball.id);

/**
 * A spread of lineups: Pick for me's, and five drawn across the roster. The rules are checked here;
 * how often they hold over many series is `scripts/first-series-measure.ts`'s (ADR 0090 addendum).
 */
const lineups = [
  STARTER_TRIO,
  ...Array.from({ length: 5 }, (_, n) => [
    roster[(n * 7) % roster.length] ?? '',
    roster[(n * 11 + 3) % roster.length] ?? '',
    roster[(n * 13 + 5) % roster.length] ?? '',
  ]).filter((lineup) => new Set(lineup).size === 3),
];

/**
 * Each lineup's chosen seed, searched once for the file: the search plays fights (about 0.1-0.3 s
 * a lineup), and both properties below read the same seeds, so a loaded machine runs it once.
 */
let chosen: (readonly [readonly string[], number])[] | undefined;
const seeds = () =>
  (chosen ??= lineups.map((a, n) => [a, firstSeriesSeed(n * 104729, a, roster, BALL_LOOKUP)]));

describe('the first series’ seed (ADR 0090 addendum "Tuned to teach")', () => {
  // The search plays whole fights: a time budget of its own, not Vitest's 5 s (CLAUDE.md).
  it(
    'lets the bot show first a ball the player has a ▲ answer to, on a natural grid',
    { timeout: WHOLE_RUN_TIMEOUT_MS },
    () => {
      for (const [a, seed] of seeds()) {
        expect(revealFirst(seed)).toBe('b');
        const setup = firstSeriesOn(seed, a, roster);
        const grid = gridOf(a, setup.b);
        expect(isNaturalGrid(grid), `${a.join()} vs ${setup.b.join()}`).toBe(true);
        const shown = botPick(easyBot, startSeries(setup)) ?? '';
        expect(a.some((x) => standingOf(x, shown) > 0)).toBe(true);
      }
    },
  );

  it(
    'never lets Easy answer round 2 with a ball favoured against the player',
    { timeout: WHOLE_RUN_TIMEOUT_MS },
    () => {
      for (const [a, seed] of seeds()) {
        const start = startSeries(firstSeriesOn(seed, a, roster));
        const r1 = recordPick(start, botPick(easyBot, start) ?? '');
        for (const p1 of a) {
          const after = recordOutcome(recordPick(r1, p1), 'a');
          for (const p2 of a.filter((x) => x !== p1)) {
            // Round 2's answer is drawn the same whoever won round 1 (Easy reads no score).
            const answer = botPick(easyBot, recordPick(after, p2)) ?? '';
            expect(standingOf(p2, answer)).toBeGreaterThanOrEqual(0);
          }
        }
      }
    },
  );

  it(
    'is pure: the same seed and lineup give the same seed, sliced or at once',
    { timeout: WHOLE_RUN_TIMEOUT_MS },
    async () => {
      const at = firstSeriesSeed(4242, STARTER_TRIO, roster, BALL_LOOKUP);
      expect(firstSeriesSeed(4242, STARTER_TRIO, roster, BALL_LOOKUP)).toBe(at);
      let clock = 0;
      let pauses = 0;
      const sliced = await firstSeriesSeedSliced(
        4242,
        STARTER_TRIO,
        roster,
        BALL_LOOKUP,
        () => (clock += 5),
        () => {
          pauses++;
          return Promise.resolve();
        },
      );
      expect(sliced).toBe(at);
      expect(pauses).toBeGreaterThan(0);
    },
  );

  it('reads a grid from the player’s side', () => {
    const grid = gridOf(['archer'], ['archer']);
    expect(grid).toStrictEqual({ favoured: 0, strong: 0, against: 0, strongAgainst: 0 });
    expect(isNaturalGrid({ favoured: 2, strong: 1, against: 1, strongAgainst: 0 })).toBe(true);
    expect(isNaturalGrid({ favoured: 4, strong: 1, against: 0, strongAgainst: 0 })).toBe(false);
    expect(isNaturalGrid({ favoured: 2, strong: 2, against: 0, strongAgainst: 0 })).toBe(false);
    expect(isNaturalGrid({ favoured: 2, strong: 0, against: 2, strongAgainst: 0 })).toBe(false);
    expect(isNaturalGrid({ favoured: 1, strong: 0, against: 0, strongAgainst: 0 })).toBe(false);
  });
});
