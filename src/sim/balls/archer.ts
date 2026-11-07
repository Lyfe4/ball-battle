import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { rotateByHalfTan } from '../bounce-variance.ts';
import { defineBall } from '../define-ball.ts';
import { heldAim } from '../rules.ts';
import { hasStatus } from '../status.ts';
import type { BallState, Vec2 } from '../types.ts';
import { nearestTarget } from './targeting.ts';

export type ArcherState = Readonly<{ nextShotTick: number }>;

/** The first shot comes on this tick, so a match doesn't open with an instant hit. */
export const FIRST_SHOT_DELAY_TICKS = 30;
/** Ticks between shots. */
export const COOLDOWN_TICKS = 120;
/** World units per second. */
export const ARROW_SPEED = 1650;
export const ARROW_RADIUS = 6;
export const ARROW_DAMAGE = 11;
/** Long enough to cross the arena several times; walls normally end an arrow much sooner. */
export const ARROW_LIFETIME_TICKS = 180;
/**
 * tan of half the widest spread, i.e. tan(2°) for up to ±4° either side of the aim. Precomputed
 * because Math.tan is not allowed in the sim (ADR 0001).
 */
export const SPREAD_HALF_TAN = 0.03492076949174773;

/** The Archer's next shot tick, read from any ball state (undefined for other balls). */
export function nextShotTickOf(ball: BallState): number | undefined {
  const next = ball.abilityState['nextShotTick'];
  return typeof next === 'number' ? next : undefined;
}

/**
 * Where to aim so an arrow at `arrowSpeed` meets a target moving in a straight line: the target's
 * position after time t, for the smallest t > 0 with |D + V·t| = arrowSpeed·t (D from shooter to
 * target, V the target's velocity). Solved as a quadratic with only + − * / and Math.sqrt
 * (ADR 0001). Falls back to the target's current position if the arrow can never catch it. It
 * does not foresee wall bounces.
 */
export function leadTarget(
  shooter: Vec2,
  target: Vec2,
  targetVelocity: Vec2,
  arrowSpeed: number,
): Vec2 {
  const dx = target.x - shooter.x;
  const dy = target.y - shooter.y;
  const a =
    targetVelocity.x * targetVelocity.x +
    targetVelocity.y * targetVelocity.y -
    arrowSpeed * arrowSpeed;
  const halfB = dx * targetVelocity.x + dy * targetVelocity.y;
  const c = dx * dx + dy * dy;
  let t: number | undefined;
  if (a === 0) {
    t = halfB < 0 ? -c / (2 * halfB) : undefined;
  } else {
    const discriminant = halfB * halfB - a * c;
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      const candidates = [(-halfB - root) / a, (-halfB + root) / a].filter((value) => value > 0);
      t = candidates.length > 0 ? Math.min(...candidates) : undefined;
    }
  }
  if (t === undefined) return target;
  return { x: target.x + targetVelocity.x * t, y: target.y + targetVelocity.y * t };
}

/**
 * A glass cannon: weak in contact, but every COOLDOWN_TICKS it shoots an arrow at the nearest
 * enemy, leading its aim to where the enemy will be when the arrow arrives, with a small random
 * spread. The next shot is stored as an absolute
 * tick, so the hook does nothing at all between shots. Staggered (by a Quake's shockwave), it can't
 * aim: a shot that comes due waits until the stagger ends (ADR 0016).
 */
export const archer = defineBall<ArcherState>({
  id: 'archer',
  name: 'Archer',
  description: 'Leads an arrow every 2 s; frail up close. Stagger stops aim.',
  color: '#22d3ee',
  ability: { name: 'Arrows', shownBy: { kind: 'projectileFired' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 780,
  maxHealth: 50,
  contactDamage: 6,
  initialAbilityState: { nextShotTick: FIRST_SHOT_DELAY_TICKS },
  hooks: {
    onTick: ({ world, self, random, isPhased }) => {
      const due = self.abilityState.nextShotTick;
      if (world.tick < due) return [];
      if (hasStatus(self, 'staggered')) return heldAim(world.tick, due);
      const target = nearestTarget(self, world.balls, world.minions, isPhased);
      if (target === undefined) return [];

      const aimAt = leadTarget(self.position, target.position, target.velocity, ARROW_SPEED);
      const dx = aimAt.x - self.position.x;
      const dy = aimAt.y - self.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance === 0) return [];
      const aim = { x: (dx / distance) * ARROW_SPEED, y: (dy / distance) * ARROW_SPEED };
      const spread = (random() * 2 - 1) * SPREAD_HALF_TAN;

      return [
        {
          kind: 'spawnProjectile',
          velocity: rotateByHalfTan(aim, spread),
          radius: ARROW_RADIUS,
          damage: ARROW_DAMAGE,
          lifetimeTicks: ARROW_LIFETIME_TICKS,
        },
        { kind: 'setAbilityState', state: { nextShotTick: world.tick + COOLDOWN_TICKS } },
      ];
    },
  },
});
