import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { secondsOf } from './how-it-works.ts';
import type { Vec2 } from '../types.ts';
import { leadTarget } from './archer.ts';
import { nearestTarget } from './targeting.ts';

export type PirateState = Readonly<{ nextShotTick: number }>;

/** The first broadside can come on this tick, so a match doesn't open with a shot. */
export const FIRST_SHOT_TICK = 45;
/** Ticks from one broadside to the next one it may fire. */
export const RELOAD_TICKS = 100;
/** World units per second. */
export const CANNONBALL_SPEED = 1400;
export const CANNONBALL_RADIUS = 9;
export const CANNONBALL_DAMAGE = 9;
/** Long enough to cross the arena; a wall normally ends a cannonball much sooner. */
export const CANNONBALL_LIFETIME_TICKS = 60;
/**
 * How far ahead or behind its beam (along its heading) the enemy's lead point may be for it to
 * fire: the cannonball still meets the enemy's body, so a ball alongside is hit and one ahead or
 * behind is never fired at.
 */
export const BEAM_HALF_WIDTH = 40;
/** How far out to the side its guns reach. */
export const BROADSIDE_RANGE = 520;

/**
 * Where an enemy at `point` sits from a ship at `position` heading along unit `heading`: `along`
 * its heading (ahead positive) and `across` it (to its right, y down, positive).
 */
export function bearingOf(
  position: Vec2,
  heading: Vec2,
  point: Vec2,
): { along: number; across: number } {
  const dx = point.x - position.x;
  const dy = point.y - position.y;
  return { along: dx * heading.x + dy * heading.y, across: dx * -heading.y + dy * heading.x };
}

/**
 * A broadside ship (prototype): its cannons point only out of its sides. When the nearest
 * enemy will be abeam of it (to its left or right, within BEAM_HALF_WIDTH of its beam and
 * BROADSIDE_RANGE out) by the time a cannonball gets there, it fires one straight out of that
 * side, then reloads. It never fires ahead or behind, so a ball meeting it head-on is safe and a
 * ball running alongside or circling it is shot.
 */
export const pirate = defineBall<PirateState>({
  id: 'pirate',
  name: 'Pirate',
  description: 'Fires cannonballs out of its sides; safe head-on.',
  color: '#c2703d',
  ability: { name: 'Broadside', shownBy: { kind: 'projectileFired' }, tipOn: 'self' },
  howItWorks: [
    `When an enemy is alongside it, it fires a cannonball straight out of that side for ${String(CANNONBALL_DAMAGE)}, then reloads for ${secondsOf(RELOAD_TICKS)} s.`,
    'It never fires ahead or behind: meet it head-on.',
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 64,
  contactDamage: 14,
  initialAbilityState: { nextShotTick: FIRST_SHOT_TICK },
  hooks: {
    onTick: ({ world, self, aimPointOf }) => {
      if (world.tick < self.abilityState.nextShotTick) return [];
      const { x: vx, y: vy } = self.velocity;
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed === 0) return [];
      const target = nearestTarget(self, world.balls, world.minions, aimPointOf);
      if (target === undefined) return [];

      const heading = { x: vx / speed, y: vy / speed };
      const meet = leadTarget(self.position, target.position, target.velocity, CANNONBALL_SPEED);
      const { along, across } = bearingOf(self.position, heading, meet);
      const abeam = along <= BEAM_HALF_WIDTH && along >= -BEAM_HALF_WIDTH;
      const inRange = across <= BROADSIDE_RANGE && across >= -BROADSIDE_RANGE;
      if (!abeam || !inRange) return [];

      // Straight out of the side the enemy is on: the heading turned a quarter.
      const side = across >= 0 ? 1 : -1;
      return [
        {
          kind: 'spawnProjectile',
          velocity: {
            x: -heading.y * side * CANNONBALL_SPEED,
            y: heading.x * side * CANNONBALL_SPEED,
          },
          radius: CANNONBALL_RADIUS,
          damage: CANNONBALL_DAMAGE,
          lifetimeTicks: CANNONBALL_LIFETIME_TICKS,
        },
        { kind: 'setAbilityState', state: { nextShotTick: world.tick + RELOAD_TICKS } },
      ];
    },
  },
});
