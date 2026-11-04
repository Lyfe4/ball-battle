import { describe, expect, it } from 'vitest';
import { MATCH_TIME_LIMIT_TICKS } from '../constants.ts';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { SimEvent, WorldState, ZoneSpawnedEvent } from '../types.ts';
import { createWorld } from '../world.ts';
import {
  COOLDOWN_TICKS,
  FIRST_STRIKE_DELAY_TICKS,
  MAX_OFFSET,
  nextStrikeTickOf,
  randomOffset,
  SHOCK_TICKS,
  storm,
  WARNING_TICKS,
  ZONE_DAMAGE,
  ZONE_RADIUS,
} from './storm.ts';

const lookup = indexDefinitions([storm, blue]);

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

const spawned = (events: readonly SimEvent[]): ZoneSpawnedEvent[] =>
  events.filter((event): event is ZoneSpawnedEvent => event.type === 'zoneSpawned');

/** The Storm parked in a corner and a very healthy target parked mid-arena, so nothing clamps. */
function standoff(): WorldState {
  return withBalls(createWorld(1, [storm, blue]), [
    { position: { x: 120, y: 120 }, velocity: { x: 0, y: 0 } },
    { position: { x: 600, y: 600 }, velocity: { x: 0, y: 0 }, health: 1_000_000 },
  ]);
}

describe('Storm', () => {
  it('waits for the first-strike delay, then calls a strike exactly on cooldown', () => {
    const { events } = play(standoff(), FIRST_STRIKE_DELAY_TICKS + COOLDOWN_TICKS * 3);
    expect(spawned(events).map((event) => event.tick)).toStrictEqual([
      FIRST_STRIKE_DELAY_TICKS,
      FIRST_STRIKE_DELAY_TICKS + COOLDOWN_TICKS,
      FIRST_STRIKE_DELAY_TICKS + COOLDOWN_TICKS * 2,
      FIRST_STRIKE_DELAY_TICKS + COOLDOWN_TICKS * 3,
    ]);
    // Nothing between strikes being called: one ability event per call.
    expect(events.filter((event) => event.type === 'abilityTriggered')).toHaveLength(4);
  });

  it('shocks every ball its strike hits for SHOCK_TICKS, never itself', () => {
    const strikeTick = FIRST_STRIKE_DELAY_TICKS + WARNING_TICKS;
    const shockedOn: number[] = [];
    play(standoff(), strikeTick + SHOCK_TICKS + 5, (world) => {
      expect(world.balls[0]?.statuses).toStrictEqual([]);
      const [status] = world.balls[1]?.statuses ?? [];
      if (status === undefined) return;
      expect(status).toStrictEqual({
        kind: 'shocked',
        sourceId: 'ball-0',
        expiresTick: strikeTick + SHOCK_TICKS,
      });
      shockedOn.push(world.tick);
    });
    expect(shockedOn[0]).toBe(strikeTick);
    expect(shockedOn).toHaveLength(SHOCK_TICKS);
  });

  it('shocks a ball that touches it, from the contact tick, for SHOCK_TICKS', () => {
    // Head-on, well before the first strike is even called.
    const charge = withBalls(createWorld(1, [storm, blue]), [
      { position: { x: 380, y: 500 }, velocity: { x: storm.speed, y: 0 } },
      { position: { x: 640, y: 500 }, velocity: { x: 0, y: 0 } },
    ]);
    let contactTick: number | undefined;
    const { world } = play(charge, 40, (after) => {
      contactTick ??= after.balls[1]?.statuses.length === 1 ? after.tick : undefined;
    });
    const hit = play(charge, 40).events.find((event) => event.type === 'collision');
    expect(hit?.tick).toBeLessThan(FIRST_STRIKE_DELAY_TICKS);
    expect(contactTick).toBe(hit?.tick);
    expect(world.balls[1]?.statuses).toStrictEqual([
      { kind: 'shocked', sourceId: 'ball-0', expiresTick: (hit?.tick ?? 0) + SHOCK_TICKS },
    ]);
    expect(world.balls[0]?.statuses).toStrictEqual([]);
  });

  it('marks a zone near the target that strikes after the warning', () => {
    const { events } = play(standoff(), FIRST_STRIKE_DELAY_TICKS + COOLDOWN_TICKS * 20);
    const zones = spawned(events);
    expect(zones).toHaveLength(21);
    for (const zone of zones) {
      expect(zone.strikeTick).toBe(zone.tick + WARNING_TICKS);
      expect(zone.radius).toBe(ZONE_RADIUS);
      const dx = zone.position.x - 600;
      const dy = zone.position.y - 600;
      expect(dx * dx + dy * dy).toBeLessThanOrEqual(MAX_OFFSET * MAX_OFFSET);
    }
    // The offset is random per strike, not fixed.
    expect(new Set(zones.map((zone) => zone.position.x)).size).toBeGreaterThan(15);
    // A parked target is always inside its zone, so every strike hits it for full damage.
    const hits = events.filter((event) => event.type === 'damage' && event.cause === 'ability');
    expect(hits.length).toBeGreaterThanOrEqual(20);
    for (const hit of hits) expect(hit).toMatchObject({ amount: ZONE_DAMAGE, targetId: 'ball-1' });
  });

  it('stores its next strike as an absolute tick', () => {
    const { world } = play(standoff(), FIRST_STRIKE_DELAY_TICKS);
    const [self] = world.balls;
    if (self === undefined) throw new Error('expected the Storm');
    expect(nextStrikeTickOf(self)).toBe(FIRST_STRIKE_DELAY_TICKS + COOLDOWN_TICKS);
  });

  it('keeps the zone count bounded over a whole match', () => {
    // Two near-invulnerable Storms run to the time limit.
    const mirror = indexDefinitions([storm]);
    let world = withBalls(createWorld(3, [storm, storm]), [
      { health: 1_000_000 },
      { health: 1_000_000 },
    ]);
    const bound = 2 * Math.ceil(WARNING_TICKS / COOLDOWN_TICKS);
    let most = 0;
    for (let i = 0; i < MATCH_TIME_LIMIT_TICKS && world.match.status === 'running'; i++) {
      world = step(world, mirror).world;
      most = Math.max(most, world.zones.length);
    }
    expect(world.tick).toBe(MATCH_TIME_LIMIT_TICKS);
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(bound);
  });

  describe('randomOffset', () => {
    it('stays inside the disk and covers it in every direction', () => {
      let state = 1;
      const random = () => {
        state = (state * 48271) % 2147483647;
        return state / 2147483647;
      };
      const quadrants = new Set<string>();
      for (let i = 0; i < 500; i++) {
        const { x, y } = randomOffset(random, 70);
        expect(x * x + y * y).toBeLessThanOrEqual(70 * 70);
        quadrants.add(`${Math.sign(x)}${Math.sign(y)}`);
      }
      expect(quadrants.size).toBe(4);
    });
  });
});
