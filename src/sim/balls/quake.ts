import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState } from '../types.ts';

export type QuakeState = Readonly<{ readyTick: number }>;

/** Ticks after a shockwave before a wall bounce can set off the next, so corners can't chain. */
export const COOLDOWN_TICKS = 12;
/** Warning before a shockwave strikes (0.2 s): too short for speed to get a ball out. */
export const WARNING_TICKS = 12;
export const ZONE_RADIUS = 250;
/** Per hit; below the Storm's strike, which stays the biggest single ability hit. */
export const ZONE_DAMAGE = 6;

/** The tick the Quake's next shockwave is ready on, read from any ball state (undefined for others). */
export function readyTickOf(ball: BallState): number | undefined {
  const ready = ball.abilityState['readyTick'];
  return typeof ready === 'number' ? ready : undefined;
}

/**
 * Every wall bounce sets off a shockwave where it hit: a zone at the impact point that strikes
 * WARNING_TICKS later (ADR 0006) and hurts any enemy near it, minions too. Then nothing for
 * COOLDOWN_TICKS. The sim clamps the zone into the arena. It needs walls: a slowed Quake reaches them
 * less often. Damage only (ADR 0045): many small, wide shockwaves, too small for a rewind to undo and
 * a big share of each lost to armor (group 4).
 */
export const quake = defineBall<QuakeState>({
  id: 'quake',
  name: 'Quake',
  description: 'Every wall hit sends out a small, wide shockwave.',
  color: '#78716c',
  ability: { name: 'Shockwave', shownBy: { kind: 'hook', hook: 'onWallHit' } },
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
        },
        { kind: 'setAbilityState', state: { readyTick: world.tick + COOLDOWN_TICKS } },
      ];
    },
  },
});
