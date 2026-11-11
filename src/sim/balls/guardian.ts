import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';

/** How much armor takes off every hit. */
export const ARMOR = 3;

/**
 * What armor leaves of a hit of `amount`: ARMOR less, but never less than half of it (rounded up),
 * so a tiny hit still does something. A big hit loses only a little; a small one loses a big share.
 */
export function armoredHit(amount: number): number {
  return Math.max(amount - ARMOR, Math.ceil(amount / 2));
}

/**
 * Armor (ADR 0045): every hit it takes, of any kind, does a bit less (`armoredHit`). The same few
 * points off a big hit are a small share of it and most of a small one, so it beats balls that deal
 * their damage in many small hits (poison ticks, burns) and shrugs little off a heavy blow.
 */
export const guardian = defineBall({
  id: 'guardian',
  name: 'Guardian',
  description: 'Every hit it takes does a bit less.',
  color: '#fef3c7',
  ability: { name: 'Armor', shownBy: { kind: 'hitReduced' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 59,
  contactDamage: 22,
  initialAbilityState: {},
  incomingDamageOf: (_self, amount) => armoredHit(amount),
  hooks: {},
});
