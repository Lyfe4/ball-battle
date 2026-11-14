import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { secondsOf } from './how-it-works.ts';

/** A bump glitches the other ball for this long (4 s): its ability is off (glitch.ts). */
export const GLITCH_TICKS = 240;

/**
 * Glitches (proposal): its bump switches the other ball's ability off for GLITCH_TICKS. The
 * glitched ball keeps moving and bumping as a plain ball of its stats; its ability's timers pause
 * and pick up where they stopped. A new bump starts the glitch again; it never stacks. The same on
 * any ball: a ball with a big ability loses a lot, a plain one (the Brawler) nothing, and a
 * growing one (the Titan) only pauses, so it still gets big.
 */
export const glitch = defineBall({
  id: 'glitch',
  name: 'Glitch',
  description: 'Its bump switches the enemy’s ability off for 4 s.',
  color: '#94a3b8',
  ability: { name: 'Glitch', shownBy: { kind: 'status', status: 'glitched' } },
  howItWorks: [
    `Its bump switches the other ball’s ability off for ${secondsOf(GLITCH_TICKS)} s. That ball still moves and bumps, as a plain ball.`,
    'Its ability’s timers pause and pick up where they stopped. What it already sent out carries on.',
    'Each new bump starts the glitch again; it never stacks.',
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 770,
  maxHealth: 62,
  contactDamage: 24,
  initialAbilityState: {},
  hooks: {
    onHitBall: ({ other }) => [
      { kind: 'applyStatus', targetId: other.id, status: 'glitched', durationTicks: GLITCH_TICKS },
    ],
  },
});
