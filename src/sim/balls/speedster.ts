import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState, Vec2 } from '../types.ts';
import { scale } from '../vec2.ts';

export type SpeedsterState = Readonly<{ stacks: number }>;

/** Most stacks the Speedster can hold. */
export const MAX_STACKS = 5;
/** Extra speed per stack, as a fraction of base speed. */
export const SPEED_PER_STACK = 0.08;
/** Extra damage per stack, dealt on top of the contact hit when it hits a ball. */
export const DAMAGE_PER_STACK = 2;

/** Speed the Speedster travels at with `stacks` stacks. */
export function speedForStacks(baseSpeed: number, stacks: number): number {
  return baseSpeed * (1 + SPEED_PER_STACK * stacks);
}

/** The Speedster's current stacks, read from any ball state (0 for other balls). */
export function stacksOf(ball: BallState): number {
  const stacks = ball.abilityState['stacks'];
  return typeof stacks === 'number' ? stacks : 0;
}

/** Same direction, new speed. A stationary ball stays stationary. */
function withSpeed(velocity: Vec2, speed: number): Vec2 {
  const length = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  return length === 0 ? velocity : scale(velocity, speed / length);
}

/**
 * Every wall bounce adds a stack (a corner is two), up to MAX_STACKS, and sets its speed for that
 * many stacks. Hitting a ball cashes the stacks in as bonus damage, then resets stacks and speed.
 * The speed is set rather than multiplied, so collisions can never compound it past the cap.
 */
export const speedster = defineBall<SpeedsterState>({
  id: 'speedster',
  name: 'Speedster',
  description: 'Gains speed and damage off every wall bounce, then cashes it in on a hit.',
  color: '#facc15',
  radius: STANDARD_BALL_RADIUS,
  speed: 800,
  maxHealth: 70,
  contactDamage: 14,
  initialAbilityState: { stacks: 0 },
  hooks: {
    onWallHit: ({ self, stats, bounces }) => {
      const stacks = Math.min(MAX_STACKS, self.abilityState.stacks + bounces);
      if (stacks === self.abilityState.stacks) return [];
      return [
        { kind: 'setAbilityState', state: { stacks } },
        {
          kind: 'setVelocity',
          velocity: withSpeed(self.velocity, speedForStacks(stats.speed, stacks)),
        },
      ];
    },
    onHitBall: ({ self, stats, other }) => {
      const { stacks } = self.abilityState;
      if (stacks === 0) return [];
      return [
        { kind: 'damage', targetId: other.id, amount: stacks * DAMAGE_PER_STACK },
        { kind: 'setAbilityState', state: { stacks: 0 } },
        { kind: 'setVelocity', velocity: withSpeed(self.velocity, stats.speed) },
      ];
    },
  },
});
