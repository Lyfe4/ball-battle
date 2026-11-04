import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { hasStatus } from '../status.ts';
import type { BallState, Vec2 } from '../types.ts';
import { nearestEnemy } from './targeting.ts';

export type StormState = Readonly<{ nextStrikeTick: number }>;

/** The first strike is called on this tick, so a match doesn't open with one already falling. */
export const FIRST_STRIKE_DELAY_TICKS = 60;
/** Ticks between strikes being called. Longer than the warning, so a Storm has one zone at most. */
export const COOLDOWN_TICKS = 130;
/**
 * Warning before a zone strikes (0.8 s): long enough that a moving ball often gets out. A longer
 * warning narrows the gap between fast and slow targets, since every ball escapes more often.
 */
export const WARNING_TICKS = 48;
export const ZONE_RADIUS = 170;
/** Per hit. Identity rule: the biggest single ability hit in the roster. */
export const ZONE_DAMAGE = 28;
/**
 * Every ball a strike hits, and every ball that touches the Storm, is shocked for this long: its
 * heals are cut by SHOCK_HEAL_REDUCTION (ADR 0009). Only the Vampire heals, so this is what makes
 * the Storm its counter.
 */
export const SHOCK_TICKS = 90;
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
 * position, off by a random amount, which strikes WARNING_TICKS later (ADR 0006). The strike, and
 * touching the Storm, shock for SHOCK_TICKS (ADR 0009). The sim clamps the zone into the arena.
 * The next strike is stored as an absolute tick, so onTick does nothing at all in between.
 * Staggered (by a Quake's shockwave), it can't aim: a strike that comes due waits until the stagger
 * ends (ADR 0016). A zone already called still strikes.
 */
export const storm = defineBall<StormState>({
  id: 'storm',
  name: 'Storm',
  description: 'Calls down lightning where its enemy stands every 2 s. Shocked balls heal less.',
  color: '#93c5fd',
  radius: STANDARD_BALL_RADIUS,
  speed: 780,
  maxHealth: 74,
  contactDamage: 13,
  initialAbilityState: { nextStrikeTick: FIRST_STRIKE_DELAY_TICKS },
  hooks: {
    // Touching the Storm shocks too (ADR 0009). onHitBall runs before onDamageDealt, so a
    // Vampire's lifesteal from this very exchange is already reduced.
    onHitBall: ({ other }) => [
      { kind: 'applyStatus', targetId: other.id, status: 'shocked', durationTicks: SHOCK_TICKS },
    ],
    onTick: ({ world, self, random }) => {
      if (world.tick < self.abilityState.nextStrikeTick || hasStatus(self, 'staggered')) return [];
      const target = nearestEnemy(self, world.balls);
      if (target === undefined) return [];
      const offset = randomOffset(random, MAX_OFFSET);
      return [
        {
          kind: 'spawnZone',
          position: { x: target.position.x + offset.x, y: target.position.y + offset.y },
          radius: ZONE_RADIUS,
          damage: ZONE_DAMAGE,
          delayTicks: WARNING_TICKS,
          status: { kind: 'shocked', durationTicks: SHOCK_TICKS },
        },
        { kind: 'setAbilityState', state: { nextStrikeTick: world.tick + COOLDOWN_TICKS } },
      ];
    },
  },
});
