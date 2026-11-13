import { describe, expect, it } from 'vitest';
// Fast roster checks. The roster-wide tests that play whole matches (determinism, the measured
// pass-through margin, the measured identity rules) are in the *.slow.test.ts files beside it
// (pnpm test:slow).
import { DT } from '../constants.ts';
import type { BallDefinition } from '../types.ts';
import { createWorld } from '../world.ts';
import { archer } from './archer.ts';
import { berserker } from './berserker.ts';
import { brawler } from './brawler.ts';
import { ghost } from './ghost.ts';
import { magnet } from './magnet.ts';
import { necromancer } from './necromancer.ts';
import { chrono } from './chrono.ts';
import { inferno } from './inferno.ts';
import { titan } from './titan.ts';
import { frost } from './frost.ts';
import { quake } from './quake.ts';
import { sniper } from './sniper.ts';
import { BALLS } from './index.ts';
import { MAX_STACKS, speedForStacks, speedster } from './speedster.ts';
import { storm } from './storm.ts';
import { thorns } from './thorns.ts';
import { vampire } from './vampire.ts';
import { venom } from './venom.ts';
import { BOMB_RADIUS, bomber } from './bomber.ts';
import { bloom } from './bloom.ts';
import { boomerang } from './boomerang.ts';
import { spartan } from './spartan.ts';
import { hex } from './hex.ts';
import { spider } from './spider.ts';

const matchups: (readonly [BallDefinition, BallDefinition])[] = BALLS.flatMap((a) =>
  BALLS.map((b) => [a, b] as const),
);

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

  it('keeps the fastest possible closing speed under the pass-through margin, by construction', () => {
    // ADR 0008: every ball cruises at a fixed speed, so two balls can close at most as fast as the
    // sum of their highest cruise speeds. Listed per ball, so a speed buff fails here at once.
    const topCruiseSpeed: Readonly<Record<string, number>> = {
      brawler: brawler.speed,
      speedster: speedForStacks(speedster.speed, MAX_STACKS),
      vampire: vampire.speed,
      archer: archer.speed,
      storm: storm.speed,
      // Slowed only ever lowers a ball's speed.
      frost: frost.speed,
      thorns: thorns.speed,
      venom: venom.speed,
      berserker: berserker.speed,
      sniper: sniper.speed,
      quake: quake.speed,
      // The pull only steers the enemy; it never changes either ball's speed (ADR 0026).
      magnet: magnet.speed,
      // Phasing passes through, it never changes speed (ADR 0049).
      ghost: ghost.speed,
      necromancer: necromancer.speed,
      // A rewind puts back a velocity it once had at its own cruise speed (ADR 0034).
      chrono: chrono.speed,
      // It grows, which only widens the detection limit; its speed never changes.
      titan: titan.speed,
      inferno: inferno.speed,
      // Its boomerang is a projectile, swept like an arrow (ADR 0005, 0043); the ball keeps its speed.
      boomerang: boomerang.speed,
      bomber: bomber.speed,
      // Its planted shield only slows it; its spear is a projectile, swept (ADR 0005).
      spartan: spartan.speed,
      bloom: bloom.speed,
      hex: hex.speed,
      // A web slows the ball it catches; it never speeds anyone up (ADR 0049).
      spider: spider.speed,
    };
    expect(Object.keys(topCruiseSpeed).sort()).toStrictEqual(BALLS.map((ball) => ball.id).sort());
    for (const [a, b] of matchups) {
      const closing = (topCruiseSpeed[a.id] ?? Infinity) + (topCruiseSpeed[b.id] ?? Infinity);
      expect(closing / ((a.radius + b.radius) / DT)).toBeLessThan(0.6);
    }
  });

  it('would catch the fastest ball on a bomb by the plain overlap test too, though it is swept', () => {
    // A bomb is set off by a swept touch (ADR 0043), so no speed can skip it. Even unswept, the
    // fastest ball moves less per tick than 0.6 of the reach of a bomb's body and a ball.
    const fastest = Math.max(
      ...BALLS.map((ball) =>
        ball.id === speedster.id ? speedForStacks(speedster.speed, MAX_STACKS) : ball.speed,
      ),
    );
    for (const ball of BALLS) {
      expect(fastest * DT).toBeLessThan(0.6 * (BOMB_RADIUS + ball.radius));
    }
  });
});
