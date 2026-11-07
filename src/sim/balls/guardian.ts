import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { isShielded, SHIELD_TICKS } from '../shield.ts';
import type { BallState } from '../types.ts';

export type GuardianState = Readonly<{
  /** The shield grows back on this tick; null while it is up (or has just broken). */
  regrowTick: number | null;
}>;

/** Ticks from a shield breaking to the next one growing back (7.5 s). */
export const REGROW_TICKS = 450;

/** The tick a Guardian's shield grows back, read from any ball state (undefined if none is due). */
export function regrowTickOf(ball: BallState): number | undefined {
  const regrow = ball.abilityState['regrowTick'];
  return typeof regrow === 'number' ? regrow : undefined;
}

/**
 * Starts the match behind a shield (ADR 0043): a `shielded` status that blocks the next hit on it
 * completely, of any kind, and breaks. REGROW_TICKS after it breaks, a new one grows. One big hit
 * is wasted on it; many small ones (a stacked rush's second hit, poison ticks, skulls) strip it and
 * the rest land.
 */
export const guardian = defineBall<GuardianState>({
  id: 'guardian',
  name: 'Guardian',
  description: 'A shield soaks up to 10 of the next hit, then regrows in 7.5 s.',
  color: '#fef3c7',
  ability: { name: 'Shield', shownBy: { kind: 'shieldBroken' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 63,
  contactDamage: 21,
  initialAbilityState: { regrowTick: 1 },
  hooks: {
    onTick: ({ world, self }) => {
      if (isShielded(self)) return [];
      const { regrowTick } = self.abilityState;
      // It broke since the last tick: the next one grows REGROW_TICKS from now.
      if (regrowTick === null) {
        return [{ kind: 'setAbilityState', state: { regrowTick: world.tick + REGROW_TICKS } }];
      }
      if (world.tick < regrowTick) return [];
      return [
        { kind: 'applyStatus', targetId: self.id, status: 'shielded', durationTicks: SHIELD_TICKS },
        { kind: 'setAbilityState', state: { regrowTick: null } },
      ];
    },
  },
});
