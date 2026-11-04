import { describe, expect, it } from 'vitest';
import { red, withBalls } from '../sim/test-support.ts';
import type { DamageEvent, SimEvent } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { feelOf, impactsOf, impactStrength, shakeOf, wallBounces } from './impact.ts';
import { theme } from './theme.ts';

const damage = (targetId: string, amount: number, cause: 'contact' | 'ability'): DamageEvent => ({
  type: 'damage',
  tick: 40,
  targetId,
  sourceId: targetId === 'ball-0' ? 'ball-1' : 'ball-0',
  cause,
  amount,
  healthAfter: 30,
  multiplier: 1,
  survivedLethal: false,
});

const collision: SimEvent = {
  type: 'collision',
  tick: 40,
  ballIds: ['ball-0', 'ball-1'],
  point: { x: 500, y: 400 },
  normal: { x: 1, y: 0 },
  impulse: 900,
};

const defeated: SimEvent = {
  type: 'ballDefeated',
  tick: 40,
  ballId: 'ball-1',
  defeatedById: 'ball-0',
};
const knockedOut: SimEvent = {
  type: 'matchEnded',
  tick: 40,
  result: { kind: 'win', winnerId: 'ball-0' },
  reason: 'knockout',
};

describe('impactsOf', () => {
  it('sums one tick of damage per ball, with the contact point and push direction', () => {
    const impacts = impactsOf([
      collision,
      damage('ball-1', 14, 'contact'),
      damage('ball-0', 6, 'contact'),
      damage('ball-1', 10, 'ability'),
    ]);
    expect(impacts).toStrictEqual([
      { targetId: 'ball-1', damage: 24, point: { x: 500, y: 400 }, normal: { x: 1, y: 0 } },
      { targetId: 'ball-0', damage: 6, point: { x: 500, y: 400 }, normal: { x: -1, y: 0 } },
    ]);
  });

  it('has no point or normal for a zone hit, and ignores zero damage', () => {
    expect(
      impactsOf([damage('ball-0', 28, 'ability'), damage('ball-1', 0, 'contact')]),
    ).toStrictEqual([{ targetId: 'ball-0', damage: 28, point: undefined, normal: undefined }]);
  });

  it('scales strength up to the full-impact damage', () => {
    expect(impactStrength(0)).toBe(0);
    expect(impactStrength(theme.fullImpactDamage / 2)).toBeCloseTo(0.5, 9);
    expect(impactStrength(theme.fullImpactDamage * 3)).toBe(1);
  });
});

describe('feelOf', () => {
  it('does nothing for an ordinary hit', () => {
    expect(feelOf([damage('ball-1', theme.heavyHitDamage - 1, 'contact')], false)).toStrictEqual({
      hitStopMs: 0,
    });
  });

  it('holds longer for a harder heavy hit, within the theme range', () => {
    const heavy = feelOf([damage('ball-1', theme.heavyHitDamage, 'contact')], false).hitStopMs;
    const full = feelOf([damage('ball-1', theme.fullImpactDamage + 5, 'contact')], false).hitStopMs;
    expect(heavy).toBe(theme.hitStopMinMs);
    expect(full).toBe(theme.hitStopMaxMs);
  });

  it('holds on a knockout and slows down when the match ends by knockout', () => {
    expect(feelOf([damage('ball-1', 5, 'contact'), defeated, knockedOut], false)).toStrictEqual({
      hitStopMs: theme.knockoutHitStopMs,
      slowMo: { ms: theme.knockoutSlowMoRealMs, scale: theme.knockoutSlowMoScale },
    });
  });

  it('drops the slow-mo, but keeps the hit-stop, with reduced motion', () => {
    expect(feelOf([defeated, knockedOut], true)).toStrictEqual({
      hitStopMs: theme.knockoutHitStopMs,
    });
  });
});

describe('shakeOf', () => {
  it('shakes only for knockouts, however big the hit', () => {
    expect(shakeOf([damage('ball-1', theme.fullImpactDamage * 2, 'ability')])).toBe(0);
    expect(shakeOf([defeated])).toBe(theme.shakeKnockoutOffset);
  });
});

describe('wallBounces', () => {
  const world = createWorld(1, [red, red]);

  it('finds a ball that turned around at a wall', () => {
    const before = withBalls(world, [
      { position: { x: 1000 - 52, y: 500 }, velocity: { x: 800, y: 100 } },
      { position: { x: 300, y: 300 }, velocity: { x: 800, y: 0 } },
    ]);
    const after = withBalls(world, [
      { position: { x: 1000 - 62, y: 502 }, velocity: { x: -800, y: 100 } },
      { position: { x: 313, y: 300 }, velocity: { x: 800, y: 0 } },
    ]);
    expect(wallBounces(before, after)).toStrictEqual([
      { ballId: 'ball-0', normal: { x: -1, y: 0 } },
    ]);
  });

  it('ignores a turn far from any wall (a ball collision) and defeated balls', () => {
    const before = withBalls(world, [
      { position: { x: 400, y: 500 }, velocity: { x: 800, y: 0 } },
      { position: { x: 51, y: 500 }, velocity: { x: -800, y: 0 }, health: 0 },
    ]);
    const after = withBalls(world, [
      { position: { x: 390, y: 500 }, velocity: { x: -800, y: 0 } },
      { position: { x: 51, y: 500 }, velocity: { x: 800, y: 0 }, health: 0 },
    ]);
    expect(wallBounces(before, after)).toStrictEqual([]);
  });

  it('reports both walls in a corner', () => {
    const before = withBalls(world, [
      { position: { x: 52, y: 52 }, velocity: { x: -600, y: -600 } },
    ]);
    const after = withBalls(world, [{ position: { x: 60, y: 60 }, velocity: { x: 600, y: 600 } }]);
    expect(wallBounces(before, after).map((bounce) => bounce.normal)).toStrictEqual([
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]);
  });
});
