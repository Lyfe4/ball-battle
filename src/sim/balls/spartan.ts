import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { percentOf, secondsOf } from './how-it-works.ts';
import type { BallState } from '../types.ts';
import { nearestTarget } from './targeting.ts';

export type SpartanState = Readonly<{
  /** Where in its rhythm the match started it (0 to CYCLE_TICKS - 1); -1 until its first tick. */
  phase: number;
  /** Its shield is planted. */
  raised: boolean;
}>;

/** One rhythm: SHIELD_TICKS with the shield planted, then the spear and the rest in the open. */
export const CYCLE_TICKS = 250;
export const SHIELD_TICKS = 135;
/** Its speed while the shield is planted, as a share of its own (a bit under half). */
export const SHIELDED_SPEED = 0.42;
/** The share of a hit that lands while the shield is planted (rounded down). */
export const SHIELDED_SHARE = 0.5;
export const SPEAR_DAMAGE = 28;
export const SPEAR_SPEED = 1500;
export const SPEAR_RADIUS = 9;
export const SPEAR_LIFETIME_TICKS = 120;

/** Where in its rhythm a Spartan that started at `phase` is at `tick`. */
export function rhythmAt(tick: number, phase: number): number {
  return (tick + Math.max(0, phase)) % CYCLE_TICKS;
}

/** True while a Spartan that started its rhythm at `phase` has its shield planted at `tick`. */
export function shieldRaisedAt(tick: number, phase: number): boolean {
  return rhythmAt(tick, phase) < SHIELD_TICKS;
}

/** What a planted shield lets through of a hit of `amount`: half, rounded down. */
export function shieldedHit(amount: number): number {
  return Math.floor(amount * SHIELDED_SHARE);
}

/** Whether a Spartan's shield is planted, read from any ball state (undefined for other balls). */
export function spartanRaisedOf(ball: BallState): boolean | undefined {
  const raised = ball.abilityState['raised'];
  return typeof raised === 'boolean' && typeof ball.abilityState['phase'] === 'number'
    ? raised
    : undefined;
}

/**
 * Shield and spear: one steady rhythm of about 4 s. For the first part it plants its shield (half
 * speed, and every hit, of any kind, does half, rounded down), then lowers it, throws its spear
 * where the nearest enemy is (one heavy hit from afar, no lead) and fights in the open for the rest.
 * Each match starts the rhythm at a seeded random point, so it never runs in lock-step with another
 * ball's timer.
 */
export const spartan = defineBall<SpartanState>({
  id: 'spartan',
  name: 'Spartan',
  description: 'Plants its shield, then throws its spear.',
  color: '#dc2626',
  ability: { name: 'Shield and spear', shownBy: { kind: 'projectileFired' } },
  howItWorks: [
    `Its rhythm is ${secondsOf(CYCLE_TICKS)} s. For ${secondsOf(SHIELD_TICKS)} s its shield is planted: it moves at ${percentOf(SHIELDED_SPEED)} speed and every hit on it is cut to ${percentOf(SHIELDED_SHARE)}, rounded down.`,
    `Then it throws its spear where the nearest enemy is, for ${SPEAR_DAMAGE}, and fights in the open.`,
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 730,
  maxHealth: 45,
  contactDamage: 16,
  initialAbilityState: { phase: -1, raised: false },
  cruiseSpeed: (state, stats) => (state.raised ? stats.speed * SHIELDED_SPEED : stats.speed),
  incomingDamageOf: (self, amount, tick) =>
    shieldRaisedAt(tick, self.abilityState.phase) ? shieldedHit(amount) : amount,
  hooks: {
    onTick: ({ world, self, random }) => {
      const phase =
        self.abilityState.phase >= 0 ? self.abilityState.phase : Math.floor(random() * CYCLE_TICKS);
      const raised = shieldRaisedAt(world.tick, phase);
      const mark =
        raised === self.abilityState.raised && phase === self.abilityState.phase
          ? []
          : [{ kind: 'setAbilityState' as const, state: { phase, raised } }];
      if (rhythmAt(world.tick, phase) !== SHIELD_TICKS) return mark;
      const target = nearestTarget(self, world.balls, world.minions);
      if (target === undefined) return mark;
      const dx = target.position.x - self.position.x;
      const dy = target.position.y - self.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance === 0) return mark;
      return [
        ...mark,
        {
          kind: 'spawnProjectile',
          velocity: { x: (dx / distance) * SPEAR_SPEED, y: (dy / distance) * SPEAR_SPEED },
          radius: SPEAR_RADIUS,
          damage: SPEAR_DAMAGE,
          lifetimeTicks: SPEAR_LIFETIME_TICKS,
        },
      ];
    },
  },
});
