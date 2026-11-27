import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, red, withBalls } from '../test-support.ts';
import type { BallDefinition, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import {
  hunter,
  LEAST_TIMES,
  MOST_TIMES,
  PREY_SPEED,
  preyTimes,
  SNARE_ARM_TICKS,
  SNARE_BITE,
  SNARE_HOLD_TICKS,
} from './hunter.ts';
import { HOLD_TICKS as KRAKEN_HOLD_TICKS } from './kraken.ts';
import { LANCE_TIMES } from './jouster.ts';
import { jouster } from './jouster.ts';

const lookup = indexDefinitions([hunter, red, blue]);

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

/** The Hunter's first bump on `prey`, head-on, both coming in at their own speeds. */
function firstBumpOn(prey: BallDefinition): number {
  const world = withBalls(createWorld(1, [hunter, prey]), [
    { position: { x: 300, y: 500 }, velocity: { x: hunter.speed, y: 0 } },
    { position: { x: 520, y: 500 }, velocity: { x: -prey.speed, y: 0 } },
  ]);
  const hit = play(world, 30).find(
    (event) => event.type === 'damage' && event.cause === 'contact' && event.sourceId === 'ball-0',
  );
  if (hit?.type !== 'damage') throw new Error('expected a bump');
  return hit.amount;
}

describe('the Hunter (ADR 0091)', () => {
  it('bumps as it is on prey at a standard speed, harder on slower prey, softer on faster', () => {
    expect(preyTimes(PREY_SPEED)).toBe(1);
    expect(preyTimes(PREY_SPEED * 0.9)).toBeGreaterThan(1);
    expect(preyTimes(PREY_SPEED * 1.1)).toBeLessThan(1);
    expect(preyTimes(0)).toBe(MOST_TIMES);
    expect(preyTimes(PREY_SPEED * 3)).toBe(LEAST_TIMES);
  });

  it('reads the speed its prey came in at, before the bounce', () => {
    // Blue (560) is slow prey, red (800) fast: the same head-on bump lands very differently.
    expect(firstBumpOn(blue)).toBe(Math.round(hunter.contactDamage * preyTimes(blue.speed)));
    expect(firstBumpOn(red)).toBe(Math.round(hunter.contactDamage * preyTimes(red.speed)));
    expect(firstBumpOn(blue)).toBeGreaterThan(firstBumpOn(red) * 2);
  });

  it('a snare it leaves holds an enemy that runs into it once armed', () => {
    const world = withBalls(createWorld(1, [hunter, red]), [
      {
        position: { x: 300, y: 500 },
        velocity: { x: 0, y: -hunter.speed },
        abilityState: { nextSnareTick: 0 },
      },
      { position: { x: 300, y: 940 }, velocity: { x: 0, y: -red.speed } },
    ]);
    const events = play(world, 60);
    const sprung = events.find((event) => event.type === 'zoneStruck');
    if (sprung?.type !== 'zoneStruck') throw new Error('expected the snare to spring');
    expect(sprung.triggeredBy).toBe('ball-1');
    expect(sprung.tick).toBeGreaterThanOrEqual(SNARE_ARM_TICKS);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'damage', targetId: 'ball-1', amount: SNARE_BITE }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'statusApplied', ballId: 'ball-1', status: 'held' }),
    );
  });

  it('identity: a snare is a brief catch, never a Kraken grip, and its plain bump is no lance', () => {
    // Its snares help it hunt; they are not the main thing: a hold far shorter than the Kraken's.
    expect(SNARE_HOLD_TICKS * 2).toBeLessThanOrEqual(KRAKEN_HOLD_TICKS);
    // On prey at a standard speed its bump is plain, under the Jouster's head-on lance.
    expect(hunter.contactDamage * preyTimes(PREY_SPEED)).toBeLessThan(
      jouster.contactDamage * LANCE_TIMES,
    );
    // It reads its prey, never itself: its own speed never changes its bump.
    const [self] = createWorld(1, [hunter, red]).balls;
    if (self === undefined) throw new Error('expected the Hunter');
    const still = { ...self, velocity: { x: 0, y: 0 } };
    const bump = (ball: typeof self) => hunter.contactDamageOf?.(ball, hunter, { speed: 500 });
    expect(bump(still)).toBe(bump(self));
  });
});
