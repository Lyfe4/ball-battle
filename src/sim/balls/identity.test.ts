// Identity rules read from the definitions alone: what makes each ball itself. Balance tuning must
// keep these true; breaking one is a design decision, not a tuning step. The rules measured by
// playing matches (how much of a ball's damage is its ability) are in ability-share.slow.test.ts.
import { describe, expect, it } from 'vitest';
import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { POISON_DAMAGE } from '../status.ts';
import { archer, ARROW_DAMAGE } from './archer.ts';
import { berserker, RAGE_DAMAGE } from './berserker.ts';
import { brawler } from './brawler.ts';
import { frost } from './frost.ts';
import { BALLS } from './index.ts';
import { ZONE_DAMAGE as SHOCKWAVE_DAMAGE } from './quake.ts';
import { SHOT_DAMAGE } from './sniper.ts';
import { DAMAGE_PER_STACK, MAX_STACKS, speedster } from './speedster.ts';
import { storm, ZONE_DAMAGE } from './storm.ts';
import { reflectFor } from './thorns.ts';
import { LIFESTEAL, vampire } from './vampire.ts';

describe('the ball roster: identity rules', () => {
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
});
