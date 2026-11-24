import { describe, expect, it } from 'vitest';
import { afterInactivity, GLICKO, type Glicko, rate, skillOf } from './glicko2.ts';

const player = (rating: number, rd: number, volatility = 0.06): Glicko => ({
  rating,
  rd,
  volatility,
});

describe('Glicko-2', () => {
  it('gives Glickman’s worked example: 1500/200 against three opponents is 1464.06, RD 151.52', () => {
    // http://www.glicko.net/glicko/glicko2.pdf, the example at the end (τ = 0.5). The paper rounds
    // its intermediate values (μ' = −0.2069), so it prints 1464.06 where exact arithmetic gives
    // 1464.0507: within 0.05.
    const after = rate(player(1500, 200), [
      { opponent: player(1400, 30), score: 1 },
      { opponent: player(1550, 100), score: 0 },
      { opponent: player(1700, 300), score: 0 },
    ]);
    expect(Math.abs(after.rating - 1464.06)).toBeLessThan(0.05);
    expect(after.rd).toBeCloseTo(151.52, 2);
    expect(after.volatility).toBeCloseTo(0.06, 4);
    expect(after.volatility).toBeLessThan(0.06);
  });

  it('moves little for an expected result and a lot for an upset', () => {
    const strong = player(1800, 70);
    const weak = player(1200, 70);
    const expected = rate(strong, [{ opponent: weak, score: 1 }]);
    const upset = rate(weak, [{ opponent: strong, score: 1 }]);
    expect(expected.rating - strong.rating).toBeLessThan(5);
    expect(upset.rating - weak.rating).toBeGreaterThan(20);
  });

  it('moves a new player far more than a settled one, and grows less sure of neither', () => {
    const opponent = player(1500, 70);
    const fresh = rate(GLICKO.start, [{ opponent, score: 1 }]);
    const settled = rate(player(1500, 70), [{ opponent, score: 1 }]);
    expect(fresh.rating - 1500).toBeGreaterThan(5 * (settled.rating - 1500));
    expect(fresh.rd).toBeLessThan(GLICKO.start.rd);
  });

  it('only grows the RD over a period without a series, never past 350', () => {
    expect(rate(player(1600, 100), []).rating).toBe(1600);
    expect(rate(player(1600, 100), []).rd).toBeGreaterThan(100);
    expect(rate(player(1600, 349.99), []).rd).toBe(GLICKO.maxRd);
    expect(rate(player(1600, 350), []).rd).toBe(GLICKO.maxRd);
  });

  it('grows the RD by whole days without a ranked series, capped at 350', () => {
    const settled = player(1600, 60);
    expect(afterInactivity(settled, 0)).toBe(settled);
    expect(afterInactivity(settled, 0.9)).toBe(settled);
    const month = afterInactivity(settled, 30).rd;
    const quarter = afterInactivity(settled, 90).rd;
    expect(month).toBeGreaterThan(60);
    expect(quarter).toBeGreaterThan(month);
    // φ' = √(φ² + σ²·d): 60 and 0.06 for 30 days, on the 173.7178 scale.
    const phi = 60 / 173.7178;
    expect(month).toBeCloseTo(173.7178 * Math.sqrt(phi * phi + 0.06 * 0.06 * 30), 6);
    expect(afterInactivity(settled, 100_000).rd).toBe(GLICKO.maxRd);
    expect(afterInactivity(settled, 30).rating).toBe(1600);
  });

  it('keeps the conservative skill at rating − 2·RD', () => {
    expect(skillOf(GLICKO.start)).toBe(800);
    expect(skillOf(player(1700, 70))).toBe(1560);
  });
});
