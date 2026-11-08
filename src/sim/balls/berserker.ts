import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';

/**
 * Extra contact damage at the edge of defeat: the bonus grows in step with the share of max health
 * the Berserker has lost. Its base contact damage plus this stays below the Brawler's, so the
 * Brawler still hits hardest (an identity rule).
 */
export const RAGE_DAMAGE = 7;

/** Rage bonus for a ball on `health` of `maxHealth`: 0 at full health, RAGE_DAMAGE at 0. */
export function rageFor(health: number, maxHealth: number): number {
  const missing = Math.min(1, Math.max(0, 1 - health / maxHealth));
  return RAGE_DAMAGE * missing;
}

/**
 * The biggest health pool in the roster, and the more of it it has lost, the harder it hits:
 * its contact damage grows with its missing health (ADR 0015). Rage hits are contact hits, so
 * directness scales them, Thorns reflects them and the lethal-exchange tiebreak counts them.
 * Nothing numbs the rage any more (ADR 0045).
 */
export const berserker = defineBall({
  id: 'berserker',
  name: 'Berserker',
  description: 'Huge health; the more hurt it is, the harder it hits.',
  color: '#f97316',
  radius: STANDARD_BALL_RADIUS,
  speed: 780,
  maxHealth: 86,
  contactDamage: 18,
  initialAbilityState: {},
  contactDamageOf: (self, stats) => stats.contactDamage + rageFor(self.health, stats.maxHealth),
  hooks: {},
});
