import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { heldAim } from '../rules.ts';
import { hasStatus } from '../status.ts';
import type { BallState } from '../types.ts';
import { nearestTarget } from './targeting.ts';

/** A charge in progress: the shot fires on `fireTick`, along the unit vector `aim`. */
export type SniperCharge = Readonly<{ fireTick: number; aim: Readonly<{ x: number; y: number }> }>;

export type SniperState = Readonly<{
  /** The next charge starts on this tick (while no charge is in progress). */
  nextChargeTick: number;
  charge: SniperCharge | null;
}>;

/** The first charge starts on this tick, so a match doesn't open with a shot. */
export const FIRST_CHARGE_TICK = 60;
/** Ticks from one shot to the start of the next charge. */
export const COOLDOWN_TICKS = 105;
/** Ticks the aim stays locked, with the laser showing, before the shot (0.3 s). */
export const CHARGE_TICKS = 18;
/** World units per second: fast, so the line is what decides a hit, not the flight time. */
export const SHOT_SPEED = 2400;
export const SHOT_RADIUS = 6;
/** Below the Storm's zone damage, which stays the biggest single ability hit (identity rule). */
export const SHOT_DAMAGE = 27;
/** Long enough to cross the arena; a wall normally ends the shot much sooner. */
export const SHOT_LIFETIME_TICKS = 60;

/** The Sniper's charge in progress, read from any ball state (undefined if there is none). */
export function chargeOf(ball: BallState): SniperCharge | undefined {
  const charge = ball.abilityState['charge'];
  if (typeof charge !== 'object' || charge === null || Array.isArray(charge)) return undefined;
  const { fireTick, aim } = charge as Readonly<Record<string, unknown>>;
  if (typeof fireTick !== 'number' || typeof aim !== 'object' || aim === null) return undefined;
  const { x, y } = aim as Readonly<Record<string, unknown>>;
  return typeof x === 'number' && typeof y === 'number' ? { fireTick, aim: { x, y } } : undefined;
}

/**
 * Locks its aim on the nearest enemy, shows a laser along that line for CHARGE_TICKS, then fires
 * one fast, heavy shot down it. The aim is the enemy's position when the charge starts, with no
 * leading and no spread: a target that keeps moving is usually off the line by the time the shot
 * comes, so the faster the target, the more often it misses. Shots never touch Thorns' spikes.
 * Staggered (by a Quake's shockwave), it can't aim: a lock in progress breaks without a shot, and
 * the next one starts once the stagger ends (ADR 0016).
 */
export const sniper = defineBall<SniperState>({
  id: 'sniper',
  name: 'Sniper',
  description: 'Locks onto its enemy, then fires one heavy shot down the line.',
  color: '#818cf8',
  ability: { name: 'Sniper shot', shownBy: { kind: 'projectileFired' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 780,
  maxHealth: 78,
  contactDamage: 9,
  initialAbilityState: { nextChargeTick: FIRST_CHARGE_TICK, charge: null },
  hooks: {
    onTick: ({ world, self, isPhased }) => {
      const { charge, nextChargeTick } = self.abilityState;
      if (hasStatus(self, 'staggered')) {
        if (charge === null) return heldAim(world.tick, nextChargeTick);
        // The lock breaks without a shot, and the arena shows why (ADR 0028).
        return [
          { kind: 'setAbilityState', state: { nextChargeTick: world.tick, charge: null } },
          { kind: 'ruleApplied', rule: 'aimHeld' },
        ];
      }
      if (charge !== null) {
        if (world.tick < charge.fireTick) return [];
        return [
          {
            kind: 'spawnProjectile',
            velocity: { x: charge.aim.x * SHOT_SPEED, y: charge.aim.y * SHOT_SPEED },
            radius: SHOT_RADIUS,
            damage: SHOT_DAMAGE,
            lifetimeTicks: SHOT_LIFETIME_TICKS,
          },
          {
            kind: 'setAbilityState',
            state: { nextChargeTick: world.tick + COOLDOWN_TICKS, charge: null },
          },
        ];
      }
      if (world.tick < nextChargeTick) return [];
      const target = nearestTarget(self, world.balls, world.minions, isPhased);
      if (target === undefined) return [];
      const dx = target.position.x - self.position.x;
      const dy = target.position.y - self.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance === 0) return [];
      const aim = { x: dx / distance, y: dy / distance };
      return [
        {
          kind: 'setAbilityState',
          state: { nextChargeTick, charge: { fireTick: world.tick + CHARGE_TICKS, aim } },
        },
      ];
    },
  },
});
