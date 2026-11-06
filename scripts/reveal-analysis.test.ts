import { describe, expect, it } from 'vitest';
import { BALLS } from '../src/sim/balls/index.ts';
import { randomBot } from '../src/sim/bot.ts';
import {
  answers,
  coinToss,
  lineupsOf,
  mapOdds,
  playerFirst,
  seriesWin,
  simultaneous,
  takeTurns,
} from './reveal-analysis.ts';

const roster = BALLS.map((ball) => ball.id);
// A spread of lineups, small enough for a unit test: every 37th pair of the 27,225.
const lineups = lineupsOf(roster);
const sample = lineups.flatMap((you, i) =>
  lineups.filter((_, j) => (i * lineups.length + j) % 37 === 0).map((bot) => [you, bot] as const),
);

describe('reveal analysis', () => {
  it('scores a best-of-3 as first to two', () => {
    expect(seriesWin(1, 1, 0)).toBe(1);
    expect(seriesWin(0, 0, 1)).toBe(0);
    expect(seriesWin(0.5, 0.5, 0.5)).toBeCloseTo(0.5, 12);
  });

  it('gives the player’s order no value when both orders are secret (before ADR 0021)', () => {
    for (const [you, bot] of sample) {
      const { best, worst } = simultaneous(you, bot, mapOdds);
      expect(best - worst).toBeLessThan(1e-12);
    }
  });

  it('makes the player’s choices change their odds when the sides take turns', () => {
    let moved = 0;
    for (const [you, bot] of sample) {
      const { best, worst } = takeTurns(you, bot, mapOdds);
      expect(best).toBeGreaterThanOrEqual(worst);
      if (best - worst >= 0.03) moved++;
    }
    expect(moved / sample.length).toBeGreaterThan(0.8);
  });

  it('makes the player’s choices count whoever wins the toss, and averages the two', () => {
    let moved = 0;
    for (const [you, bot] of sample) {
      const first = playerFirst(you, bot, mapOdds);
      expect(first.best).toBeGreaterThanOrEqual(first.worst);
      if (first.best - first.worst >= 0.03) moved++;
      const toss = coinToss(you, bot, mapOdds);
      const second = takeTurns(you, bot, mapOdds);
      expect(toss.best).toBeCloseTo((first.best + second.best) / 2, 12);
      expect(toss.worst).toBeCloseTo((first.worst + second.worst) / 2, 12);
    }
    expect(moved / sample.length).toBeGreaterThan(0.8);
  });

  it('gives a player who shows first and plays perfectly against even odds exactly half', () => {
    const even = () => 0.5;
    const [you, bot] = sample[0] ?? [[], []];
    expect(playerFirst(you, bot, even)).toStrictEqual({ best: 0.5, worst: 0.5 });
  });

  it('models the bot’s round-2 answer the way the bot makes it', () => {
    for (const shown of roster) {
      for (const x of roster) {
        for (const y of roster) {
          if (x === y || x === shown || y === shown) continue;
          const possible = answers([x, y], shown).map(([id]) => id);
          for (let seed = 0; seed < 4; seed++) {
            expect(possible).toContain(randomBot.answer(seed, 1, [x, y], shown));
            // Round 1, when the player won the toss and showed first, answers the same way.
            expect(possible).toContain(randomBot.answer(seed, 0, [x, y], shown));
          }
        }
      }
    }
  });
});
