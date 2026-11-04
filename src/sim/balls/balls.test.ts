import { describe, expect, it } from 'vitest';
import { DT, MATCH_TIME_LIMIT_TICKS } from '../constants.ts';
import { step } from '../step.ts';
import type { BallDefinition, BallState, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { archer } from './archer.ts';
import { brawler } from './brawler.ts';
import { BALL_LOOKUP, BALLS } from './index.ts';
import { DAMAGE_PER_STACK, MAX_STACKS, speedster } from './speedster.ts';
import { LIFESTEAL, vampire } from './vampire.ts';

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

  describe('identity rules', () => {
    // What makes each ball itself. Balance tuning must keep these true; if a change needs to break
    // one, that is a design decision, not a tuning step.
    const others = (id: string) => BALLS.filter((ball) => ball.id !== id);

    it('Speedster is the fastest ball at base speed', () => {
      for (const ball of others(speedster.id)) expect(speedster.speed).toBeGreaterThan(ball.speed);
    });

    it('Speedster’s bonus at max stacks is at least half its contact damage', () => {
      expect(MAX_STACKS * DAMAGE_PER_STACK).toBeGreaterThanOrEqual(speedster.contactDamage / 2);
    });

    it('Vampire steals at least 40% of the damage it deals', () => {
      expect(LIFESTEAL).toBeGreaterThanOrEqual(0.4);
      expect(vampire.hooks.onDamageDealt).toBeDefined();
    });

    it('Archer has the lowest contact damage', () => {
      for (const ball of others(archer.id)) {
        expect(archer.contactDamage).toBeLessThan(ball.contactDamage);
      }
    });

    it('Archer gets at least half its damage from its arrows', () => {
      let ability = 0;
      let total = 0;
      for (const opponent of others(archer.id)) {
        for (let seed = 0; seed < 20; seed++) {
          const { events } = play(createWorld(seed, [archer, opponent]), MATCH_TIME_LIMIT_TICKS);
          for (const event of events) {
            if (event.type !== 'damage' || event.sourceId !== 'ball-0') continue;
            total += event.amount;
            if (event.cause === 'ability') ability += event.amount;
          }
        }
      }
      expect(total).toBeGreaterThan(0);
      expect(ability / total).toBeGreaterThanOrEqual(0.5);
    });

    it('Brawler hits hardest and has no ability', () => {
      for (const ball of others(brawler.id)) {
        expect(brawler.contactDamage).toBeGreaterThan(ball.contactDamage);
      }
      expect(Object.keys(brawler.hooks)).toStrictEqual([]);
      expect(brawler.initialAbilityState).toStrictEqual({});
    });
  });
});
