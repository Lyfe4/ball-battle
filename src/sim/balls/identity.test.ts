// Identity rules read from the definitions alone: what makes each ball itself. Balance tuning must
// keep these true; breaking one is a design decision, not a tuning step. The rules measured by
// playing matches (how much of a ball's damage is its ability) are in ability-share.slow.test.ts.
import { describe, expect, it } from 'vitest';
import { ARENA_SIZE, STANDARD_BALL_RADIUS } from '../constants.ts';
import { createWorld } from '../world.ts';
import { POISON_DAMAGE } from '../status.ts';
import { archer, ARROW_DAMAGE } from './archer.ts';
import { berserker, RAGE_DAMAGE } from './berserker.ts';
import { brawler } from './brawler.ts';
import { frost } from './frost.ts';
import { ghost, SPECTRAL_DAMAGE } from './ghost.ts';
import { BALLS } from './index.ts';
import { magnet } from './magnet.ts';
import { MAX_MINIONS, MINION_DAMAGE, MINION_RADIUS, necromancer } from './necromancer.ts';
import { ZONE_DAMAGE as SHOCKWAVE_DAMAGE } from './quake.ts';
import { SHOT_DAMAGE } from './sniper.ts';
import { DAMAGE_PER_STACK, MAX_STACKS, speedster } from './speedster.ts';
import { storm, ZONE_DAMAGE, ZONE_RADIUS as STORM_ZONE_RADIUS } from './storm.ts';
import { reflectFor } from './thorns.ts';
import { LIFESTEAL, vampire } from './vampire.ts';
import { chrono, MOMENT_EVERY_TICKS, REWIND_MOMENTS } from './chrono.ts';
import { BURN_DAMAGE, inferno, PATCH_RADIUS, PATCH_TICKS } from './inferno.ts';
import { MAX_RADIUS, titanRadius } from './titan.ts';

describe('the ball roster: identity rules', () => {
  // What makes each ball itself. Balance tuning must keep these true; if a change needs to break
  // one, that is a design decision, not a tuning step.
  const others = (id: string) => BALLS.filter((ball) => ball.id !== id);

  it('every ball is the standard size, apart from explicitly listed exceptions', () => {
    // A size-themed ball is a design decision: list it here with its radius over a match. The
    // Titan starts at the standard size and grows to its cap (ADR 0034).
    const RADIUS_EXCEPTIONS: Readonly<Record<string, readonly [number, number]>> = {
      titan: [STANDARD_BALL_RADIUS, MAX_RADIUS],
    };
    for (const ball of BALLS) {
      const [start, largest] = RADIUS_EXCEPTIONS[ball.id] ?? [
        STANDARD_BALL_RADIUS,
        STANDARD_BALL_RADIUS,
      ];
      expect(ball.radius).toBe(start);
      const sample = createWorld(1, [ball, ball]).balls[0];
      if (sample === undefined) throw new Error('no ball');
      // Its size late in a long match: as big as it ever gets.
      expect(ball.radiusOf?.(sample, 1_000_000) ?? ball.radius).toBe(largest);
    }
  });

  it('Titan grows to under a tenth of the arena, and only grows', () => {
    expect(MAX_RADIUS).toBeLessThanOrEqual(ARENA_SIZE / 10);
    expect(titanRadius(0)).toBe(STANDARD_BALL_RADIUS);
    for (let tick = 0; tick < 3600; tick += 60) {
      expect(titanRadius(tick + 60)).toBeGreaterThanOrEqual(titanRadius(tick));
    }
  });

  it('Chrono rewinds once a match, about half a second back, and has no other ability', () => {
    expect(MOMENT_EVERY_TICKS * REWIND_MOMENTS).toBeLessThanOrEqual(30);
    expect(chrono.hooks.onHitBall).toBeUndefined();
    expect(chrono.hooks.onDamageDealt).toBeUndefined();
    expect(chrono.initialAbilityState.used).toBe(false);
  });

  it('Inferno’s fire is small and short-lived, and its own hits are the second lightest', () => {
    expect(PATCH_RADIUS).toBeLessThan(STORM_ZONE_RADIUS);
    expect(PATCH_TICKS).toBeLessThanOrEqual(150);
    for (const ball of others(inferno.id).filter((other) => other.id !== archer.id)) {
      expect(inferno.contactDamage).toBeLessThan(ball.contactDamage);
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
      // Reflection of the hardest contact hit in the roster, a raging Berserker's included.
      thorns: reflectFor(
        Math.max(...BALLS.map((ball) => ball.contactDamage), berserker.contactDamage + RAGE_DAMAGE),
      ),
      venom: POISON_DAMAGE,
      // Its rage is contact damage, not an ability hit.
      berserker: 0,
      sniper: SHOT_DAMAGE,
      quake: SHOCKWAVE_DAMAGE,
      // Its pull only steers; its hits are contact hits.
      magnet: 0,
      ghost: SPECTRAL_DAMAGE,
      necromancer: MINION_DAMAGE,
      // A rewind heals nothing it didn't have; it is no hit.
      chrono: 0,
      titan: 0,
      inferno: BURN_DAMAGE,
    };
    expect(Object.keys(biggestHit).sort()).toStrictEqual(BALLS.map((ball) => ball.id).sort());
    for (const ball of others(storm.id)) {
      expect(ZONE_DAMAGE).toBeGreaterThan(biggestHit[ball.id] ?? Infinity);
    }
  });

  it('Frost has the lowest base speed', () => {
    for (const ball of others(frost.id)) expect(frost.speed).toBeLessThan(ball.speed);
  });

  it('Berserker has the most health', () => {
    for (const ball of others(berserker.id)) {
      expect(berserker.maxHealth).toBeGreaterThan(ball.maxHealth);
    }
  });

  it('Brawler hits hardest and has no ability', () => {
    for (const ball of others(brawler.id)) {
      expect(brawler.contactDamage).toBeGreaterThan(ball.contactDamage);
    }
    // Even a Berserker at the edge of defeat hits softer.
    expect(brawler.contactDamage).toBeGreaterThan(berserker.contactDamage + RAGE_DAMAGE);
    expect(Object.keys(brawler.hooks)).toStrictEqual([]);
    expect(brawler.initialAbilityState).toStrictEqual({});
  });

  it('Magnet hits harder than every ball but the Brawler: its pull forces a brawl it can win', () => {
    for (const ball of others(magnet.id).filter(({ id }) => id !== brawler.id)) {
      expect(magnet.contactDamage).toBeGreaterThan(ball.contactDamage);
    }
  });

  it('Ghost’s spectral hit is weaker than its own solid hit, and it is never always phased', () => {
    expect(SPECTRAL_DAMAGE).toBeLessThan(ghost.contactDamage);
    expect(ghost.phasedOf?.({ ...stateOf(ghost), abilityState: ghost.initialAbilityState })).toBe(
      false,
    );
  });

  it('Necromancer’s minions are small, few, and its only ability', () => {
    expect(MINION_RADIUS).toBeLessThan(necromancer.radius);
    expect(MAX_MINIONS).toBeGreaterThanOrEqual(1);
    expect(MAX_MINIONS).toBeLessThanOrEqual(3);
    expect(Object.keys(necromancer.hooks)).toStrictEqual(['onTick']);
  });
});

/** A ball state for a definition, for asking its pure queries. */
function stateOf(definition: (typeof BALLS)[number]) {
  return {
    id: 'ball-0',
    definitionId: definition.id,
    position: { x: 500, y: 500 },
    velocity: { x: definition.speed, y: 0 },
    radius: definition.radius,
    health: definition.maxHealth,
    abilityState: definition.initialAbilityState,
    statuses: [],
  };
}
