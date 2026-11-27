import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { sideOf } from '../side.ts';
import type { AbilityAction, BallState } from '../types.ts';
import { secondsOf } from './how-it-works.ts';

/** Its aura burns on this beat, every enemy in reach at once. */
export const BURN_EVERY_TICKS = 15;
/** Ability damage each burn deals to every enemy ball in reach. */
export const BURN_DAMAGE = 3;
/** How far the aura reaches past its edge at full health, to the burned ball's edge. */
export const BASE_REACH = 70;
/** How far it reaches at its widest, from a quarter health down. */
export const FULL_REACH = 220;
/** The share of its health lost when the aura is at its widest: below a quarter left. */
export const FULL_AT_LOST = 0.75;

const MAX_HEALTH = 66;

/** How hurt it is, 0 (full health) to 1 (a quarter health or less): how big its fire has grown. */
export function heatOf(health: number, maxHealth: number): number {
  const lost = (maxHealth - health) / maxHealth;
  return Math.max(0, Math.min(1, lost / FULL_AT_LOST));
}

/** The aura's reach past its edge for a ball at this health. */
export function reachOf(health: number, maxHealth: number): number {
  return BASE_REACH + (FULL_REACH - BASE_REACH) * heatOf(health, maxHealth);
}

/** True when `ball` (an enemy) is inside the aura of a Phoenix at `self`. */
function inAura(self: BallState, ball: BallState, reach: number): boolean {
  const dx = ball.position.x - self.position.x;
  const dy = ball.position.y - self.position.y;
  const within = self.radius + reach + ball.radius;
  return dx * dx + dy * dy <= within * within;
}

/**
 * Burns brighter as it is hurt (prototype): a heat aura burns every enemy ball near it on a fixed
 * beat, and the aura's reach grows with the health it has lost, from just past its edge at full
 * health to a third of the court once it is down to a quarter. The burn is small and blockable;
 * what grows is how far it reaches, so a hurt Phoenix sets everything near it on fire.
 */
export const phoenix = defineBall({
  id: 'phoenix',
  name: 'Phoenix',
  description: 'Its fire spreads as it is hurt; below a quarter, everything near it burns.',
  color: '#f59e0b',
  ability: { name: 'Rising fire', shownBy: { kind: 'hookDamage', hook: 'onTick' }, tipOn: 'self' },
  howItWorks: [
    `Every ${secondsOf(BURN_EVERY_TICKS)} s its fire burns every enemy in reach for ${BURN_DAMAGE}.`,
    `The fire reaches ${BASE_REACH} past it at full health, growing as it is hurt to ${FULL_REACH} below a quarter.`,
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: MAX_HEALTH,
  contactDamage: 10,
  initialAbilityState: {},
  hooks: {
    onTick: ({ world, self }) => {
      if (world.tick % BURN_EVERY_TICKS !== 0) return [];
      const reach = reachOf(self.health, MAX_HEALTH);
      const actions: AbilityAction[] = [];
      for (const ball of world.balls) {
        if (sideOf(ball) === sideOf(self) || ball.health <= 0) continue;
        if (inAura(self, ball, reach)) {
          actions.push({ kind: 'damage', targetId: ball.id, amount: BURN_DAMAGE });
        }
      }
      return actions;
    },
  },
});
