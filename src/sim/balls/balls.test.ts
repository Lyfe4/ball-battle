import { describe, expect, it } from 'vitest';
import { DT, MATCH_TIME_LIMIT_TICKS } from '../constants.ts';
import { step } from '../step.ts';
import type { BallDefinition, BallState, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { BALL_LOOKUP, BALLS } from './index.ts';

const matchups: (readonly [BallDefinition, BallDefinition])[] = BALLS.flatMap((a) =>
  BALLS.map((b) => [a, b] as const),
);

function play(world: WorldState, ticks: number, onTick?: (world: WorldState) => void) {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks && current.match.status === 'running'; i++) {
    const result = step(current, BALL_LOOKUP);
    current = result.world;
    events.push(...result.events);
    onTick?.(current);
  }
  return { world: current, events };
}

/** How fast two balls approach each other along the line between them (0 if separating). */
function closingSpeed(a: BallState, b: BallState): number {
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0) return 0;
  const relative =
    ((a.velocity.x - b.velocity.x) * dx + (a.velocity.y - b.velocity.y) * dy) / distance;
  return Math.max(0, relative);
}

describe('the ball roster', () => {
  it('has unique ids and starts every ball with its own ability state', () => {
    expect(new Set(BALLS.map((ball) => ball.id)).size).toBe(BALLS.length);
    for (const [a, b] of matchups) {
      const world = createWorld(1, [a, b]);
      expect(world.balls.map((ball) => ball.abilityState)).toStrictEqual([
        a.initialAbilityState,
        b.initialAbilityState,
      ]);
    }
  });

  it('is deterministic for every matchup, worlds and events', () => {
    for (const [a, b] of matchups) {
      const first = play(createWorld(99, [a, b]), MATCH_TIME_LIMIT_TICKS);
      const second = play(createWorld(99, [a, b]), MATCH_TIME_LIMIT_TICKS);
      expect(second.world).toStrictEqual(first.world);
      expect(second.events).toStrictEqual(first.events);
    }
  });

  it('never lets two balls close faster than the pass-through limit', () => {
    // ADR 0002: a hit can be missed if the balls close by more than the sum of their radii in one
    // tick. Includes speed from abilities and from elastic collisions.
    let worst = 0;
    for (const [a, b] of matchups) {
      const limit = (a.radius + b.radius) / DT;
      for (let seed = 0; seed < 60; seed++) {
        play(createWorld(seed, [a, b]), MATCH_TIME_LIMIT_TICKS, (world) => {
          const [first, second] = world.balls;
          if (first === undefined || second === undefined) return;
          worst = Math.max(worst, closingSpeed(first, second) / limit);
        });
      }
    }
    expect(worst).toBeLessThan(0.5);
  });
});
