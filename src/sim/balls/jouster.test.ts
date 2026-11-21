import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { BallState, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import {
  CHARGE_EVERY_TICKS,
  CHARGE_SPEED,
  CHARGE_TICKS,
  FIRST_CHARGE_TICK,
  GLANCE_SHARE,
  jouster,
  jousterStateOf,
  LANCE_TIMES,
} from './jouster.ts';

/** The `index`th ball of `world`, which a test expects to be there. */
function ballAt(world: WorldState, index: number): BallState {
  const ball = world.balls[index];
  if (ball === undefined) throw new Error(`expected ball ${String(index)}`);
  return ball;
}

const lookup = indexDefinitions([jouster, blue]);

function play(world: WorldState, ticks: number) {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return { world: current, events };
}

/** The Jouster's first bump on a still blue, from `dy` above or below its line. */
function bumpFrom(dy: number) {
  const world = withBalls(createWorld(1, [jouster, blue]), [
    { position: { x: 300, y: 500 }, velocity: { x: jouster.speed, y: 0 } },
    { position: { x: 480, y: 500 + dy }, velocity: { x: 0, y: 0 } },
  ]);
  const { events } = play(world, 30);
  const hit = events.find(
    (event) => event.type === 'damage' && event.sourceId === 'ball-0' && event.cause === 'contact',
  );
  if (hit?.type !== 'damage') throw new Error('expected the Jouster to bump');
  return hit;
}

describe('Jouster (ADR 0077)', () => {
  it('lands a head-on bump LANCE_TIMES as hard: 33, never more', () => {
    const hit = bumpFrom(0);
    expect(hit.times).toBe(LANCE_TIMES);
    expect(hit.amount).toBe(Math.round(jouster.contactDamage * LANCE_TIMES * hit.multiplier));
    expect(hit.amount).toBeLessThanOrEqual(33);
  });

  it('lands a glancing bump at GLANCE_SHARE', () => {
    // Met well off its line: a glance.
    const hit = bumpFrom(105);
    expect(hit.times).toBe(GLANCE_SHARE);
    expect(hit.amount).toBe(
      Math.max(1, Math.round(jouster.contactDamage * GLANCE_SHARE * hit.multiplier)),
    );
  });

  it('charges at its enemy every CHARGE_EVERY_TICKS, CHARGE_SPEED as fast, for CHARGE_TICKS', () => {
    const apart = withBalls(createWorld(2, [jouster, blue]), [
      { position: { x: 150, y: 150 }, velocity: { x: 0, y: jouster.speed } },
      { position: { x: 850, y: 850 }, velocity: { x: 0, y: blue.speed } },
    ]);
    const before = play(apart, FIRST_CHARGE_TICK - 1);
    expect(jousterStateOf(ballAt(before.world, 0))?.charging).toBe(false);
    const started = play(before.world, 1).world;
    const state = jousterStateOf(ballAt(started, 0));
    expect(state).toStrictEqual({
      nextCharge: FIRST_CHARGE_TICK + CHARGE_EVERY_TICKS,
      chargeEnds: FIRST_CHARGE_TICK + CHARGE_TICKS,
      charging: true,
    });
    const { x, y } = ballAt(started, 0).velocity;
    expect(Math.sqrt(x * x + y * y)).toBeCloseTo(jouster.speed * CHARGE_SPEED, 6);
    // Turned straight at where its enemy was.
    const self = ballAt(before.world, 0);
    const enemy = ballAt(before.world, 1);
    const dx = enemy.position.x - self.position.x;
    const dy = enemy.position.y - self.position.y;
    const along = (x * dx + y * dy) / (Math.sqrt(x * x + y * y) * Math.sqrt(dx * dx + dy * dy));
    expect(along).toBeGreaterThan(0.999);
    const ended = play(started, CHARGE_TICKS).world;
    expect(jousterStateOf(ballAt(ended, 0))?.charging).toBe(false);
  });
});
