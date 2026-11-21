import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { BallState, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { archer, FIRST_SHOT_DELAY_TICKS } from './archer.ts';
import { COPY_BACK_TICKS, COPY_OFFSET, FIRST_COPY_TICK, mirage, mirageStateOf } from './mirage.ts';

/** The `index`th ball of `world`, which a test expects to be there. */
function ballAt(world: WorldState, index: number): BallState {
  const ball = world.balls[index];
  if (ball === undefined) throw new Error(`expected ball ${String(index)}`);
  return ball;
}

const lookup = indexDefinitions([mirage, archer, blue]);

function play(world: WorldState, ticks: number, until?: (events: readonly SimEvent[]) => boolean) {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
    if (until?.(result.events) === true) break;
  }
  return { world: current, events };
}

/** A Mirage heading straight at an Archer across the court, so a lead is along its line. */
function standoff(): WorldState {
  return withBalls(createWorld(3, [mirage, archer]), [
    { position: { x: 880, y: 500 }, velocity: { x: -1, y: 0 } },
    { position: { x: 120, y: 500 }, velocity: { x: 1, y: 0 } },
  ]);
}

describe('Mirage (ADR 0077)', () => {
  it('shows its copy from its first tick on, COPY_OFFSET away on one of eight sides', () => {
    const before = play(standoff(), FIRST_COPY_TICK - 1).world;
    expect(mirageStateOf(ballAt(before, 0))?.copyOn).toBe(false);
    const { world } = play(before, 1);
    const state = mirageStateOf(ballAt(world, 0));
    if (state === undefined) throw new Error('expected a Mirage');
    expect(state.copyOn).toBe(true);
    expect(state.backAt).toBe(FIRST_COPY_TICK);
    const reach = Math.sqrt(state.copyDx * state.copyDx + state.copyDy * state.copyDy);
    expect(reach).toBeCloseTo(COPY_OFFSET, 0);
  });

  it('draws aimed shots to its copy, which a shot pops; it comes back COPY_BACK_TICKS later', () => {
    // Its copy already out to one side (the first arrow and the first copy share a tick).
    const shown = withBalls(standoff(), [
      { abilityState: { copyOn: true, copyDx: 0, copyDy: -COPY_OFFSET, backAt: 0 } },
      {},
    ]);
    let world = shown;
    let popTick = -1;
    const events: SimEvent[] = [];
    for (let i = 0; i < FIRST_SHOT_DELAY_TICKS + 120 && popTick < 0; i++) {
      const result = step(world, lookup);
      world = result.world;
      events.push(...result.events);
      if (mirageStateOf(ballAt(world, 0))?.copyOn === false) popTick = world.tick;
    }
    expect(events.some((event) => event.type === 'projectileFired')).toBe(true);
    expect(popTick).toBeGreaterThan(FIRST_SHOT_DELAY_TICKS);
    // The arrow went for the copy and never touched the Mirage.
    const arrowHits = events.filter(
      (event) =>
        event.type === 'damage' && event.targetId === 'ball-0' && event.via === 'projectile',
    );
    expect(arrowHits).toStrictEqual([]);
    expect(mirageStateOf(ballAt(world, 0))?.backAt).toBe(popTick + COPY_BACK_TICKS);
  });

  it('is hit by the same arrow when no copy shows', () => {
    const hidden = withBalls(standoff(), [
      { abilityState: { copyOn: false, copyDx: 0, copyDy: 0, backAt: 100_000 } },
      {},
    ]);
    const { events } = play(hidden, FIRST_SHOT_DELAY_TICKS + 120);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'damage', targetId: 'ball-0', via: 'projectile' }),
    );
  });

  it('never fools a bump: contact reaches the real Mirage', () => {
    const world = withBalls(createWorld(1, [mirage, blue]), [
      { position: { x: 380, y: 500 }, velocity: { x: mirage.speed, y: 0 } },
      { position: { x: 640, y: 500 }, velocity: { x: 0, y: 0 } },
    ]);
    const { events } = play(world, 40);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'damage', targetId: 'ball-0', cause: 'contact' }),
    );
  });
});
