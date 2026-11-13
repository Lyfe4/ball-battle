import { STANDARD_BALL_RADIUS, TICK_RATE } from '../constants.ts';
import { defineBall } from '../define-ball.ts';

export type GhostState = Readonly<{
  /** Where in its rhythm this match started it (seeded on its first tick); -1 before that. */
  phase: number;
  /** Phased on this tick (set by its own onTick, read by `phasedOf`). */
  phased: boolean;
}>;

/** Its rhythm: phased for PHASE_TICKS out of every PHASE_CYCLE_TICKS (1 s of every 4 s). */
export const PHASE_CYCLE_TICKS = 240;
export const PHASE_TICKS = 60;
/** Passing through a ball while phased hits it for this much, once per pass. */
export const SPECTRAL_HIT = 12;

/** True when a Ghost whose rhythm started at `phase` is phased on `tick`. */
export function phasedAt(tick: number, phase: number): boolean {
  return phase >= 0 && (tick + phase) % PHASE_CYCLE_TICKS < PHASE_TICKS;
}

/**
 * Phases (ADR 0049): for PHASE_TICKS of every PHASE_CYCLE_TICKS, from a seeded point in its rhythm,
 * nothing touches it. It passes through balls, shots, skulls and bombs, and no hit of any kind
 * lands (`incomingDamageOf`). Passing through a ball while phased deals its spectral hit, once per
 * pass. One rule, the same against any ball: a phased ball can still be aimed at and pulled, so
 * an aimed shot just flies through it.
 */
export const ghost = defineBall<GhostState>({
  id: 'ghost',
  name: 'Ghost',
  description: 'Phases every few seconds: slips through everything and hits as it passes.',
  color: '#c4b5fd',
  ability: { name: 'Phase', shownBy: { kind: 'hookDamage', hook: 'onHitBall' } },
  howItWorks: [
    `It is phased for ${String(PHASE_TICKS / TICK_RATE)} s of every ${String(PHASE_CYCLE_TICKS / TICK_RATE)} s. Then nothing touches it: balls, shots, skulls and bombs pass through, and no hit lands.`,
    `Passing through a ball while phased hits it for ${String(SPECTRAL_HIT)}, once per pass.`,
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 770,
  maxHealth: 65,
  contactDamage: 22,
  initialAbilityState: { phase: -1, phased: false },
  phasedOf: (self) => self.abilityState.phased,
  incomingDamageOf: (self, amount, tick) => (phasedAt(tick, self.abilityState.phase) ? 0 : amount),
  hooks: {
    onTick: ({ world, self, random }) => {
      const phase =
        self.abilityState.phase >= 0
          ? self.abilityState.phase
          : Math.floor(random() * PHASE_CYCLE_TICKS);
      const phased = phasedAt(world.tick, phase);
      return phased === self.abilityState.phased && phase === self.abilityState.phase
        ? []
        : [{ kind: 'setAbilityState', state: { phase, phased } }];
    },
    // The spectral hit: passing through a ball while phased hurts it, once per pass.
    onHitBall: ({ self, other }) =>
      self.abilityState.phased
        ? [{ kind: 'damage', targetId: other.id, amount: SPECTRAL_HIT }]
        : [],
  },
});
