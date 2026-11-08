import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState, Vec2 } from '../types.ts';
import { nearestTarget } from './targeting.ts';

export type StormState = Readonly<{ nextStrikeTick: number }>;

/** The first strike is called on this tick, so a match doesn't open with one already falling. */
export const FIRST_STRIKE_DELAY_TICKS = 60;
/** Ticks between strikes being called. Longer than the warning, so a Storm has one zone at most. */
export const COOLDOWN_TICKS = 105;
/**
 * Warning before a zone strikes (about 0.9 s): long enough that a moving ball often gets out. The
 * fastest balls get out most often and the slowest and biggest least, which is the Storm's edge.
 */
export const WARNING_TICKS = 52;
export const ZONE_RADIUS = 140;
/** Per hit. Identity rule: the biggest single ability hit in the roster (ADR 0045: 31 before). */
export const ZONE_DAMAGE = 36;
/** The zone lands up to this far from the target's position when it was called. */
export const MAX_OFFSET = 60;

/** The Storm's next strike tick, read from any ball state (undefined for other balls). */
export function nextStrikeTickOf(ball: BallState): number | undefined {
  const next = ball.abilityState['nextStrikeTick'];
  return typeof next === 'number' ? next : undefined;
}

/**
 * A uniformly random point in a disk of `radius` around the origin, by rejection sampling from
 * `random` (no trig, ADR 0001). Each try is accepted with probability π/4, so a handful is enough.
 */
export function randomOffset(random: () => number, radius: number): Vec2 {
  for (;;) {
    const x = random() * 2 - 1;
    const y = random() * 2 - 1;
    if (x * x + y * y <= 1) return { x: x * radius, y: y * radius };
  }
}

/**
 * Calls down lightning: every COOLDOWN_TICKS it marks a zone around the nearest enemy's current
 * position, off by a random amount, which strikes WARNING_TICKS later (ADR 0006). One big hit and
 * nothing else (ADR 0045: no more shock). The sim clamps the zone into the arena. The next strike is
 * stored as an absolute tick, so onTick does nothing at all in between. A zone already called still
 * strikes.
 */
export const storm = defineBall<StormState>({
  id: 'storm',
  name: 'Storm',
  description: 'Calls a big lightning strike on its enemy, after a warning.',
  color: '#93c5fd',
  ability: { name: 'Lightning', shownBy: { kind: 'zoneSpawned' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 780,
  maxHealth: 79,
  contactDamage: 11,
  initialAbilityState: { nextStrikeTick: FIRST_STRIKE_DELAY_TICKS },
  hooks: {
    onTick: ({ world, self, random, isPhased }) => {
      const due = self.abilityState.nextStrikeTick;
      if (world.tick < due) return [];
      const target = nearestTarget(self, world.balls, world.minions, isPhased);
      if (target === undefined) return [];
      const offset = randomOffset(random, MAX_OFFSET);
      return [
        {
          kind: 'spawnZone',
          position: { x: target.position.x + offset.x, y: target.position.y + offset.y },
          radius: ZONE_RADIUS,
          damage: ZONE_DAMAGE,
          delayTicks: WARNING_TICKS,
        },
        {
          kind: 'setAbilityState',
          state: { nextStrikeTick: world.tick + COOLDOWN_TICKS },
        },
      ];
    },
  },
});
