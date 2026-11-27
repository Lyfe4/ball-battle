import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { red, withBalls } from '../test-support.ts';
import type { SimEvent, Vec2, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { bearingOf, CANNONBALL_SPEED, pirate } from './pirate.ts';

const lookup = indexDefinitions([pirate, red]);

function play(world: WorldState, ticks: number): SimEvent[] {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return events;
}

/** Every cannonball the Pirate (sailing +x from the left) fires at red, set where it is given. */
function shotsAt(enemy: Readonly<{ position: Vec2; velocity: Vec2 }>, ticks = 30): Vec2[] {
  const world = withBalls(createWorld(1, [pirate, red]), [
    {
      position: { x: 150, y: 500 },
      velocity: { x: pirate.speed, y: 0 },
      abilityState: { nextShotTick: 0 },
    },
    enemy,
  ]);
  return play(world, ticks).flatMap((event) =>
    event.type === 'projectileFired' && event.ownerId === 'ball-0' ? [event.velocity] : [],
  );
}

describe('the Pirate (prototype)', () => {
  it('reads an enemy’s bearing off its heading: ahead, and to its right or left', () => {
    const east = { x: 1, y: 0 };
    expect(bearingOf({ x: 0, y: 0 }, east, { x: 100, y: 0 })).toStrictEqual({
      along: 100,
      across: 0,
    });
    expect(bearingOf({ x: 0, y: 0 }, east, { x: 0, y: 100 }).across).toBe(100);
    expect(bearingOf({ x: 0, y: 0 }, east, { x: 0, y: -100 }).across).toBe(-100);
  });

  it('fires straight out of its side at a ball it sails past', () => {
    // Red sails the other way on a parallel course below it: as they pass, the Pirate fires down.
    const shots = shotsAt({ position: { x: 800, y: 800 }, velocity: { x: -red.speed, y: 0 } }, 40);
    expect(shots.length).toBe(1);
    expect(shots[0]?.x).toBeCloseTo(0, 6);
    expect(shots[0]?.y).toBeCloseTo(CANNONBALL_SPEED, 6);
  });

  it('never fires at a ball meeting it head-on', () => {
    // Red comes straight down its course until they bump: always dead ahead, never abeam.
    const shots = shotsAt({ position: { x: 700, y: 500 }, velocity: { x: -red.speed, y: 0 } });
    expect(shots).toStrictEqual([]);
  });
});
