import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState, WorldState } from '../types.ts';
import { leadTarget } from './archer.ts';
import { nearestTarget } from './targeting.ts';

export type BoomerangState = Readonly<{ nextThrowTick: number }>;

/** The first throw comes on this tick, so a match doesn't open with an instant hit. */
export const FIRST_THROW_TICK = 40;
/** Ticks from one throw to the next, at the soonest: it also waits to catch the last one. */
export const COOLDOWN_TICKS = 130;
/** World units per second, out and back: well above any ball's speed, so it always gets home. */
export const BOOMERANG_SPEED = 1700;
export const BOOMERANG_RADIUS = 12;
/** Ability damage per hit; it can hit the same ball once going out and once coming back. */
export const BOOMERANG_DAMAGE = 7;
/** It turns back this long after it is thrown (about 620 units out), or at a wall. */
export const TURN_TICKS = 22;
/** A safety net: a boomerang always comes home well inside this. */
export const BOOMERANG_LIFETIME_TICKS = 240;

/** The Boomerang's next throw tick, read from any ball state (undefined for other balls). */
export function nextThrowTickOf(ball: BallState): number | undefined {
  const next = ball.abilityState['nextThrowTick'];
  return typeof next === 'number' ? next : undefined;
}

/** True while `ownerId` has a boomerang in the air. */
export function hasBoomerangOut(world: WorldState, ownerId: string): boolean {
  return world.projectiles.some(
    (projectile) => projectile.ownerId === ownerId && projectile.returning !== undefined,
  );
}

/**
 * Throws a boomerang (ADR 0043): a returning projectile, led at the nearest enemy like an arrow,
 * that turns back after TURN_TICKS or at a wall and homes on the Boomerang, which catches it. A hit
 * doesn't stop it, so it can hit the same ball going out and coming back: the way back crosses
 * whatever is near the Boomerang. It throws again once COOLDOWN_TICKS have passed and the last one
 * is home (or lost to a skull, which a boomerang can't fly through).
 */
export const boomerang = defineBall<BoomerangState>({
  id: 'boomerang',
  name: 'Boomerang',
  description: 'Its boomerang hits going out and coming back.',
  color: '#2dd4bf',
  ability: { name: 'Boomerang', shownBy: { kind: 'projectileFired' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 770,
  maxHealth: 52,
  contactDamage: 10,
  initialAbilityState: { nextThrowTick: FIRST_THROW_TICK },
  hooks: {
    onTick: ({ world, self }) => {
      const due = self.abilityState.nextThrowTick;
      if (world.tick < due || hasBoomerangOut(world, self.id)) return [];
      const target = nearestTarget(self, world.balls, world.minions);
      if (target === undefined) return [];
      const aimAt = leadTarget(self.position, target.position, target.velocity, BOOMERANG_SPEED);
      const dx = aimAt.x - self.position.x;
      const dy = aimAt.y - self.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance === 0) return [];
      return [
        {
          kind: 'spawnProjectile',
          velocity: { x: (dx / distance) * BOOMERANG_SPEED, y: (dy / distance) * BOOMERANG_SPEED },
          radius: BOOMERANG_RADIUS,
          damage: BOOMERANG_DAMAGE,
          lifetimeTicks: BOOMERANG_LIFETIME_TICKS,
          returnAfterTicks: TURN_TICKS,
        },
        { kind: 'setAbilityState', state: { nextThrowTick: world.tick + COOLDOWN_TICKS } },
      ];
    },
  },
});
