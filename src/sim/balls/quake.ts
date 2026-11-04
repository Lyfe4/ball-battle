import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState } from '../types.ts';

export type QuakeState = Readonly<{ readyTick: number }>;

/** Ticks after a shockwave before a wall bounce can set off the next, so corners can't chain. */
export const COOLDOWN_TICKS = 30;
/** Warning before a shockwave strikes (0.2 s): too short for speed to get a ball out. */
export const WARNING_TICKS = 12;
export const ZONE_RADIUS = 180;
/** Per hit; below the Storm's zone damage, which stays the biggest single ability hit. */
export const ZONE_DAMAGE = 13;
/**
 * Every ball a shockwave hits is staggered for this long (3.5 s): it can't aim, so an Archer, Storm
 * or Sniper loses its next attack until it ends (ADR 0016). Long, because shockwaves rarely hit.
 */
export const STAGGER_TICKS = 210;

/** The tick the Quake's next shockwave is ready on, read from any ball state (undefined for others). */
export function readyTickOf(ball: BallState): number | undefined {
  const ready = ball.abilityState['readyTick'];
  return typeof ready === 'number' ? ready : undefined;
}

/**
 * Every wall bounce sets off a shockwave where it hit: a zone at the impact point that strikes
 * WARNING_TICKS later (ADR 0006). Then nothing for COOLDOWN_TICKS. The sim clamps the zone into the
 * arena. It needs walls: a slowed Quake reaches them less often, which is why the Frost beats it.
 * A shockwave staggers what it hits, so the balls that aim (Archer, Storm, Sniper) lose attacks.
 */
export const quake = defineBall<QuakeState>({
  id: 'quake',
  name: 'Quake',
  description: 'Every wall it hits sends out a shockwave that stops its enemy aiming.',
  color: '#78716c',
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 71,
  contactDamage: 15,
  initialAbilityState: { readyTick: 0 },
  hooks: {
    onWallHit: ({ world, self }) => {
      if (world.tick < self.abilityState.readyTick) return [];
      return [
        {
          kind: 'spawnZone',
          position: self.position,
          radius: ZONE_RADIUS,
          damage: ZONE_DAMAGE,
          delayTicks: WARNING_TICKS,
          status: { kind: 'staggered', durationTicks: STAGGER_TICKS },
        },
        { kind: 'setAbilityState', state: { readyTick: world.tick + COOLDOWN_TICKS } },
      ];
    },
  },
});
