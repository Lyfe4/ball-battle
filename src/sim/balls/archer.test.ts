import { describe, expect, it } from 'vitest';
import { MATCH_TIME_LIMIT_TICKS } from '../constants.ts';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { ProjectileFiredEvent, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import {
  archer,
  ARROW_LIFETIME_TICKS,
  ARROW_SPEED,
  COOLDOWN_TICKS,
  FIRST_SHOT_DELAY_TICKS,
  nextShotTickOf,
} from './archer.ts';

/** cos(4°), precomputed: the widest allowed angle between the aim and the arrow. */
const COS_MAX_SPREAD = 0.9975640502598242;

const lookup = indexDefinitions([archer, blue]);

function play(world: WorldState, ticks: number, onTick?: (world: WorldState) => void) {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks && current.match.status === 'running'; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
    onTick?.(current);
  }
  return { world: current, events };
}

const fired = (events: readonly SimEvent[]): ProjectileFiredEvent[] =>
  events.filter((event): event is ProjectileFiredEvent => event.type === 'projectileFired');

/** Archer and a target both parked, far apart, so only the arrows act. Blue is very healthy. */
function standoff(): WorldState {
  return withBalls(createWorld(1, [archer, blue]), [
    { position: { x: 150, y: 150 }, velocity: { x: 0, y: 0 } },
    { position: { x: 800, y: 800 }, velocity: { x: 0, y: 0 }, health: 1_000_000 },
  ]);
}

describe('Archer', () => {
  it('waits for the first-shot delay, then fires exactly on cooldown', () => {
    const { events } = play(standoff(), FIRST_SHOT_DELAY_TICKS + COOLDOWN_TICKS * 3);
    expect(fired(events).map((event) => event.tick)).toStrictEqual([
      FIRST_SHOT_DELAY_TICKS,
      FIRST_SHOT_DELAY_TICKS + COOLDOWN_TICKS,
      FIRST_SHOT_DELAY_TICKS + COOLDOWN_TICKS * 2,
      FIRST_SHOT_DELAY_TICKS + COOLDOWN_TICKS * 3,
    ]);
    // Nothing at all between shots: no per-tick ability events.
    expect(events.filter((event) => event.type === 'abilityTriggered')).toHaveLength(4);
  });

  it('aims at the enemy’s current position, within the spread', () => {
    const { events } = play(standoff(), FIRST_SHOT_DELAY_TICKS + COOLDOWN_TICKS * 20);
    const shots = fired(events);
    expect(shots).toHaveLength(21);
    for (const shot of shots) {
      const { x, y } = shot.velocity;
      const speed = Math.sqrt(x * x + y * y);
      expect(speed).toBeCloseTo(ARROW_SPEED, 9);
      // Target is down and to the right at 45°.
      const cos = (x + y) / (speed * Math.SQRT2);
      expect(cos).toBeGreaterThanOrEqual(COS_MAX_SPREAD - 1e-12);
    }
    // The spread is random per shot, not a fixed offset.
    expect(new Set(shots.map((shot) => shot.velocity.x)).size).toBeGreaterThan(15);
  });

  it('hits with arrows for ability damage', () => {
    // About 800 units to fly at 25 per tick.
    const { events } = play(standoff(), FIRST_SHOT_DELAY_TICKS + 60);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'damage',
        sourceId: 'ball-0',
        targetId: 'ball-1',
        cause: 'ability',
      }),
    );
  });

  it('resets its cooldown even when the shot goes straight into a wall', () => {
    // A test placement with the target beyond the right wall, so the spawn point is outside.
    const world = withBalls(createWorld(1, [archer, blue]), [
      { position: { x: 1000 - archer.radius, y: 500 }, velocity: { x: 0, y: 0 } },
      { position: { x: 1100, y: 500 }, velocity: { x: 0, y: 0 } },
    ]);
    const { world: after, events } = play({ ...world, tick: FIRST_SHOT_DELAY_TICKS - 1 }, 1);
    expect(events.map((event) => event.type)).toStrictEqual([
      'abilityTriggered',
      'projectileFired',
      'projectileExpired',
    ]);
    expect(after.projectiles).toStrictEqual([]);
    const [shooter] = after.balls;
    if (shooter === undefined) throw new Error('expected the Archer');
    expect(nextShotTickOf(shooter)).toBe(FIRST_SHOT_DELAY_TICKS + COOLDOWN_TICKS);
  });

  it('keeps the projectile count bounded over a whole match', () => {
    // Two near-invulnerable Archers run to the time limit; lifetime and walls keep arrows few.
    const mirrorLookup = indexDefinitions([archer]);
    let world = withBalls(createWorld(3, [archer, archer]), [
      { health: 1_000_000 },
      { health: 1_000_000 },
    ]);
    const bound = 2 * (Math.ceil(ARROW_LIFETIME_TICKS / COOLDOWN_TICKS) + 1);
    let most = 0;
    for (let i = 0; i < MATCH_TIME_LIMIT_TICKS && world.match.status === 'running'; i++) {
      world = step(world, mirrorLookup).world;
      most = Math.max(most, world.projectiles.length);
    }
    expect(world.tick).toBe(MATCH_TIME_LIMIT_TICKS);
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(bound);
  });
});
