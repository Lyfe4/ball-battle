import { describe, expect, it } from 'vitest';
import { BALLS } from '../src/sim/balls/index.ts';
import { BOT_LEVELS, easyBot, hardBot } from '../src/sim/bot.ts';
import { lineupsOf, mapOdds } from './reveal-analysis.ts';
import { outlook, samplePairs, summariseLevel } from './series-analysis.ts';

const roster = BALLS.map((ball) => ball.id);
const pairs = samplePairs(lineupsOf(roster), 200);
const formats = ['reveal', 'showdown'] as const;

describe('the series analysis', () => {
  it('samples evenly spaced lineup pairs, about as many as asked', () => {
    expect(pairs.length).toBeGreaterThanOrEqual(200);
    expect(pairs.length).toBeLessThan(210);
  });

  it('gives exactly half, and round 1 deciding 75%, when every round is a coin flip', () => {
    const even = () => 0.5;
    for (const format of formats) {
      for (const bot of BOT_LEVELS) {
        const [you, theirs] = pairs[0] ?? [[], []];
        const o = outlook(format, you, theirs, bot, even, 'best');
        expect(o.win).toBeCloseTo(0.5, 12);
        expect(o.firstDecides).toBeCloseTo(0.75, 12);
      }
    }
  });

  it('orders best, random and worst play for every pair, format and level', () => {
    for (const format of formats) {
      for (const bot of BOT_LEVELS) {
        for (const [you, theirs] of pairs.slice(0, 40)) {
          const best = outlook(format, you, theirs, bot, mapOdds, 'best').win;
          const random = outlook(format, you, theirs, bot, mapOdds, 'random').win;
          const worst = outlook(format, you, theirs, bot, mapOdds, 'worst').win;
          expect(best).toBeGreaterThanOrEqual(random - 1e-12);
          expect(random).toBeGreaterThanOrEqual(worst - 1e-12);
        }
      }
    }
  });

  it('finds Hard harder than Easy, and Hard at best play the game’s fair value', () => {
    for (const format of formats) {
      const easy = summariseLevel(format, easyBot, pairs, mapOdds);
      const hard = summariseLevel(format, hardBot, pairs, mapOdds);
      expect(hard.random).toBeLessThan(easy.random);
      expect(hard.best).toBeLessThan(easy.best);
      // Both sides playing their best by the map's own odds: an even game, over many pairs.
      expect(hard.best).toBeCloseTo(0.5, 1);
    }
  });
});
