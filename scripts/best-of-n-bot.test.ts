import { describe, expect, it } from 'vitest';
import { WHOLE_RUN_TIMEOUT_MS } from '../src/sim/test-support.ts';
import { BALLS } from '../src/sim/balls/index.ts';
import { maximinMix } from '../src/sim/maximin.ts';
import { hardBot, type BotRole, type BotView } from '../src/sim/bot.ts';
import { createStream } from '../src/sim/rng.ts';
import { hardBotN, hardWeightsN, maximinMixN } from './best-of-n-bot.ts';
import { lineupsOf } from './reveal-analysis.ts';
import { samplePairs } from './series-analysis.ts';

const roster = BALLS.map((ball) => ball.id);

const worstOf = (matrix: number[][], mix: readonly number[]) =>
  Math.min(
    ...(matrix[0] ?? []).map((_, c) =>
      matrix.reduce((s, row, r) => s + (mix[r] ?? 0) * (row[c] ?? 0), 0),
    ),
  );

describe('the Hard bot for any lineup size', () => {
  it('finds the same equilibrium value as the sim’s exact 3 x 3 solver', () => {
    const random = createStream(7);
    for (let n = 0; n < 300; n++) {
      const matrix = [0, 1, 2].map(() => [0, 1, 2].map(() => random()));
      expect(worstOf(matrix, maximinMixN(matrix))).toBeCloseTo(
        worstOf(matrix, maximinMix(matrix)),
        9,
      );
    }
  });

  it('a mix no column can exploit beyond its value, at 5 x 5', () => {
    const random = createStream(11);
    for (let n = 0; n < 50; n++) {
      const matrix = [0, 1, 2, 3, 4].map(() => [0, 1, 2, 3, 4].map(() => random()));
      const mix = maximinMixN(matrix);
      expect(mix.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 9);
      // The column player's own maximin (on the negated transpose) meets it: the game's value.
      const transposed = (matrix[0] ?? []).map((_, c) => matrix.map((row) => -(row[c] ?? 0)));
      const columnMix = maximinMixN(transposed);
      expect(worstOf(matrix, mix)).toBeCloseTo(-worstOf(transposed, columnMix), 9);
    }
  });

  it('makes the sim’s Hard choices in a Best of 3', () => {
    const pairs = samplePairs(lineupsOf(roster), 150);
    for (const format of ['reveal', 'showdown'] as const) {
      for (const [own, opponent] of pairs) {
        const roles: [BotRole, string | undefined][] = [
          ['show', undefined],
          ['answer', opponent[0]],
          ...(format === 'showdown' ? ([['open', undefined]] as [BotRole, undefined][]) : []),
        ];
        for (const [role, shown] of roles) {
          const view: BotView = {
            format,
            seed: 0,
            round: 0,
            role,
            own,
            opponent,
            wins: 0,
            losses: 0,
            ...(shown === undefined ? {} : { shown }),
          };
          const mine = Object.fromEntries(hardWeightsN(view));
          for (const [ball, weight] of hardBot.weights(view)) {
            expect(mine[ball] ?? 0).toBeCloseTo(weight, 9);
          }
        }
      }
    }
  });

  it(
    'is the game’s Hard in a Best of 5 (ADR 0048): the same choices, every role and score',
    { timeout: WHOLE_RUN_TIMEOUT_MS },
    () => {
      const random = createStream(5);
      const take = (pool: string[], n: number) =>
        Array.from(
          { length: n },
          () => pool.splice(Math.floor(random() * pool.length), 1)[0] ?? '',
        );
      // Positions met in a Best of 5: round 1, and later rounds with the score so far.
      const scores = [
        [0, 0],
        [1, 0],
        [1, 1],
        [2, 1],
        [0, 2],
        [2, 2],
      ] as const;
      for (let n = 0; n < 10; n++) {
        for (const [wins, losses] of scores) {
          const left = 5 - wins - losses;
          if (left < 2) continue;
          const pool = [...roster];
          const own = take(pool, left);
          const opponent = take(pool, left);
          for (const format of ['reveal', 'showdown'] as const) {
            const roles: [BotRole, string | undefined][] = [
              ['show', undefined],
              ['answer', opponent[0]],
              ...(format === 'showdown' && left === 5
                ? ([['open', undefined]] as [BotRole, undefined][])
                : []),
            ];
            for (const [role, shown] of roles) {
              const view: BotView = {
                format,
                seed: n,
                round: wins + losses,
                role,
                own,
                opponent,
                wins,
                losses,
                bestOf: 5,
                ...(shown === undefined ? {} : { shown }),
              };
              const game = Object.fromEntries(hardBot.weights(view));
              const measured = hardWeightsN(view);
              expect(Object.keys(game).sort()).toStrictEqual(measured.map(([b]) => b).sort());
              for (const [ball, weight] of measured) expect(game[ball]).toBeCloseTo(weight, 9);
              expect(hardBot.choose(view)).toBe(hardBotN.choose(view));
            }
          }
        }
      }
    },
  );
});
