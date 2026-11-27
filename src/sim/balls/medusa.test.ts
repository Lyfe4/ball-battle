import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, withBalls } from '../test-support.ts';
import type { SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { GLARE_WINDUP_TICKS, medusa, SHATTER_TIMES, STONE_TICKS } from './medusa.ts';

const lookup = indexDefinitions([medusa, blue]);

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

/** The Medusa heading right along y = 500 with her gaze ready, and blue on that line. */
function facing(blueX: number, blueVx: number): WorldState {
  return withBalls(createWorld(1, [medusa, blue]), [
    {
      position: { x: 150, y: 500 },
      velocity: { x: medusa.speed, y: 0 },
      abilityState: { ...medusa.initialAbilityState, nextGazeTick: 0 },
    },
    { position: { x: blueX, y: 500 }, velocity: { x: blueVx, y: 0 } },
  ]);
}

describe('the Medusa (prototype)', () => {
  it('turns the ball ahead to stone, and her bump on it shatters it and ends the stone', () => {
    const events = play(facing(550, blue.speed), 60);
    const stoned = events.find(
      (event) => event.type === 'statusApplied' && event.status === 'stoned',
    );
    expect(stoned).toMatchObject({ ballId: 'ball-1', tick: 1 + GLARE_WINDUP_TICKS });
    const shatter = events.find(
      (event) =>
        event.type === 'damage' && event.cause === 'contact' && event.sourceId === 'ball-0',
    );
    if (shatter?.type !== 'damage') throw new Error('expected her bump');
    expect(shatter.amount).toBe(Math.round(medusa.contactDamage * SHATTER_TIMES));
    // The stone ends with the shatter, before its time would run out.
    const ended = events.find(
      (event) => event.type === 'statusExpired' && event.status === 'stoned',
    );
    expect(ended?.tick).toBe(shatter.tick);
    expect(shatter.tick).toBeLessThan((stoned?.tick ?? 0) + STONE_TICKS);
  });

  it('never stones a ball behind her', () => {
    const behind = withBalls(facing(750, blue.speed), [
      { position: { x: 450, y: 500 }, velocity: { x: -medusa.speed, y: 0 } },
    ]);
    const events = play(behind, 40);
    expect(events.some((event) => event.type === 'statusApplied')).toBe(false);
  });
});
