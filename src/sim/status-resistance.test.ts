import { describe, expect, it } from 'vitest';
import { applyActions } from './abilities/apply-actions.ts';
import { indexDefinitions } from './definitions.ts';
import { resistedDuration } from './status.ts';
import { blue, red } from './test-support.ts';
import { createWorld } from './world.ts';

describe('resistedDuration', () => {
  it('keeps the full duration without a resistance', () => {
    expect(resistedDuration(260, undefined)).toBe(260);
  });

  it('scales by the share kept, rounded, never below one tick', () => {
    expect(resistedDuration(260, 0.8)).toBe(208);
    expect(resistedDuration(3, 0.1)).toBe(1);
  });

  it('is 0 (immune) for a share of 0', () => {
    expect(resistedDuration(180, 0)).toBe(0);
  });

  it('throws for a share outside 0 to 1, which only a bug can produce', () => {
    expect(() => resistedDuration(10, -0.1)).toThrow();
    expect(() => resistedDuration(10, 1.5)).toThrow();
    expect(() => resistedDuration(10, Number.NaN)).toThrow();
  });
});

describe('applyStatus on a resisting ball', () => {
  const immuneBlue = { ...blue, statusResistance: { slowed: 0, poisoned: 0.5 } };
  const lookup = indexDefinitions([red, immuneBlue]);
  const world = createWorld(1, [red, immuneBlue]);
  const apply = (status: 'slowed' | 'poisoned', durationTicks: number) =>
    applyActions(
      world,
      'ball-0',
      [{ kind: 'applyStatus', targetId: 'ball-1', status, durationTicks }],
      lookup,
      10,
      world.arena.size,
    );

  it('lands nothing, not even an event, when immune', () => {
    const result = apply('slowed', 90);
    expect(result.events).toStrictEqual([]);
    expect(result.balls[1]?.statuses).toStrictEqual([]);
  });

  it('lands a shorter status when it resists part of it', () => {
    expect(apply('poisoned', 100).balls[1]?.statuses[0]?.expiresTick).toBe(10 + 50);
  });

  it('still rejects an invalid requested duration, immune or not', () => {
    expect(() => apply('slowed', 0)).toThrow();
    expect(() => apply('slowed', 2.5)).toThrow();
  });
});
