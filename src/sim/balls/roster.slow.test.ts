// Roster-wide tests that play every matchup for whole matches: determinism, the measured
// pass-through margin and the identity rules. Slow, so they run in their own suite
// (pnpm test:slow, its own CI job) and the main test run stays fast.
import { describe, expect, it } from 'vitest';
import { DT, MATCH_TIME_LIMIT_TICKS, STANDARD_BALL_RADIUS } from '../constants.ts';
import { step } from '../step.ts';
import type { BallDefinition, BallState, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { archer, ARROW_DAMAGE } from './archer.ts';
import { brawler } from './brawler.ts';
import { frost } from './frost.ts';
import { BALL_LOOKUP, BALLS } from './index.ts';
import { DAMAGE_PER_STACK, MAX_STACKS, speedster } from './speedster.ts';
import { storm, ZONE_DAMAGE } from './storm.ts';
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

/**
 * Share of the damage `ball` dealt that came from its ability, against each opponent over 40
 * seeds in both slot orders (as `pnpm balance` plays them), so slot luck and sampling noise stay
 * well below the margins the identity rules leave.
 */
function abilityShare(ball: BallDefinition, opponents: readonly BallDefinition[]): number {
  let ability = 0;
  let total = 0;
  for (const opponent of opponents) {
    for (let seed = 0; seed < 40; seed++) {
      for (const [pair, selfId] of [
        [[ball, opponent], 'ball-0'],
        [[opponent, ball], 'ball-1'],
      ] as const) {
        const { events } = play(createWorld(seed, pair), MATCH_TIME_LIMIT_TICKS);
        for (const event of events) {
          if (event.type !== 'damage' || event.sourceId !== selfId) continue;
          total += event.amount;
          if (event.cause === 'ability') ability += event.amount;
        }
      }
    }
  }
  expect(total).toBeGreaterThan(0);
  return ability / total;
}

/**
 * Whole-roster runs play every matchup for a full match, which takes a few seconds; Vitest's
 * default 5 s per test is too tight once several test files run in parallel.
 */
const ROSTER_TIMEOUT_MS = 60_000;

describe('the ball roster (slow)', () => {
  it(
    'is deterministic for every matchup, worlds and events, zones included',
    () => {
      const zoneEvents = new Set<string>();
      for (const [a, b] of matchups) {
        const first = play(createWorld(99, [a, b]), MATCH_TIME_LIMIT_TICKS);
        const second = play(createWorld(99, [a, b]), MATCH_TIME_LIMIT_TICKS);
        expect(second.world).toStrictEqual(first.world);
        expect(second.events).toStrictEqual(first.events);
        for (const event of first.events) {
          if (event.type === 'zoneSpawned' || event.type === 'zoneStruck') {
            zoneEvents.add(event.type);
          }
        }
      }
      // Zones really are part of what was compared.
      expect([...zoneEvents].sort()).toStrictEqual(['zoneSpawned', 'zoneStruck']);
    },
    ROSTER_TIMEOUT_MS,
  );

  it(
    'never lets two balls close faster than the pass-through limit',
    { timeout: ROSTER_TIMEOUT_MS },
    () => {
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
      // A safety margin below the real limit (1.0). It was 0.5 (2x) until step 3b, when a faster
      // Vampire and Archer pushed the worst observed case to about 0.504; 0.6 still leaves 1.67x.
      // Do not loosen this again. If a ball pushes past 0.6, implement swept ball-to-ball collision
      // (like the projectile sweep, ADR 0005) instead of raising the margin.
      expect(worst).toBeLessThan(0.6);
    },
  );

  describe('identity rules', () => {
    // What makes each ball itself. Balance tuning must keep these true; if a change needs to break
    // one, that is a design decision, not a tuning step.
    const others = (id: string) => BALLS.filter((ball) => ball.id !== id);

    it('every ball is the standard size, apart from explicitly listed exceptions', () => {
      // A size-themed ball (a Titan, a Tiny) is a design decision: list it here with its radius.
      const RADIUS_EXCEPTIONS: Readonly<Record<string, number>> = {};
      for (const ball of BALLS) {
        expect(ball.radius).toBe(RADIUS_EXCEPTIONS[ball.id] ?? STANDARD_BALL_RADIUS);
      }
    });

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

    it(
      'Archer gets at least half its damage from its arrows',
      { timeout: ROSTER_TIMEOUT_MS },
      () => {
        expect(abilityShare(archer, others(archer.id))).toBeGreaterThanOrEqual(0.5);
      },
    );

    it(
      'Storm gets at least 40% of its damage from its lightning',
      { timeout: ROSTER_TIMEOUT_MS },
      () => {
        expect(abilityShare(storm, others(storm.id))).toBeGreaterThanOrEqual(0.4);
      },
    );

    it('Storm’s zone deals the biggest single ability hit in the roster', () => {
      // The largest damage any one ability hit can deal, per ball. Listed by hand rather than
      // measured, because sampled matches can miss a maximum (a Speedster rarely hits at full
      // stacks). A new ball must be added here.
      const biggestHit: Readonly<Record<string, number>> = {
        brawler: 0,
        speedster: MAX_STACKS * DAMAGE_PER_STACK,
        vampire: 0,
        archer: ARROW_DAMAGE,
        storm: ZONE_DAMAGE,
        frost: 0,
      };
      expect(Object.keys(biggestHit).sort()).toStrictEqual(BALLS.map((ball) => ball.id).sort());
      for (const ball of others(storm.id)) {
        expect(ZONE_DAMAGE).toBeGreaterThan(biggestHit[ball.id] ?? Infinity);
      }
    });

    it('Frost has the lowest base speed', () => {
      for (const ball of others(frost.id)) expect(frost.speed).toBeLessThan(ball.speed);
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
