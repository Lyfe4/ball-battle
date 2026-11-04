import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { SimEvent, Vec2, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import {
  CHARGE_TICKS,
  chargeOf,
  COOLDOWN_TICKS,
  FIRST_CHARGE_TICK,
  SHOT_DAMAGE,
  SHOT_SPEED,
  sniper,
} from './sniper.ts';

const lookup = indexDefinitions([sniper, blue]);
const parked: Vec2 = { x: 0, y: 0 };
const fleeing: Vec2 = { x: 0, y: 400 };

/** A parked Sniper and a very healthy blue to its right, parked or moving straight down. */
function duel(blueVelocity: Vec2): WorldState {
  return withBalls(createWorld(1, [sniper, blue]), [
    { position: { x: 200, y: 500 }, velocity: { x: 0, y: 0 } },
    { position: { x: 800, y: 500 }, velocity: blueVelocity, health: 1_000_000 },
  ]);
}

function play(world: WorldState, ticks: number, onTick?: (world: WorldState) => void) {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
    onTick?.(current);
  }
  return { world: current, events };
}

describe('Sniper', () => {
  it('locks its aim on where the enemy is when the charge starts, with no leading', () => {
    // Blue is moving, so a leading aim would point ahead of it.
    const before = play(duel(fleeing), FIRST_CHARGE_TICK - 1).world;
    const [self, target] = play(before, 1).world.balls;
    const [from, to] = before.balls;
    if (self === undefined || target === undefined || from === undefined || to === undefined) {
      throw new Error('expected two balls');
    }
    const dx = to.position.x - from.position.x;
    const dy = to.position.y - from.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    expect(chargeOf(self)).toStrictEqual({
      fireTick: FIRST_CHARGE_TICK + CHARGE_TICKS,
      aim: { x: dx / distance, y: dy / distance },
    });
  });

  it('fires one shot down the locked line when the charge ends, even if the target moved', () => {
    // Locked on a parked blue, which then starts moving away from the line.
    const locked = play(duel(parked), FIRST_CHARGE_TICK).world;
    const moved = withBalls(locked, [{}, { velocity: fleeing }]);
    const { events } = play(moved, CHARGE_TICKS);
    const fired = events.filter((event) => event.type === 'projectileFired');
    expect(fired).toHaveLength(1);
    expect(fired[0]).toMatchObject({
      tick: FIRST_CHARGE_TICK + CHARGE_TICKS,
      velocity: { x: SHOT_SPEED, y: 0 },
    });
  });

  it('hits a target that stays on the line for SHOT_DAMAGE, and misses one that left it', () => {
    const ticks = FIRST_CHARGE_TICK + CHARGE_TICKS + 30;
    const hits = (world: WorldState) =>
      play(world, ticks).events.filter((event) => event.type === 'projectileHit');
    expect(hits(duel(parked))).toMatchObject([{ targetId: 'ball-1', amount: SHOT_DAMAGE }]);
    expect(hits(duel(fleeing))).toStrictEqual([]);
  });

  it('starts the next charge COOLDOWN_TICKS after a shot', () => {
    const shot = FIRST_CHARGE_TICK + CHARGE_TICKS;
    const charging: number[] = [];
    play(duel(parked), shot + COOLDOWN_TICKS + 2, (world) => {
      const [self] = world.balls;
      if (self !== undefined && chargeOf(self) !== undefined) charging.push(world.tick);
    });
    expect(charging[0]).toBe(FIRST_CHARGE_TICK);
    expect(charging).not.toContain(shot);
    expect(charging).not.toContain(shot + COOLDOWN_TICKS - 1);
    expect(charging).toContain(shot + COOLDOWN_TICKS);
  });
});
