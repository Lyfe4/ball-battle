import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { hasStatus } from '../status.ts';

/**
 * Extra contact damage at the edge of defeat: the bonus grows in step with the share of max health
 * the Berserker has lost. Its base contact damage plus this stays below the Brawler's, so the
 * Brawler still hits hardest (an identity rule).
 */
export const RAGE_DAMAGE = 8;

/** Share of the rage bonus poison takes away: poison numbs rage (ADR 0016). */
export const POISON_NUMB = 0.8;

/** Rage bonus for a ball on `health` of `maxHealth`: 0 at full health, RAGE_DAMAGE at 0. */
export function rageFor(health: number, maxHealth: number): number {
  const missing = Math.min(1, Math.max(0, 1 - health / maxHealth));
  return RAGE_DAMAGE * missing;
}

/**
 * The biggest health pool in the roster, and the more of it it has lost, the harder it hits:
 * its contact damage grows with its missing health (ADR 0015). Rage hits are contact hits, so
 * directness scales them, Thorns reflects them and the lethal-exchange tiebreak counts them.
 * Poison numbs the rage (Venom's edge), and the rage burns off the cold: it can't be slowed (its
 * edge over the Frost), ADR 0016.
 */
export const berserker = defineBall({
  id: 'berserker',
  name: 'Berserker',
  description: 'Huge health, hits harder the more it has lost, and can’t be slowed.',
  color: '#f97316',
  radius: STANDARD_BALL_RADIUS,
  speed: 780,
  maxHealth: 93,
  contactDamage: 16,
  initialAbilityState: {},
  statusResistance: { slowed: 0 },
  contactDamageOf: (self, stats) => {
    const rage = rageFor(self.health, stats.maxHealth);
    return stats.contactDamage + (hasStatus(self, 'poisoned') ? rage * (1 - POISON_NUMB) : rage);
  },
  hooks: {},
});
