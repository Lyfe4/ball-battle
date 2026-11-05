import { describe, expect, it } from 'vitest';
import { BALLS } from '../../sim/balls/index.ts';
import { favouredOf, leanOf, matchupsOf, speedTrait, statShares } from './matchups.ts';

const ids = BALLS.map((ball) => ball.id);

describe('matchups', () => {
  it('sorts every other ball into exactly one list, for every ball', () => {
    for (const id of ids) {
      const { beats, losesTo, even } = matchupsOf(id, ids);
      const all = [...beats, ...losesTo, ...even].map((line) => line.opponent);
      expect([...all].sort()).toStrictEqual(ids.filter((other) => other !== id).sort());
    }
  });

  it('reads each pair the same way from both sides', () => {
    for (const a of ids) {
      for (const b of ids) {
        if (a === b) continue;
        const flipped = { favoured: 'unfavoured', unfavoured: 'favoured', even: 'even' } as const;
        expect(leanOf(b, a)).toBe(flipped[leanOf(a, b)]);
      }
    }
  });

  it('gives a reason for every pair, so no matchup is shown unexplained', () => {
    for (const id of ids) {
      const { beats, losesTo, even } = matchupsOf(id, ids);
      for (const line of [...beats, ...losesTo, ...even]) expect(line.reason).not.toBe('');
    }
  });

  it('words every reason for players: no decision-record or file references', () => {
    for (const id of ids) {
      const { beats, losesTo, even } = matchupsOf(id, ids);
      for (const line of [...beats, ...losesTo, ...even]) {
        expect(line.reason).not.toMatch(/ADR|\.ts\b|scripts\//);
      }
    }
  });

  it('follows the map: the Brawler is even with everyone but Thorns, which beats it', () => {
    const brawler = matchupsOf('brawler', ids);
    expect(brawler.beats).toStrictEqual([]);
    expect(brawler.losesTo.map((line) => line.opponent)).toStrictEqual(['thorns']);
    expect(favouredOf('storm', 'vampire')).toBe('storm');
    expect(favouredOf('vampire', 'storm')).toBe('storm');
    expect(favouredOf('archer', 'storm')).toBeUndefined();
    expect(favouredOf('storm', 'storm')).toBeUndefined();
  });

  it('scales stats against the roster’s best, so the best has a full bar', () => {
    for (const key of ['health', 'hit'] as const) {
      const shares = BALLS.map((ball) => statShares(ball, BALLS)[key]);
      expect(Math.max(...shares)).toBe(1);
      expect(Math.min(...shares)).toBeGreaterThan(0);
    }
  });

  it('names speed only for the fastest and the slowest ball', () => {
    const traits = new Map(BALLS.map((ball) => [ball.id, speedTrait(ball, BALLS)]));
    expect(traits.get('speedster')).toBe('Fastest ball');
    expect(traits.get('frost')).toBe('Slowest ball');
    expect([...traits.values()].filter((trait) => trait !== undefined)).toHaveLength(2);
  });
});
