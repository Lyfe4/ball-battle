import { defineBall } from '../define-ball.ts';

/** Fraction of the damage it deals that the Vampire heals. */
export const LIFESTEAL = 0.35;

/** Health healed for dealing `amount` damage. Rounded so health stays whole. */
export function lifestealFor(amount: number): number {
  return Math.round(amount * LIFESTEAL);
}

/** Heals itself for part of every hit it lands, never above its max health. */
export const vampire = defineBall({
  id: 'vampire',
  name: 'Vampire',
  description: 'Heals for 35% of the damage it deals.',
  color: '#a855f7',
  radius: 60,
  speed: 700,
  maxHealth: 57,
  contactDamage: 21,
  initialAbilityState: {},
  hooks: {
    onDamageDealt: ({ self, amount }) => {
      const heal = lifestealFor(amount);
      return heal > 0 ? [{ kind: 'heal', targetId: self.id, amount: heal }] : [];
    },
  },
});
