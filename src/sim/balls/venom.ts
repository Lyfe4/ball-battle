import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';

/**
 * Every ball Venom touches is poisoned for this long: it takes POISON_DAMAGE of Venom's ability
 * damage every POISON_INTERVAL_TICKS (ADR 0012), eight ticks in all. Refreshed, never stacked, by
 * every new contact, so a Venom that keeps touching its enemy keeps it poisoned.
 */
export const POISON_TICKS = 270;

/**
 * Light contact hits that poison. Most of its damage is the poison, which keeps working between
 * contacts and never touches Thorns' spikes, so reflection has little to answer (ADR 0014). A
 * Vampire heals the poison back off every trade.
 */
export const venom = defineBall({
  id: 'venom',
  name: 'Venom',
  description: 'Light hits poison for 4.5 s: it chips away between hits.',
  color: '#84cc16',
  ability: { name: 'Poison', shownBy: { kind: 'status', status: 'poisoned' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 780,
  maxHealth: 76,
  contactDamage: 8,
  initialAbilityState: {},
  hooks: {
    onHitBall: ({ other }) => [
      { kind: 'applyStatus', targetId: other.id, status: 'poisoned', durationTicks: POISON_TICKS },
    ],
  },
});
