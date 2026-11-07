import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState } from '../types.ts';

export type SpeedsterState = Readonly<{ stacks: number }>;

/** Most stacks the Speedster can hold. */
export const MAX_STACKS = 5;
/** Extra speed per stack, as a fraction of base speed. */
export const SPEED_PER_STACK = 0.1;
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

/**
 * Every wall bounce adds a stack (a corner is two), up to MAX_STACKS. Hitting a ball cashes the
 * stacks in as bonus damage and resets them. Its speed follows its stacks through `cruiseSpeed`
 * (ADR 0008): the hooks only change stacks, so nothing can compound the speed past the cap.
 */
export const speedster = defineBall<SpeedsterState>({
  id: 'speedster',
  name: 'Speedster',
  description: 'Wall bounces build speed and damage for its next hit.',
  color: '#facc15',
  ability: { name: 'Speed hit', shownBy: { kind: 'hookDamage', hook: 'onHitBall' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 800,
  maxHealth: 70,
  contactDamage: 14,
  initialAbilityState: { stacks: 0 },
  cruiseSpeed: (state, stats) => speedForStacks(stats.speed, state.stacks),
  hooks: {
    onWallHit: ({ self, bounces }) => {
      const stacks = Math.min(MAX_STACKS, self.abilityState.stacks + bounces);
      if (stacks === self.abilityState.stacks) return [];
      return [{ kind: 'setAbilityState', state: { stacks } }];
    },
    onHitBall: ({ self, other }) => {
      const { stacks } = self.abilityState;
      if (stacks === 0) return [];
      return [
        { kind: 'damage', targetId: other.id, amount: stacks * DAMAGE_PER_STACK },
        { kind: 'setAbilityState', state: { stacks: 0 } },
      ];
    },
  },
});
