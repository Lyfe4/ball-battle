import { describe, expect, it } from 'vitest';
import { BALLS } from '../sim/balls/index.ts';
import { revealFirst } from '../sim/series-seeds.ts';
import {
  botShowsFirstSeed,
  FIRST_SERIES,
  SEED_STEPS,
  STARTER_TRIO,
  starterTrio,
} from './first-series-setup.ts';

describe('the first series’ seed (ADR 0090, D2)', () => {
  it('lets the bot show first in round 1, within SEED_STEPS of the seed it was given', () => {
    for (let seed = 0; seed <= 10_000; seed++) {
      const stepped = botShowsFirstSeed(seed);
      expect(revealFirst(stepped)).toBe('b');
      expect(stepped - seed).toBeGreaterThanOrEqual(0);
      expect(stepped - seed).toBeLessThanOrEqual(SEED_STEPS);
    }
  });

  it('keeps a seed whose toss already gives the bot, and is pure', () => {
    const seed = botShowsFirstSeed(12345);
    expect(botShowsFirstSeed(seed)).toBe(seed);
    expect(botShowsFirstSeed(12345)).toBe(seed);
  });

  it('wraps at 2^32 and stays a 32-bit unsigned seed', () => {
    for (const seed of [0xffffffff, 0xfffffff0, 0xffffffc0]) {
      const stepped = botShowsFirstSeed(seed);
      expect(stepped).toBeGreaterThanOrEqual(0);
      expect(stepped).toBeLessThanOrEqual(0xffffffff);
      expect(revealFirst(stepped)).toBe('b');
    }
  });

  it('plays Best of 3 · Reveal against the Easy bot', () => {
    expect(FIRST_SERIES).toStrictEqual({ format: 'reveal', bestOf: 3, level: 'easy' });
  });
});

describe('Pick for me (ADR 0090)', () => {
  it('names balls of this build, by id', () => {
    const ids = BALLS.map((ball) => ball.id);
    for (const id of STARTER_TRIO) expect(ids).toContain(id);
    expect(starterTrio(ids)).toStrictEqual(STARTER_TRIO);
  });

  it('fills from the roster when a starter is missing, whatever its order', () => {
    expect(starterTrio(['venom', 'titan', 'slime', 'archer'])).toStrictEqual([
      'archer',
      'venom',
      'titan',
    ]);
    expect(starterTrio(['slime', 'titan', 'sniper'])).toStrictEqual(['slime', 'titan', 'sniper']);
  });
});
