// Lasting zones (ADR 0034): a zone that stays after its first strike and pulses on a fixed rhythm.
import { describe, expect, it } from 'vitest';
import { defineBall } from '../define-ball.ts';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, red, withBalls } from '../test-support.ts';
import type { SimEvent, WorldState, ZoneState, ZoneStruckEvent } from '../types.ts';
import { createWorld } from '../world.ts';
import { pulseAt } from './resolve.ts';
import type { ZoneLinger } from './spawn.ts';

const DELAY = 2;
const DAMAGE = 3;
const LINGER: ZoneLinger = { ticks: 30, pulseEveryTicks: 10 };

/** A test-only ball that marks one zone on tick 1 at (500, 500), lasting or not. */
function burner(linger: ZoneLinger | undefined) {
  return defineBall({
    id: 'burner',
    name: 'Burner',
    description: 'Test fixture: marks one zone.',
    color: '#ffffff',
    radius: 50,
    speed: 800,
    maxHealth: 100,
    contactDamage: 10,
    initialAbilityState: {},
    hooks: {
      onTick: ({ world }) =>
        world.tick === 1
          ? [
              {
                kind: 'spawnZone',
                position: { x: 500, y: 500 },
                radius: 100,
                damage: DAMAGE,
                delayTicks: DELAY,
                ...(linger === undefined ? {} : { linger }),
              },
            ]
          : [],
    },
  });
}

const still = { x: 0, y: 0 };

/** The burner in a corner, a parked target inside the zone and one outside it. */
function setup(linger: ZoneLinger | undefined): {
  world: WorldState;
  play: (ticks: number) => SimEvent[];
  last: () => WorldState;
} {
  const owner = burner(linger);
  const lookup = indexDefinitions([owner, red, blue]);
  let world = withBalls(createWorld(1, [owner, red, blue]), [
    { position: { x: 80, y: 80 }, velocity: still },
    { position: { x: 500, y: 500 }, velocity: still },
    { position: { x: 900, y: 900 }, velocity: still },
  ]);
  const start = world;
  return {
    world: start,
    play: (ticks) => {
      const events: SimEvent[] = [];
      for (let i = 0; i < ticks; i++) {
        const result = step(world, lookup);
        world = result.world;
        events.push(...result.events);
      }
      return events;
    },
    last: () => world,
  };
}

const struck = (events: readonly SimEvent[]) =>
  events.filter((event): event is ZoneStruckEvent => event.type === 'zoneStruck');

describe('lasting zones', () => {
  it('strike on the strike tick, then every pulse until they end, and are then removed', () => {
    const { play, last } = setup(LINGER);
    const events = play(1 + DELAY + LINGER.ticks + 5);
    const strikes = struck(events);
    // Strike tick 3, then 13, 23 and 33 (the end tick lands on the rhythm).
    expect(strikes.map((event) => [event.tick, event.pulse, event.hitIds])).toStrictEqual([
      [3, 0, ['ball-1']],
      [13, 1, ['ball-1']],
      [23, 2, ['ball-1']],
      [33, 3, ['ball-1']],
    ]);
    expect(last().balls[1]?.health).toBe(red.maxHealth - DAMAGE * 4);
    // The ball outside was never hit, and the zone is gone.
    expect(last().balls[2]?.health).toBe(blue.maxHealth);
    expect(last().zones).toStrictEqual([]);
  });

  it('stays in the world between pulses', () => {
    const { play, last } = setup(LINGER);
    play(1 + DELAY + 5);
    expect(last().zones).toHaveLength(1);
  });

  it('leave a zone without linger striking exactly once, with no pulse number', () => {
    const { play, last } = setup(undefined);
    const strikes = struck(play(40));
    expect(strikes).toHaveLength(1);
    expect(strikes[0]?.pulse).toBeUndefined();
    expect(last().zones).toStrictEqual([]);
  });

  it('pulse only on their rhythm and inside their lifetime', () => {
    const zone: ZoneState = {
      id: 'zone-0',
      ownerId: 'ball-0',
      position: { x: 500, y: 500 },
      radius: 100,
      damage: 1,
      spawnTick: 0,
      strikeTick: 5,
      endTick: 27,
      pulseEveryTicks: 10,
    };
    expect([4, 5, 6, 15, 25, 27, 35].map((tick) => pulseAt(zone, tick))).toStrictEqual([
      undefined,
      0,
      undefined,
      1,
      2,
      undefined,
      undefined,
    ]);
  });

  it('refuse a linger that is not a whole number of ticks', () => {
    const { play } = setup({ ticks: 0, pulseEveryTicks: 10 });
    expect(() => play(2)).toThrow(/invalid zone/);
    const odd = setup({ ticks: 10, pulseEveryTicks: 2.5 });
    expect(() => odd.play(2)).toThrow(/invalid zone/);
  });
});
