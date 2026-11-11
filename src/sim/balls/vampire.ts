import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';

/** Fraction of the damage it deals that the Vampire heals. */
export const LIFESTEAL = 0.9;

/** Health healed for dealing `amount` damage. Rounded so health stays whole. */
export function lifestealFor(amount: number): number {
  return Math.round(amount * LIFESTEAL);
}

/**
 * Heals itself for most of the damage its bumps deal, never above its max health, on little health
 * of its own: a glass cannon that beats bumpers. Only bumps: it drinks nothing from a ball it never
 * touches, so shooters beat it (ADR 0045).
 */
export const vampire = defineBall({
  id: 'vampire',
  name: 'Vampire',
  description: 'Heals most of what its bumps deal, on little health.',
  color: '#a855f7',
  ability: { name: 'Lifesteal', shownBy: { kind: 'healed' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 750,
  maxHealth: 39,
  contactDamage: 23,
  initialAbilityState: {},
  hooks: {
    onDamageDealt: ({ self, amount, cause }) => {
      if (cause !== 'contact') return [];
      const heal = lifestealFor(amount);
      return heal > 0 ? [{ kind: 'heal', targetId: self.id, amount: heal }] : [];
    },
  },
});
