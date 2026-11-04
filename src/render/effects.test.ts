import { describe, expect, it } from 'vitest';
import type { DamageEvent } from '../sim/types.ts';
import { createEffects, FLASH_MS, HEAL_MS, SPARK_MS } from './effects.ts';

const hit: DamageEvent = {
  type: 'damage',
  tick: 10,
  targetId: 'ball-1',
  sourceId: 'ball-0',
  cause: 'contact',
  amount: 15,
  healthAfter: 70,
  multiplier: 1,
  survivedLethal: false,
};

describe('effects', () => {
  it('flashes a damaged ball at full strength, then fades to nothing', () => {
    const effects = createEffects();
    effects.apply([hit], 1000);
    expect(effects.flash('ball-1', 1000)).toBe(1);
    expect(effects.flash('ball-1', 1000 + FLASH_MS / 2)).toBeCloseTo(0.5, 9);
    expect(effects.flash('ball-1', 1000 + FLASH_MS)).toBe(0);
    expect(effects.flash('ball-0', 1000)).toBe(0);
  });

  it('reports whether anything is still animating', () => {
    const effects = createEffects();
    expect(effects.isActive(0)).toBe(false);
    effects.apply([hit], 0);
    expect(effects.isActive(FLASH_MS - 1)).toBe(true);
    expect(effects.isActive(FLASH_MS)).toBe(false);
  });

  it('restarts the flash on a new hit and ignores other events', () => {
    const effects = createEffects();
    effects.apply([hit], 0);
    effects.apply(
      [{ type: 'matchEnded', tick: 11, result: { kind: 'draw' }, reason: 'knockout' }, hit],
      FLASH_MS,
    );
    expect(effects.flash('ball-1', FLASH_MS)).toBe(1);
  });

  it('clears everything on reset', () => {
    const effects = createEffects();
    effects.apply([hit], 0);
    effects.reset();
    expect(effects.flash('ball-1', 0)).toBe(0);
  });

  it('pulses a healed ball and fades it out', () => {
    const effects = createEffects();
    effects.apply(
      [
        {
          type: 'healed',
          tick: 3,
          ballId: 'ball-0',
          sourceId: 'ball-0',
          amount: 7,
          healthAfter: 50,
        },
      ],
      0,
    );
    expect(effects.heal('ball-0', 0)).toBe(1);
    expect(effects.flash('ball-0', 0)).toBe(0);
    expect(effects.isActive(HEAL_MS - 1)).toBe(true);
    expect(effects.heal('ball-0', HEAL_MS)).toBe(0);
    expect(effects.isActive(HEAL_MS)).toBe(false);
  });

  it('shows a spark where a projectile hit, then drops it', () => {
    const effects = createEffects();
    effects.apply(
      [
        {
          type: 'projectileHit',
          tick: 5,
          projectileId: 'projectile-0',
          ownerId: 'ball-0',
          targetId: 'ball-1',
          point: { x: 300, y: 400 },
          amount: 10,
        },
      ],
      0,
    );
    expect(effects.sparks(0)).toStrictEqual([{ point: { x: 300, y: 400 }, strength: 1 }]);
    expect(effects.sparks(SPARK_MS / 2)[0]?.strength).toBeCloseTo(0.5, 9);
    expect(effects.isActive(SPARK_MS - 1)).toBe(true);
    expect(effects.sparks(SPARK_MS)).toStrictEqual([]);
    expect(effects.isActive(SPARK_MS)).toBe(false);
  });
});
