import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';

/** Fraction of the damage it deals that the Vampire heals. */
export const LIFESTEAL = 0.5;

/** Health healed for dealing `amount` damage. Rounded so health stays whole. */
export function lifestealFor(amount: number): number {
  return Math.round(amount * LIFESTEAL);
}

/**
 * Heals itself for half of the damage its bumps deal, never above its max health. Only bumps: it
 * drinks nothing from a ball it never touches (ADR 0045).
 */
export const vampire = defineBall({
  id: 'vampire',
  name: 'Vampire',
  description: 'Heals half of the damage its bumps deal.',
  color: '#a855f7',
  ability: { name: 'Lifesteal', shownBy: { kind: 'healed' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 750,
  maxHealth: 54,
  contactDamage: 22,
  initialAbilityState: {},
  hooks: {
    onDamageDealt: ({ self, amount, cause }) => {
      if (cause !== 'contact') return [];
      const heal = lifestealFor(amount);
      return heal > 0 ? [{ kind: 'heal', targetId: self.id, amount: heal }] : [];
    },
  },
});
