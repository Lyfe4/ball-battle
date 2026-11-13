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
import { ghost, PHASE_CYCLE_TICKS, PHASE_TICKS, SPECTRAL_HIT } from './ghost.ts';
import { CURSE_FUSE_TICKS, CURSE_SHARE, curseBurstFor, hex } from './hex.ts';
import { MOST_WEBS, spider, WEB_NIP, WEB_SLOW_TICKS } from './spider.ts';
import { BALLS } from './index.ts';
import { magnet } from './magnet.ts';
import { MAX_MINIONS, MINION_DAMAGE, MINION_RADIUS, necromancer } from './necromancer.ts';
import { ZONE_DAMAGE as SHOCKWAVE_DAMAGE } from './quake.ts';
import { SHOT_DAMAGE } from './sniper.ts';
import { DAMAGE_PER_STACK, MAX_STACKS, speedster } from './speedster.ts';
import { storm, ZONE_DAMAGE, ZONE_RADIUS as STORM_ZONE_RADIUS } from './storm.ts';
import { reflectFor } from './thorns.ts';
import { LIFESTEAL, vampire } from './vampire.ts';
import { BIG_HIT, chrono, MOMENT_EVERY_TICKS, RECHARGE_TICKS, REWIND_MOMENTS } from './chrono.ts';
import { BURN_DAMAGE, inferno, PATCH_RADIUS, PATCH_TICKS } from './inferno.ts';
import { GROWN_HIT, MAX_RADIUS, titan, titanRadius } from './titan.ts';
import { BOOMERANG_DAMAGE, BOOMERANG_SPEED, boomerang } from './boomerang.ts';
import {
  BLAST_DAMAGE,
  BLAST_RADIUS,
  BOMB_RADIUS,
  bomber,
  DROP_TICKS,
  FUSE_TICKS,
} from './bomber.ts';
import { SHIELDED_SHARE, spartan, SPEAR_DAMAGE } from './spartan.ts';
import { bloom, HEAL_AMOUNT, HEAL_EVERY_TICKS } from './bloom.ts';
import { speedForStacks } from './speedster.ts';
import { TICK_RATE } from '../constants.ts';

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

  it('Chrono rewinds only the big hits (a shot, a strike, a blast), about half a second back', () => {
    expect(MOMENT_EVERY_TICKS * REWIND_MOMENTS).toBeLessThanOrEqual(30);
    // Every other ability hit is small: arrows, bites, burns, poison, shockwaves.
    const small = [ARROW_DAMAGE, MINION_DAMAGE, BURN_DAMAGE, POISON_DAMAGE];
    for (const hit of [...small, SHOCKWAVE_DAMAGE, BOOMERANG_DAMAGE, MAX_STACKS * DAMAGE_PER_STACK])
      expect(hit).toBeLessThan(BIG_HIT);
    expect(SHOT_DAMAGE).toBeGreaterThanOrEqual(BIG_HIT);
    expect(ZONE_DAMAGE).toBeGreaterThanOrEqual(BIG_HIT);
    // The Bomber's one big blast is rewound too (ADR 0045, group 4).
    expect(BLAST_DAMAGE).toBeGreaterThanOrEqual(BIG_HIT);
    // It recharges for seconds, so it can't undo every shot.
    expect(RECHARGE_TICKS).toBeGreaterThanOrEqual(5 * TICK_RATE);
    expect(chrono.hooks.onHitBall).toBeUndefined();
    expect(chrono.hooks.onDamageDealt).toBeUndefined();
  });

  it('Inferno’s fire is small and short-lived, and its own hits are the second lightest', () => {
    expect(PATCH_RADIUS).toBeLessThan(STORM_ZONE_RADIUS);
    expect(PATCH_TICKS).toBeLessThanOrEqual(150);
    for (const ball of others(inferno.id).filter((other) => other.id !== archer.id)) {
      expect(inferno.contactDamage).toBeLessThan(ball.contactDamage);
    }
  });

  it('Boomerang’s hits are lighter than an arrow, and it always gets home', () => {
    expect(BOOMERANG_DAMAGE).toBeLessThan(ARROW_DAMAGE);
    // Faster than any ball can go, a stacked Speedster included, so it always catches its owner.
    const fastest = speedForStacks(speedster.speed, MAX_STACKS);
    expect(BOOMERANG_SPEED).toBeGreaterThan(fastest * 1.2);
    expect(Object.keys(boomerang.hooks)).toStrictEqual(['onTick']);
  });

  it('Bomber’s bombs are small to touch, wider to blast, and at most two lie at once', () => {
    expect(BOMB_RADIUS).toBeLessThan(STANDARD_BALL_RADIUS);
    expect(BLAST_RADIUS).toBeGreaterThan(BOMB_RADIUS);
    expect(BLAST_RADIUS).toBeLessThan(STORM_ZONE_RADIUS);
    expect(Math.ceil(FUSE_TICKS / DROP_TICKS)).toBeLessThanOrEqual(2);
    expect(Object.keys(bomber.hooks)).toStrictEqual(['onTick']);
  });

  it('Spartan’s shield halves every hit, and its spear is lighter than the Storm’s strike', () => {
    // Half of every hit of any kind, the same rule for all (ADR 0047); one heavy throw a rhythm.
    expect(SHIELDED_SHARE).toBe(0.5);
    expect(SPEAR_DAMAGE).toBeLessThan(ZONE_DAMAGE);
    expect(Object.keys(spartan.hooks)).toStrictEqual(['onTick']);
  });

  it('Bloom regrows a little at a time: under a tenth of its health a second', () => {
    expect((HEAL_AMOUNT * TICK_RATE) / HEAL_EVERY_TICKS).toBeLessThan(bloom.maxHealth / 10);
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
      // Reflection of the hardest contact hit in the roster, a raging Berserker's and a fully grown
      // Titan's included.
      thorns: reflectFor(
        Math.max(
          ...BALLS.map((ball) => ball.contactDamage),
          berserker.contactDamage + RAGE_DAMAGE,
          titan.contactDamage * GROWN_HIT,
        ),
      ),
      venom: POISON_DAMAGE,
      // Its rage is contact damage, not an ability hit.
      berserker: 0,
      sniper: SHOT_DAMAGE,
      quake: SHOCKWAVE_DAMAGE,
      // Its pull only steers; its hits are contact hits.
      magnet: 0,
      // Its spectral hit, once per pass while phased.
      ghost: SPECTRAL_HIT,
      necromancer: MINION_DAMAGE,
      // A rewind heals nothing it didn't have; it is no hit.
      chrono: 0,
      titan: 0,
      inferno: BURN_DAMAGE,
      // One hit each way; each is its own hit.
      boomerang: BOOMERANG_DAMAGE,
      bomber: BLAST_DAMAGE,
      // One spear a rhythm; regrowth deals nothing.
      spartan: SPEAR_DAMAGE,
      bloom: 0,
      // A quarter of the healthiest ball's full health.
      hex: curseBurstFor(Math.max(...BALLS.map((ball) => ball.maxHealth))),
      spider: WEB_NIP,
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

  it('Brawler has the hardest plain bump and no ability', () => {
    // Only the plain bump: a raging Berserker and a grown Titan can hit harder (ADR 0045, group 4).
    for (const ball of others(brawler.id)) {
      expect(brawler.contactDamage).toBeGreaterThan(ball.contactDamage);
    }
    expect(Object.keys(brawler.hooks)).toStrictEqual([]);
    expect(brawler.initialAbilityState).toStrictEqual({});
  });

  it('Magnet hits harder than every ball but the Brawler: its pull forces a brawl it can win', () => {
    for (const ball of others(magnet.id).filter(({ id }) => id !== brawler.id)) {
      expect(magnet.contactDamage).toBeGreaterThan(ball.contactDamage);
    }
  });

  it('Ghost phases a quarter of the time, and its spectral hit is lighter than its bump', () => {
    // One rhythm, the same against any ball (ADR 0049): a second phased in every four.
    expect(PHASE_TICKS / PHASE_CYCLE_TICKS).toBe(0.25);
    expect(PHASE_TICKS).toBe(TICK_RATE);
    expect(ghost.phasedOf).toBeDefined();
    expect(SPECTRAL_HIT).toBeLessThan(ghost.contactDamage);
    expect(Object.keys(ghost.hooks).sort()).toStrictEqual(['onHitBall', 'onTick']);
  });

  it('Hex’s curse is a share of full health, never a Chrono-sized big hit on the Chrono', () => {
    // The burst scales with the ball it lands on and nothing else (ADR 0049).
    expect(CURSE_SHARE).toBe(0.25);
    expect(CURSE_FUSE_TICKS).toBe(3 * TICK_RATE);
    expect(curseBurstFor(chrono.maxHealth)).toBeLessThan(BIG_HIT);
    expect(Object.keys(hex.hooks).sort()).toStrictEqual(['onHitBall', 'onTick']);
  });

  it('Spider’s webs nip lightly and slow for seconds; it spins them only on walls', () => {
    expect(WEB_NIP).toBeLessThan(ARROW_DAMAGE);
    expect(WEB_SLOW_TICKS).toBeGreaterThanOrEqual(5 * TICK_RATE);
    expect(MOST_WEBS).toBeLessThanOrEqual(8);
    expect(Object.keys(spider.hooks).sort()).toStrictEqual(['onTick', 'onWallHit']);
  });

  it('Necromancer’s minions are small, few, and its only ability', () => {
    expect(MINION_RADIUS).toBeLessThan(necromancer.radius);
    expect(MAX_MINIONS).toBeGreaterThanOrEqual(1);
    expect(MAX_MINIONS).toBeLessThanOrEqual(3);
    expect(Object.keys(necromancer.hooks)).toStrictEqual(['onTick']);
  });
});
