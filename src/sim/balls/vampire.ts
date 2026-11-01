import { defineBall } from '../define-ball.ts';

/** Fraction of the damage it deals that the Vampire heals. */
export const LIFESTEAL = 0.5;

/** Health healed for dealing `amount` damage. Rounded so health stays whole. */
export function lifestealFor(amount: number): number {
  return Math.round(amount * LIFESTEAL);
}

/** Heals itself for part of every hit it lands, never above its max health. */
export const vampire = defineBall({
  id: 'vampire',
  name: 'Vampire',
  description: 'Heals for half the damage it deals.',
  color: '#a855f7',
  radius: 58,
  speed: 600,
  maxHealth: 80,
  contactDamage: 14,
  initialAbilityState: {},
  hooks: {
    onDamageDealt: ({ self, amount }) => {
      const heal = lifestealFor(amount);
      return heal > 0 ? [{ kind: 'heal', targetId: self.id, amount: heal }] : [];
    },
  },
});
