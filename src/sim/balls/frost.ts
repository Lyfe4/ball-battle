import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';

/**
 * Every ball Frost touches is slowed for this long: its cruise speed drops by SLOW_FACTOR
 * (ADR 0012). Refreshed, never stacked, by every new contact.
 */
export const SLOW_TICKS = 180;

/**
 * Slow and sturdy; every hit chills the target. Slowed balls cruise slower, which cuts both of the
 * Speedster's weapons: its speed and the wall bounces that build its stacks.
 */
export const frost = defineBall({
  id: 'frost',
  name: 'Frost',
  description: 'Slow and sturdy. Every hit slows its enemy for 3 s.',
  color: '#bae6fd',
  ability: { name: 'Slow', shownBy: { kind: 'status', status: 'slowed' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 720,
  maxHealth: 80,
  contactDamage: 22,
  initialAbilityState: {},
  hooks: {
    onHitBall: ({ other }) => [
      { kind: 'applyStatus', targetId: other.id, status: 'slowed', durationTicks: SLOW_TICKS },
    ],
  },
});
