import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { blue, red, withBalls } from '../test-support.ts';
import { createWorld } from '../world.ts';
import { applyActions } from './apply-actions.ts';

const definitions = indexDefinitions([red, blue]);
const world = createWorld(1, [red, blue]);

describe('applyActions', () => {
  it('damages a target and reports ability damage', () => {
    const { balls, events } = applyActions(
      world.balls,
      'ball-0',
      [{ kind: 'damage', targetId: 'ball-1', amount: 10 }],
      definitions,
      5,
    );
    expect(balls[1]?.health).toBe(blue.maxHealth - 10);
    expect(events).toStrictEqual([
      {
        type: 'damage',
        tick: 5,
        targetId: 'ball-1',
        sourceId: 'ball-0',
        cause: 'ability',
        amount: 10,
        healthAfter: blue.maxHealth - 10,
        multiplier: 1,
        survivedLethal: false,
      },
    ]);
  });

  it('heals up to max health and reports only what was restored', () => {
    const hurt = withBalls(world, [{ health: red.maxHealth - 5 }]);
    const { balls, events } = applyActions(
      hurt.balls,
      'ball-1',
      [{ kind: 'heal', targetId: 'ball-0', amount: 50 }],
      definitions,
      1,
    );
    expect(balls[0]?.health).toBe(red.maxHealth);
    expect(events).toStrictEqual([
      {
        type: 'healed',
        tick: 1,
        ballId: 'ball-0',
        sourceId: 'ball-1',
        amount: 5,
        healthAfter: red.maxHealth,
      },
    ]);
    // Already full: nothing to report.
    expect(
      applyActions(
        world.balls,
        'ball-0',
        [{ kind: 'heal', targetId: 'ball-0', amount: 5 }],
        definitions,
        1,
      ).events,
    ).toStrictEqual([]);
  });

  it('never revives or damages a defeated ball', () => {
    const dead = withBalls(world, [{ health: 0 }]);
    const { balls, events } = applyActions(
      dead.balls,
      'ball-1',
      [
        { kind: 'heal', targetId: 'ball-0', amount: 50 },
        { kind: 'damage', targetId: 'ball-0', amount: 50 },
      ],
      definitions,
      1,
    );
    expect(balls[0]?.health).toBe(0);
    expect(events).toStrictEqual([]);
  });

  it('changes only the owner’s velocity and ability state', () => {
    const { balls } = applyActions(
      world.balls,
      'ball-1',
      [
        { kind: 'setVelocity', velocity: { x: 3, y: 4 } },
        { kind: 'scaleVelocity', factor: 2 },
        { kind: 'setAbilityState', state: { charged: true } },
      ],
      definitions,
      1,
    );
    expect(balls[0]).toBe(world.balls[0]);
    expect(balls[1]?.velocity).toStrictEqual({ x: 6, y: 8 });
    expect(balls[1]?.abilityState).toStrictEqual({ charged: true });
  });

  it('rejects unknown targets and non-finite velocities as bugs', () => {
    expect(() =>
      applyActions(
        world.balls,
        'ball-0',
        [{ kind: 'damage', targetId: 'nope', amount: 1 }],
        definitions,
        1,
      ),
    ).toThrow(/unknown ball/);
    expect(() =>
      applyActions(
        world.balls,
        'ball-0',
        [{ kind: 'scaleVelocity', factor: Infinity }],
        definitions,
        1,
      ),
    ).toThrow(/non-finite/);
  });

  it('does not mutate its input', () => {
    const before = structuredClone(world.balls);
    applyActions(
      world.balls,
      'ball-0',
      [{ kind: 'damage', targetId: 'ball-1', amount: 5 }],
      definitions,
      1,
    );
    expect(world.balls).toStrictEqual(before);
  });
});
