import { describe, expect, it } from 'vitest';
import {
  bestColumn,
  bestRow,
  fold,
  mirrorIndex,
  solveZeroSum,
  summarise,
  type Tally,
} from './aim-analysis.ts';
import { aimPoint, angleOf, chosenAngle, foldedOf } from './aim-play.ts';

const t = (wins: number, games = 100, losses = games - wins): Tally => ({ wins, losses, games });

describe('aim geometry', () => {
  it('0° points each side straight at the other, mirrored', () => {
    expect(aimPoint({ x: 250, y: 500 }, 0, 0)).toStrictEqual({ x: 490, y: 500 });
    expect(aimPoint({ x: 750, y: 500 }, 0, 1)).toStrictEqual({ x: 510, y: 500 });
    expect(aimPoint({ x: 250, y: 500 }, 90, 0)).toStrictEqual({ x: 250, y: 740 });
    expect(aimPoint({ x: 750, y: 500 }, 90, 1)).toStrictEqual({ x: 750, y: 740 });
    expect(aimPoint({ x: 250, y: 500 }, 180, 0)).toStrictEqual({ x: 10, y: 500 });
  });

  it('folds ±θ together', () => {
    expect([1, 12, 13, 23].map(foldedOf)).toStrictEqual([15, 180, 165, 15]);
    expect(angleOf(6)).toBe(90);
    expect(mirrorIndex(0, 24)).toBe(0);
    expect(mirrorIndex(1, 24)).toBe(23);
    expect(mirrorIndex(12, 24)).toBe(12);
  });

  it('draws a mixed aim from its weights only', () => {
    const weights = new Array<number>(24).fill(0);
    weights[5] = 1;
    for (let seed = 0; seed < 20; seed++) {
      expect(chosenAngle({ kind: 'mixed', weights }, seed, 0)).toBe(75);
    }
  });
});

describe('fold', () => {
  it('adds each direction to its mirror image, once for 0° and 180°', () => {
    const per = Array.from({ length: 24 }, (_, k) => t(k, 10, 0));
    const folded = fold(per);
    expect(folded).toHaveLength(13);
    expect(folded[0]).toStrictEqual(t(0, 10, 0));
    expect(folded[1]).toStrictEqual(t(1 + 23, 20, 0));
    expect(folded[12]).toStrictEqual(t(12, 10, 0));
  });
});

describe('summarise', () => {
  it('reports a real best direction honestly', () => {
    const half = [t(50), t(70), t(40)];
    const summary = summarise([half, half], [t(50), t(50)]);
    expect(summary.best).toBe(1);
    expect(summary.worst).toBe(2);
    expect(summary.gain).toBeCloseTo(0.2, 12);
    expect(summary.spread).toBeCloseTo(0.3, 12);
    expect(summary.bestByHalf).toStrictEqual([1, 1]);
  });

  it('shows no gain when the best direction on one half was only noise', () => {
    // Each half's best is the other half's worst: picking on one and measuring on the other
    // exposes it, where the raw best-minus-random would claim +10.
    const summary = summarise(
      [
        [t(60), t(40)],
        [t(40), t(60)],
      ],
      [t(50), t(50)],
    );
    expect(summary.gain).toBeCloseTo(-0.1, 12);
    expect(summary.spread).toBeCloseTo(-0.2, 12);
    expect(summary.bestByHalf).toStrictEqual([0, 1]);
  });
});

describe('solveZeroSum', () => {
  it('plays rock-paper-scissors evenly, for a value of 0', () => {
    const rps = [
      [0, -1, 1],
      [1, 0, -1],
      [-1, 1, 0],
    ];
    const solution = solveZeroSum(rps);
    expect(solution.value).toBeCloseTo(0, 2);
    for (const share of [...solution.row, ...solution.column]) expect(share).toBeCloseTo(1 / 3, 1);
    expect(solution.upper - solution.lower).toBeLessThan(0.01);
  });

  it('finds a saddle point and never plays a dominated row', () => {
    const game = [
      [0.2, 0.3],
      [0.1, -0.5],
    ];
    const solution = solveZeroSum(game);
    expect(solution.value).toBeCloseTo(0.2, 3);
    expect(solution.row[0]).toBeCloseTo(1, 2);
    expect(solution.column[0]).toBeCloseTo(1, 2);
  });

  it('mixes when it must (matching pennies with a bias)', () => {
    // P mixes 0.4 / 0.6 to make Q indifferent: 1.2p - 0.2 = 0.6 - 0.8p, value 0.28.
    const game = [
      [1, -0.2],
      [-0.2, 0.6],
    ];
    const solution = solveZeroSum(game, 50_000);
    expect(solution.value).toBeCloseTo(0.28, 2);
    expect(solution.row[0]).toBeCloseTo(0.4, 1);
  });

  it('best-responds to a fixed mix', () => {
    const game = [
      [0.5, -0.5],
      [-0.1, 0.1],
    ];
    expect(bestRow(game, [1, 0])).toBe(0);
    expect(bestRow(game, [0, 1])).toBe(1);
    expect(bestColumn(game, [1, 0])).toBe(1);
  });
});
