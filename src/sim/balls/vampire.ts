import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';

/** Fraction of the damage it deals that the Vampire heals. */
export const LIFESTEAL = 0.4;

/** Health healed for dealing `amount` damage. Rounded so health stays whole. */
export function lifestealFor(amount: number): number {
  return Math.round(amount * LIFESTEAL);
}

/** Heals itself for part of every hit it lands, never above its max health. */
export const vampire = defineBall({
  id: 'vampire',
  name: 'Vampire',
  description: 'Heals for 40% of the damage it deals.',
  color: '#a855f7',
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 60,
  contactDamage: 22,
  initialAbilityState: {},
  hooks: {
    onDamageDealt: ({ self, amount }) => {
      const heal = lifestealFor(amount);
      return heal > 0 ? [{ kind: 'heal', targetId: self.id, amount: heal }] : [];
    },
  },
});
