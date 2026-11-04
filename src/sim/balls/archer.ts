import { rotateByHalfTan } from '../bounce-variance.ts';
import { isAlive } from '../combat.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState, Vec2 } from '../types.ts';

export type ArcherState = Readonly<{ nextShotTick: number }>;

/** The first shot comes on this tick, so a match doesn't open with an instant hit. */
export const FIRST_SHOT_DELAY_TICKS = 30;
/** Ticks between shots. */
export const COOLDOWN_TICKS = 90;
/** World units per second. */
export const ARROW_SPEED = 1500;
export const ARROW_RADIUS = 6;
export const ARROW_DAMAGE = 10;
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

function nearestEnemy(self: Readonly<{ id: string; position: Vec2 }>, balls: readonly BallState[]) {
  let nearest: BallState | undefined;
  let nearestDistance = Infinity;
  for (const ball of balls) {
    if (ball.id === self.id || !isAlive(ball)) continue;
    const dx = ball.position.x - self.position.x;
    const dy = ball.position.y - self.position.y;
    const distance = dx * dx + dy * dy;
    if (distance < nearestDistance) {
      nearest = ball;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/**
 * A glass cannon: weak in contact, but every COOLDOWN_TICKS it shoots an arrow at the nearest
 * enemy's current position, with a small random spread. The next shot is stored as an absolute
 * tick, so the hook does nothing at all between shots.
 */
export const archer = defineBall<ArcherState>({
  id: 'archer',
  name: 'Archer',
  description: 'Weak up close, but shoots an arrow at its enemy every 1.5 seconds.',
  color: '#22d3ee',
  radius: 46,
  speed: 620,
  maxHealth: 56,
  contactDamage: 6,
  initialAbilityState: { nextShotTick: FIRST_SHOT_DELAY_TICKS },
  hooks: {
    onTick: ({ world, self, random }) => {
      if (world.tick < self.abilityState.nextShotTick) return [];
      const target = nearestEnemy(self, world.balls);
      if (target === undefined) return [];

      const dx = target.position.x - self.position.x;
      const dy = target.position.y - self.position.y;
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
