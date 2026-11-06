import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';

/** How much the Titan's radius grows each tick, in world units. */
export const GROWTH_PER_TICK = 0.06;
/** The largest it grows. */
export const MAX_RADIUS = 90;

/** The Titan's radius on `tick`: the standard size at the start, growing to MAX_RADIUS. */
export function titanRadius(tick: number): number {
  return Math.min(MAX_RADIUS, STANDARD_BALL_RADIUS + GROWTH_PER_TICK * tick);
}

/**
 * Grows bigger and heavier as the match goes on (ADR 0034): the one ball allowed a different size.
 * Its mass is r², so light, fast balls bounce off it while it barely turns; a bigger body is also
 * an easier target for arrows and shots.
 */
export const titan = defineBall({
  id: 'titan',
  name: 'Titan',
  description: 'Grows bigger and heavier as the match goes on.',
  color: '#86efac',
  radius: STANDARD_BALL_RADIUS,
  speed: 740,
  maxHealth: 85,
  contactDamage: 22,
  initialAbilityState: {},
  hooks: {},
  radiusOf: (_self, tick) => titanRadius(tick),
});
