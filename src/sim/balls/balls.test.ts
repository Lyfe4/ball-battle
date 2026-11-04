import { describe, expect, it } from 'vitest';
// Fast roster checks. The roster-wide tests that play whole matches (determinism, the measured
// pass-through margin, the identity rules) are in roster.slow.test.ts (pnpm test:slow).
import { DT } from '../constants.ts';
import type { BallDefinition } from '../types.ts';
import { createWorld } from '../world.ts';
import { archer } from './archer.ts';
import { berserker } from './berserker.ts';
import { brawler } from './brawler.ts';
import { frost } from './frost.ts';
import { quake } from './quake.ts';
import { sniper } from './sniper.ts';
import { BALLS } from './index.ts';
import { MAX_STACKS, speedForStacks, speedster } from './speedster.ts';
import { storm } from './storm.ts';
import { thorns } from './thorns.ts';
import { vampire } from './vampire.ts';
import { venom } from './venom.ts';

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
    };
    expect(Object.keys(topCruiseSpeed).sort()).toStrictEqual(BALLS.map((ball) => ball.id).sort());
    for (const [a, b] of matchups) {
      const closing = (topCruiseSpeed[a.id] ?? Infinity) + (topCruiseSpeed[b.id] ?? Infinity);
      expect(closing / ((a.radius + b.radius) / DT)).toBeLessThan(0.6);
    }
  });
});
