import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState, Vec2 } from '../types.ts';

export type NecromancerState = Readonly<{ nextSummonTick: number }>;

/** The first minion comes on this tick. */
export const FIRST_SUMMON_TICK = 45;
/** Ticks between summons. */
export const SUMMON_TICKS = 88;
/** Most minions it has in play at once; a summon over the cap waits for the next one. */
export const MAX_MINIONS = 1;
/** World units per second: steady, below every ball's speed. */
export const MINION_SPEED = 640;
/** World units. Sized to read as a skull at phone size (ADR 0026). */
export const MINION_RADIUS = 26;
/** Ability damage when a minion pops on an enemy ball. */
export const MINION_DAMAGE = 13;
/** Ticks before a minion that never found an enemy crumbles (10 s). */
export const MINION_LIFETIME_TICKS = 600;

/** The Necromancer's next summon tick, read from any ball state (undefined for other balls). */
export function nextSummonTickOf(ball: BallState): number | undefined {
  const next = ball.abilityState['nextSummonTick'];
  return typeof next === 'number' ? next : undefined;
}

/**
 * A uniformly random unit direction from `random`, by rejection sampling inside the unit circle
 * (no trig, ADR 0001). Each try is accepted with probability about π/4.
 */
export function randomDirection(random: () => number): Vec2 {
  for (;;) {
    const x = random() * 2 - 1;
    const y = random() * 2 - 1;
    const lengthSquared = x * x + y * y;
    if (lengthSquared > 1e-6 && lengthSquared <= 1) {
      const length = Math.sqrt(lengthSquared);
      return { x: x / length, y: y / length };
    }
  }
}

/**
 * Every SUMMON_TICKS it raises a minion (ADR 0026): a small skeleton ball launched in a random
 * direction at a steady speed, bouncing off the walls like a ball, that pops on the first enemy
 * ball it reaches. At most MAX_MINIONS at once. Minions draw aimed attacks when they are nearer
 * than the Necromancer, and an area strike clears every minion inside it.
 */
export const necromancer = defineBall<NecromancerState>({
  id: 'necromancer',
  name: 'Necromancer',
  description: 'Raises skeleton minions that pop on its enemy.',
  color: '#4d7c0f',
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 66,
  contactDamage: 14,
  initialAbilityState: { nextSummonTick: FIRST_SUMMON_TICK },
  hooks: {
    onTick: ({ world, self, random }) => {
      if (world.tick < self.abilityState.nextSummonTick) return [];
      const direction = randomDirection(random);
      return [
        {
          kind: 'spawnMinion',
          velocity: { x: direction.x * MINION_SPEED, y: direction.y * MINION_SPEED },
          radius: MINION_RADIUS,
          damage: MINION_DAMAGE,
          lifetimeTicks: MINION_LIFETIME_TICKS,
          maxAlive: MAX_MINIONS,
        },
        { kind: 'setAbilityState', state: { nextSummonTick: world.tick + SUMMON_TICKS } },
      ];
    },
  },
});
