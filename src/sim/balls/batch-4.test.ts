// The Chrono, Titan and Inferno (ADR 0034): each ball's own mechanic, on fixed scenes.
import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, red, withBalls } from '../test-support.ts';
import type { SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { chrono, hasRewound, historyOf, MOMENT_EVERY_TICKS, REWIND_MOMENTS } from './chrono.ts';
import {
  BURN_DAMAGE,
  BURN_EVERY_TICKS,
  CATCH_TICKS,
  DROP_EVERY_TICKS,
  inferno,
  PATCH_TICKS,
} from './inferno.ts';
import { MAX_RADIUS, titan } from './titan.ts';

const lookup = indexDefinitions([chrono, titan, inferno, red, blue]);

function play(world: WorldState, ticks: number) {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks && current.match.status === 'running'; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return { world: current, events };
}

const still = { x: 0, y: 0 };

describe('Chrono', () => {
  it('keeps its last few moments, a fixed rhythm apart', () => {
    const world = withBalls(createWorld(1, [chrono, blue]), [
      { position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 } },
      { position: { x: 800, y: 800 }, velocity: still },
    ]);
    const self = play(world, 100).world.balls[0];
    if (self === undefined) throw new Error('no Chrono');
    const history = historyOf(self);
    expect(history).toHaveLength(REWIND_MOMENTS);
    expect(history.map((moment) => moment.tick)).toStrictEqual([90 - MOMENT_EVERY_TICKS, 90]);
  });

  /** The Chrono on 1 health, about to meet red head-on, having stood still at (300, 300). */
  function knockout(): WorldState {
    const parked = withBalls(createWorld(1, [chrono, red]), [
      { position: { x: 300, y: 300 }, velocity: still },
      { position: { x: 800, y: 800 }, velocity: still },
    ]);
    const settled = play(parked, MOMENT_EVERY_TICKS * REWIND_MOMENTS).world;
    return withBalls(settled, [
      { position: { x: 440, y: 500 }, velocity: { x: chrono.speed, y: 0 }, health: 1 },
      { position: { x: 560, y: 500 }, velocity: { x: -red.speed, y: 0 } },
    ]);
  }

  it('rewinds once, when knocked out: back to an earlier moment with its health then', () => {
    const { world, events } = play(knockout(), 5);
    const rewound = events.find((event) => event.type === 'rewound');
    expect(rewound).toMatchObject({ to: { x: 300, y: 300 }, healthAfter: chrono.maxHealth });
    expect(events.some((event) => event.type === 'ballDefeated')).toBe(false);
    const self = world.balls[0];
    expect(self !== undefined && hasRewound(self)).toBe(true);
  });

  it('is knocked out for good the second time', () => {
    const once = play(knockout(), 5).world;
    const again = withBalls(once, [
      { position: { x: 440, y: 500 }, velocity: { x: chrono.speed, y: 0 }, health: 1 },
      { position: { x: 560, y: 500 }, velocity: { x: -red.speed, y: 0 } },
    ]);
    const { world, events } = play(again, 5);
    expect(events.some((event) => event.type === 'rewound')).toBe(false);
    expect(world.match.status).toBe('finished');
  });
});

describe('Titan', () => {
  it('starts at the standard size and grows to its cap, and nothing else does', () => {
    const world = createWorld(2, [titan, red]);
    expect(world.balls[0]?.radius).toBe(titan.radius);
    const late = play(withBalls(world, [{ health: 1e6 }, { health: 1e6 }]), 3000).world;
    expect(late.balls[0]?.radius).toBe(MAX_RADIUS);
    expect(late.balls[1]?.radius).toBe(red.radius);
  });
});

describe('Inferno', () => {
  /** The Inferno parked at the centre, and blue parked on the spot where its patches land. */
  const scene = () =>
    withBalls(createWorld(1, [inferno, blue]), [
      { position: { x: 500, y: 500 }, velocity: still },
      { position: { x: 500, y: 500 }, velocity: still, health: 10_000 },
    ]);

  it('drops a patch where it is, which catches, then burns on a rhythm until it goes out', () => {
    const { events } = play(scene(), DROP_EVERY_TICKS + CATCH_TICKS + PATCH_TICKS + 1);
    const first = events.filter(
      (event) => event.type === 'zoneStruck' && event.zoneId === 'zone-0',
    );
    expect(first.map((event) => event.tick)).toStrictEqual(
      Array.from(
        { length: PATCH_TICKS / BURN_EVERY_TICKS + 1 },
        (_, i) => DROP_EVERY_TICKS + CATCH_TICKS + i * BURN_EVERY_TICKS,
      ),
    );
  });

  it('burns an enemy inside for BURN_DAMAGE each time, never itself', () => {
    const { events } = play(scene(), DROP_EVERY_TICKS + CATCH_TICKS + 1);
    const burns = events.filter((event) => event.type === 'damage' && event.cause === 'ability');
    expect(
      burns.map((event) => event.type === 'damage' && [event.targetId, event.amount]),
    ).toStrictEqual([['ball-1', BURN_DAMAGE]]);
  });
});
