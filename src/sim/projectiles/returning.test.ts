// Returning projectiles (ADR 0043): out, turn, home on the owner, caught; one hit per ball each way.
import { describe, expect, it } from 'vitest';
import { DT } from '../constants.ts';
import type { MinionState } from '../minions/types.ts';
import { step } from '../step.ts';
import { blue, red, testLookup, withBalls } from '../test-support.ts';
import type { ProjectileState, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';

const still = { x: 0, y: 0 };

/** A returning projectile of ball-0 at (x, 500), heading +x at `perTick` units a tick. */
function boomerang(x: number, perTick: number, turnTick: number): ProjectileState {
  return {
    id: 'projectile-0',
    ownerId: 'ball-0',
    position: { x, y: 500 },
    velocity: { x: perTick / DT, y: 0 },
    radius: 12,
    damage: 5,
    ticksLeft: 200,
    returning: { turnTick, back: false, hitIds: [] },
  };
}

/** Red (the thrower) parked at (150, 500); a blue parked at `blueX` on the same line. */
function scene(blueX: number, projectile: ProjectileState, minions: MinionState[] = []) {
  const world = withBalls(createWorld(1, [red, blue]), [
    { position: { x: 150, y: 500 }, velocity: still },
    { position: { x: blueX, y: 500 }, velocity: still },
  ]);
  return { ...world, projectiles: [projectile], nextProjectileId: 1, minions };
}

function play(world: WorldState, ticks: number) {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, testLookup);
    current = result.world;
    events.push(...result.events);
  }
  return { world: current, events };
}

const ofType = <T extends SimEvent['type']>(events: readonly SimEvent[], type: T) =>
  events.filter((event): event is Extract<SimEvent, { type: T }> => event.type === type);

describe('returning projectiles', () => {
  it('fly out, turn on their turn tick and come back to be caught', () => {
    // Nothing in the way: blue is far off the line's end. Out 10 ticks at 20 a tick, then home.
    const { world, events } = play(scene(900, boomerang(220, 20, 10)), 40);
    expect(ofType(events, 'projectileHit')).toStrictEqual([]);
    expect(ofType(events, 'projectileExpired')).toStrictEqual([
      expect.objectContaining({ projectileId: 'projectile-0', reason: 'caught' }),
    ]);
    expect(world.projectiles).toStrictEqual([]);
  });

  it('hit the same ball once going out and once coming back', () => {
    // Blue sits in the path: hit on the way out, flown through, hit again on the way back.
    const { world, events } = play(scene(450, boomerang(220, 20, 20)), 60);
    const hits = ofType(events, 'projectileHit');
    expect(hits.map((hit) => hit.targetId)).toStrictEqual(['ball-1', 'ball-1']);
    expect(world.balls[1]?.health).toBe(blue.maxHealth - 10);
    expect(ofType(events, 'projectileExpired')[0]?.reason).toBe('caught');
  });

  it('turn back at a wall on the way out', () => {
    // A turn tick far away: the wall at x = 1000 turns it, and it comes home.
    const { events } = play(scene(150, boomerang(700, 30, 1000)), 80);
    const expired = ofType(events, 'projectileExpired');
    expect(expired).toStrictEqual([expect.objectContaining({ reason: 'caught' })]);
  });

  it('are stopped by an enemy minion, which they destroy', () => {
    const skull: MinionState = {
      id: 'minion-0',
      ownerId: 'ball-1',
      position: { x: 400, y: 500 },
      velocity: still,
      radius: 20,
      damage: 5,
      ticksLeft: 100,
    };
    const { world, events } = play(scene(900, boomerang(220, 20, 30), [skull]), 30);
    expect(ofType(events, 'minionDestroyed')).toStrictEqual([
      expect.objectContaining({ minionId: 'minion-0', reason: 'projectile' }),
    ]);
    expect(ofType(events, 'projectileExpired')[0]?.reason).toBe('minion');
    expect(world.projectiles).toStrictEqual([]);
  });

  it('drop out of the air when their owner is knocked out before the catch', () => {
    const owner0 = scene(900, boomerang(220, 20, 1));
    const downed = withBalls(owner0, [{ health: 0 }]);
    const { events } = play({ ...downed, projectiles: owner0.projectiles }, 5);
    expect(ofType(events, 'projectileExpired')[0]?.reason).toBe('lifetime');
  });
});
