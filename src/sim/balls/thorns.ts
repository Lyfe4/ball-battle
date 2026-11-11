import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';

/** Share of the contact damage Thorns takes that it reflects back at the attacker. */
export const REFLECT_SHARE = 0.37;

/** Damage reflected for taking `amount` contact damage. Rounded so health stays whole. */
export function reflectFor(amount: number): number {
  return Math.round(amount * REFLECT_SHARE);
}

/**
 * Covered in spikes: every contact hit it takes bounces part of the damage back at the attacker,
 * as Thorns' ability damage (ADR 0012, 0013). Reflection scales with the hit, so the hardest
 * hitter hurts itself the most: Thorns is the Brawler's one counter. Arrows and lightning never
 * touch it, so they are never reflected. Reflected damage fires no further hooks, so two Thorns
 * can't loop.
 */
export const thorns = defineBall({
  id: 'thorns',
  name: 'Thorns',
  description: 'Spiked: every bump it takes hurts the attacker back.',
  color: '#16a34a',
  ability: { name: 'Spikes', shownBy: { kind: 'hookDamage', hook: 'onDamageTaken' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 730,
  maxHealth: 80,
  contactDamage: 18,
  initialAbilityState: {},
  hooks: {
    onDamageTaken: ({ attacker, amount, cause }) => {
      if (cause !== 'contact') return [];
      const reflected = reflectFor(amount);
      return reflected > 0 ? [{ kind: 'damage', targetId: attacker.id, amount: reflected }] : [];
    },
  },
});
