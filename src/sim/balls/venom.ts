import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { POISON_INTERVAL_TICKS } from '../status.ts';

/**
 * Every ball Venom touches is poisoned for this long: it takes POISON_DAMAGE of Venom's ability
 * damage every POISON_INTERVAL_TICKS (ADR 0012), three ticks in all (the status is removed at the
 * start of its expiry tick, hence the one extra tick). Refreshed, never stacked, by every new
 * contact, so a Venom that keeps touching its enemy keeps it poisoned.
 */
export const POISON_TICKS = 3 * POISON_INTERVAL_TICKS + 1;

/**
 * Light bumps that poison (ADR 0012, 0045). Most of its damage is a few small poison ticks after
 * each bump: too small for the Chrono to rewind and never touching the Thorns' spikes, while armor
 * takes a share off each one, a fade makes one miss and regrowth heals some back.
 */
export const venom = defineBall({
  id: 'venom',
  name: 'Venom',
  description: 'Bumps poison its enemy: a few small hits follow.',
  color: '#84cc16',
  ability: { name: 'Poison', shownBy: { kind: 'status', status: 'poisoned' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 780,
  maxHealth: 73,
  contactDamage: 8,
  initialAbilityState: {},
  hooks: {
    onHitBall: ({ other }) => [
      { kind: 'applyStatus', targetId: other.id, status: 'poisoned', durationTicks: POISON_TICKS },
    ],
  },
});
