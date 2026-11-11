import { describe, expect, it } from 'vitest';
import { BALLS } from '../../sim/balls/index.ts';
import { red, withBalls } from '../../sim/test-support.ts';
import { createWorld } from '../../sim/world.ts';
import { theme } from '../theme.ts';
import { BALL_DESIGNS } from './index.ts';
import {
  aimHeading,
  chargeFraction,
  rageCrackCount,
  simpleStreakCount,
  stormFlicker,
  streakCount,
  useSimpleDesign,
  velocityHeading,
} from './state.ts';

describe('ball designs', () => {
  it('has a design and an accent for every ball in the roster', () => {
    for (const ball of BALLS) {
      expect(BALL_DESIGNS.has(ball.id)).toBe(true);
      expect(theme.ballAccents[ball.id]).toBeDefined();
    }
  });

  describe('chargeFraction', () => {
    it('rises from 0 just after a shot to 1 on the shot tick', () => {
      expect(chargeFraction(220, 100, 120)).toBe(0);
      expect(chargeFraction(220, 160, 120)).toBe(0.5);
      expect(chargeFraction(220, 220, 120)).toBe(1);
    });

    it('stays within 0 to 1, including the first-shot delay', () => {
      expect(chargeFraction(30, 0, 120)).toBe(0.75);
      expect(chargeFraction(500, 0, 120)).toBe(0);
      expect(chargeFraction(10, 50, 120)).toBe(1);
      expect(chargeFraction(10, 0, 0)).toBe(1);
    });
  });

  it('shows one Speedster streak per whole stack', () => {
    expect([0, 1, 2, 3, 4, 5].map(streakCount)).toStrictEqual([0, 1, 2, 3, 4, 5]);
    expect(streakCount(-1)).toBe(0);
    expect(streakCount(2.7)).toBe(2);
  });

  it('collapses Speedster streaks to at most two at small size', () => {
    expect([0, 1, 2, 3, 4, 5].map(simpleStreakCount)).toStrictEqual([0, 1, 1, 2, 2, 2]);
  });

  it('simplifies designs only below the on-screen size threshold', () => {
    expect(useSimpleDesign(theme.simpleDesignBelowPx - 0.5)).toBe(true);
    expect(useSimpleDesign(theme.simpleDesignBelowPx)).toBe(false);
    // A phone arena (about 340 CSS px) shows a 50-unit ball at about 17 px: simplified.
    expect(useSimpleDesign(50 * (340 / 1016))).toBe(true);
    // A desktop arena (about 720 CSS px) shows even the smallest ball (38 units) in full.
    expect(useSimpleDesign(38 * (720 / 1016))).toBe(false);
  });

  describe('stormFlicker', () => {
    it('brightens steadily with the charge before the flicker window', () => {
      expect(stormFlicker(0, 0)).toBe(theme.stormBoltMinAlpha);
      expect(stormFlicker(0.5, 7)).toBeGreaterThan(stormFlicker(0.2, 7));
      expect(stormFlicker(1, 7)).toBe(1);
    });

    it('flickers by tick in the last stretch, the same way every time', () => {
      const fraction = (1 + theme.stormFlickerFrom) / 2;
      const levels = Array.from({ length: 12 }, (_, tick) => stormFlicker(fraction, tick));
      expect(new Set(levels).size).toBe(2);
      expect(levels).toStrictEqual(
        Array.from({ length: 12 }, (_, tick) => stormFlicker(fraction, tick)),
      );
    });
  });

  describe('headings', () => {
    it('points along the velocity, and has none when still', () => {
      expect(velocityHeading({ x: 3, y: -4 })).toStrictEqual({ x: 0.6, y: -0.8 });
      expect(velocityHeading({ x: 0, y: 0 })).toBeUndefined();
    });

    it('aims at the nearest live enemy, and has none when nobody is left', () => {
      const world = withBalls(createWorld(1, [red, red]), [
        { position: { x: 100, y: 100 } },
        { position: { x: 100, y: 500 } },
      ]);
      const [self, enemy] = world.balls;
      if (self === undefined || enemy === undefined) throw new Error('expected two balls');
      expect(aimHeading(self, world.balls)).toStrictEqual({ x: 0, y: 1 });
      expect(aimHeading(self, [self, { ...enemy, health: 0 }])).toBeUndefined();
    });
  });

  describe('rageCrackCount', () => {
    it('shows one crack when calm and every crack at full rage, evenly between', () => {
      expect([0, 1, 2, 3].map((rage) => rageCrackCount(rage, 3, 6))).toStrictEqual([1, 3, 4, 6]);
      expect([0, 1, 2, 3].map((rage) => rageCrackCount(rage, 3, 4))).toStrictEqual([1, 2, 3, 4]);
    });

    it('clamps rage outside 0 to its most', () => {
      expect(rageCrackCount(-1, 3, 6)).toBe(1);
      expect(rageCrackCount(9, 3, 6)).toBe(6);
    });
  });
});
