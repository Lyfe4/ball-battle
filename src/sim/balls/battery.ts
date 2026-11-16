import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { percentOf } from './how-it-works.ts';
import type { DamageVia } from '../types.ts';

export type BatteryState = Readonly<{
  /** Damage it has stored, released on its next bump. */
  stored: number;
}>;

/** A strike, blast or burst of at least this much is a big hit it can store part of. */
export const BIG_HIT = 15;
/** Share of a big hit it stores instead of taking. */
export const STORE_SHARE = 0.33;
/** Most it can store at once. */
export const CAPACITY = 40;

/** True for the hits it stores part of: big strikes and blasts (zones) and bursts (onTick). */
export function storesHit(via: DamageVia | 'contact', amount: number): boolean {
  return amount >= BIG_HIT && (via === 'zone' || via === 'onTick');
}

/**
 * Stores part of every big strike, blast or burst that hits it, and its next bump lets it all out
 * as extra contact damage (ADR 0056; hitting harder is contactDamageOf, ADR 0015). Bumps, shots,
 * arrows, burns and poison are never stored. Its defence reads what dealt the hit (`via`).
 */
export const battery = defineBall<BatteryState>({
  id: 'battery',
  name: 'Battery',
  description: 'Stores big strikes and blasts; its next bump lets them out.',
  color: '#2563eb',
  ability: { name: 'Store', shownBy: { kind: 'hitReduced' } },
  howItWorks: [
    `A strike, blast or burst of ${BIG_HIT} or more lands at ${percentOf(1 - STORE_SHARE)}: it stores the rest, up to ${CAPACITY}.`,
    'Its next bump adds everything stored. Bumps and shots are never stored.',
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 870,
  maxHealth: 70,
  contactDamage: 23.5,
  initialAbilityState: { stored: 0 },
  incomingDamageOf: (_self, amount, _tick, via) =>
    storesHit(via, amount) ? Math.ceil(amount * (1 - STORE_SHARE)) : amount,
  contactDamageOf: (self, stats) => stats.contactDamage + self.abilityState.stored,
  hooks: {
    onHitBall: ({ self }) =>
      self.abilityState.stored === 0 ? [] : [{ kind: 'setAbilityState', state: { stored: 0 } }],
    onDamageTaken: ({ self, reduced }) =>
      reduced <= 0
        ? []
        : [
            {
              kind: 'setAbilityState',
              state: { stored: Math.min(CAPACITY, self.abilityState.stored + reduced) },
            },
          ],
  },
});
