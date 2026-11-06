import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState } from '../types.ts';

export type GhostState = Readonly<{
  /** True while phased: it passes through balls and contact damage can't touch it either way. */
  phased: boolean;
  /** The tick it next phases in or out. */
  nextChangeTick: number;
}>;

/** The first phase starts on this tick. */
export const FIRST_PHASE_TICK = 90;
/** How long it stays phased. */
export const PHASE_TICKS = 60;
/** How long it stays solid between phases. */
export const SOLID_TICKS = 180;
/** Ability damage of passing through an enemy while phased: weaker than a contact hit. */
export const SPECTRAL_DAMAGE = 10;

/** True while a Ghost is phased, read from any ball state (false for other balls). */
export function isGhostPhased(ball: BallState): boolean {
  return ball.abilityState['phased'] === true;
}

/**
 * Phases out for PHASE_TICKS of every PHASE_TICKS + SOLID_TICKS (ADR 0026). A phased ball can't be
 * touched, gripped or aimed at (ADR 0028): it passes through balls (no contact damage either way
 * and no on-touch effects for the other ball) and through skulls, the Magnet's pull slips, and an
 * aimed attack waits for it to turn solid. Its own pass through an enemy deals a weaker spectral hit
 * (ability damage). What is already on its way still hits it: arrows and shots in flight,
 * lightning and shockwaves already called, and poison.
 */
export const ghost = defineBall<GhostState>({
  id: 'ghost',
  name: 'Ghost',
  description:
    'Phases out every few seconds: hits, pulls and skulls pass through it, and nothing can aim at it.',
  color: '#c4b5fd',
  ability: { name: 'Spectral hit', shownBy: { kind: 'hookDamage', hook: 'onHitBall' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 770,
  maxHealth: 77,
  contactDamage: 20,
  initialAbilityState: { phased: false, nextChangeTick: FIRST_PHASE_TICK },
  phasedOf: (self) => self.abilityState.phased,
  hooks: {
    onTick: ({ world, self }) => {
      const { phased, nextChangeTick } = self.abilityState;
      if (world.tick < nextChangeTick) return [];
      return [
        {
          kind: 'setAbilityState',
          state: {
            phased: !phased,
            nextChangeTick: world.tick + (phased ? SOLID_TICKS : PHASE_TICKS),
          },
        },
      ];
    },
    onHitBall: ({ self, other }) =>
      self.abilityState.phased
        ? [{ kind: 'damage', targetId: other.id, amount: SPECTRAL_DAMAGE }]
        : [],
  },
});
