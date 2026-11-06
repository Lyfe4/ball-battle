import { describe, expect, it } from 'vitest';
import { CONFETTI_PIECES, confettiPieces } from './confetti.ts';

describe('the Winner sticker confetti', () => {
  it('is capped, lands inside the arena and is the same every time', () => {
    const pieces = confettiPieces();
    expect(pieces).toHaveLength(CONFETTI_PIECES);
    expect(CONFETTI_PIECES).toBeLessThanOrEqual(12);
    for (const { x, y, turn } of pieces) {
      expect(x).toBeGreaterThan(5);
      expect(x).toBeLessThan(95);
      expect(y).toBeGreaterThan(5);
      expect(y).toBeLessThan(95);
      expect(turn).toBeGreaterThanOrEqual(0);
      expect(turn).toBeLessThan(360);
    }
    expect(confettiPieces()).toStrictEqual(pieces);
  });

  it('spreads all the way round the sticker', () => {
    const pieces = confettiPieces();
    expect(pieces.some(({ x }) => x < 30)).toBe(true);
    expect(pieces.some(({ x }) => x > 70)).toBe(true);
    expect(pieces.some(({ y }) => y < 30)).toBe(true);
    expect(pieces.some(({ y }) => y > 70)).toBe(true);
  });
});
