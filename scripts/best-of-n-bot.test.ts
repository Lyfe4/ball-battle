import { describe, expect, it } from 'vitest';
import { BALLS } from '../src/sim/balls/index.ts';
import { maximinMix } from '../src/sim/bot-model.ts';
import { hardBot, type BotRole, type BotView } from '../src/sim/bot.ts';
import { createStream } from '../src/sim/rng.ts';
import { hardWeightsN, maximinMixN } from './best-of-n-bot.ts';
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
});
