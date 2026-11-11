import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { SimEvent, WorldState, ZoneSpawnedEvent } from '../types.ts';
import { createWorld } from '../world.ts';
import { COOLDOWN_TICKS, quake, WARNING_TICKS, ZONE_DAMAGE, ZONE_RADIUS } from './quake.ts';

const lookup = indexDefinitions([quake, blue]);

/** The Quake heading into the left wall, with a parked, very healthy blue near where it hits. */
function intoWall(): WorldState {
  return withBalls(createWorld(1, [quake, blue]), [
    { position: { x: 80, y: 500 }, velocity: { x: -quake.speed, y: 0 } },
    { position: { x: 250, y: 620 }, velocity: { x: 0, y: 0 }, health: 1_000_000 },
  ]);
}

function play(world: WorldState, ticks: number) {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return events;
}

const spawnedIn = (events: readonly SimEvent[]): ZoneSpawnedEvent[] =>
  events.filter((event): event is ZoneSpawnedEvent => event.type === 'zoneSpawned');

describe('Quake', () => {
  it('sets off a shockwave where it hits a wall, which strikes WARNING_TICKS later', () => {
    const spawned = spawnedIn(play(intoWall(), 5 + WARNING_TICKS));
    expect(spawned).toHaveLength(1);
    // Clamped so the whole circle fits: its centre sits a radius in from the wall it hit.
    expect(spawned[0]).toMatchObject({
      ownerId: 'ball-0',
      radius: ZONE_RADIUS,
      position: { x: ZONE_RADIUS },
    });
    expect(spawned[0]?.strikeTick).toBe((spawned[0]?.tick ?? 0) + WARNING_TICKS);
  });

  it('damages an enemy inside it, never the Quake itself', () => {
    const damage = play(intoWall(), 5 + WARNING_TICKS).filter(
      (event) => event.type === 'damage' && event.cause === 'ability',
    );
    expect(damage).toMatchObject([
      { targetId: 'ball-1', sourceId: 'ball-0', cause: 'ability', amount: ZONE_DAMAGE },
    ]);
  });

  it('waits COOLDOWN_TICKS before a wall bounce can set off the next one', () => {
    // A corner hits two walls at once, then the Quake keeps bouncing around the arena.
    const corner = withBalls(createWorld(1, [quake, blue]), [
      { position: { x: 70, y: 70 }, velocity: { x: -500, y: -560 } },
      { position: { x: 800, y: 800 }, velocity: { x: 0, y: 0 } },
    ]);
    const ticks = spawnedIn(play(corner, 300)).map((event) => event.tick);
    expect(ticks.length).toBeGreaterThan(1);
    for (let index = 1; index < ticks.length; index++) {
      expect((ticks[index] ?? 0) - (ticks[index - 1] ?? 0)).toBeGreaterThanOrEqual(COOLDOWN_TICKS);
    }
  });
});
