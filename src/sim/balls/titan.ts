import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';

/** How much the Titan's radius grows each tick, in world units. */
export const GROWTH_PER_TICK = 0.06;
/** The largest it grows. */
export const MAX_RADIUS = 90;
/** How many times its base contact damage it hits for at MAX_RADIUS, rising in step with its size. */
export const GROWN_HIT = 1.85;

/** The Titan's radius on `tick`: the standard size at the start, growing to MAX_RADIUS. */
export function titanRadius(tick: number): number {
  return Math.min(MAX_RADIUS, STANDARD_BALL_RADIUS + GROWTH_PER_TICK * tick);
}

/**
 * Grows bigger and heavier as the match goes on (ADR 0034): the one ball allowed a different size.
 * Its mass is r², so light, fast balls bounce off it while it barely turns; a bigger body is also
 * an easier target for arrows, shots and fire. Its bumps grow with it (ADR 0045, group 4): weak
 * early, crushing late.
 */
export const titan = defineBall({
  id: 'titan',
  name: 'Titan',
  description: 'Grows as the match goes on, and its bumps grow with it.',
  color: '#86efac',
  radius: STANDARD_BALL_RADIUS,
  speed: 740,
  maxHealth: 77,
  contactDamage: 14.5,
  initialAbilityState: {},
  contactDamageOf: (self, stats) =>
    stats.contactDamage *
    (1 +
      ((GROWN_HIT - 1) * (self.radius - STANDARD_BALL_RADIUS)) /
        (MAX_RADIUS - STANDARD_BALL_RADIUS)),
  hooks: {},
  radiusOf: (_self, tick) => titanRadius(tick),
});
