import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState } from '../types.ts';
import { steerToward } from '../steer.ts';
import { nearestEnemy } from './targeting.ts';

export type MagnetState = Readonly<{
  /** The next pull starts on this tick. */
  nextPullTick: number;
  /** The pull in progress lasts until (not including) this tick; 0 when none has started. */
  pullUntilTick: number;
}>;

/** The first pull starts on this tick, so a match doesn't open mid-pull. */
export const FIRST_PULL_TICK = 60;
/** Ticks from the start of one pull to the start of the next. */
export const PULL_PERIOD_TICKS = 120;
/** How long each pull lasts. */
export const PULL_TICKS = 36;
/** How far each tick of a pull turns the enemy's heading toward the Magnet (ADR 0026). */
export const PULL_SHARE = 0.03;

/** True while a Magnet is pulling, read from any ball state (false for other balls). */
export function isPulling(ball: BallState, tick: number): boolean {
  const until = ball.abilityState['pullUntilTick'];
  return typeof until === 'number' && tick < until;
}

/**
 * Every PULL_PERIOD_TICKS it pulls the nearest enemy toward itself for PULL_TICKS: each tick the
 * enemy's heading turns toward the Magnet (the `steer` action, ADR 0026). Only direction changes;
 * the enemy keeps its own speed, so a pull drags a ball into contact instead of flinging it.
 */
export const magnet = defineBall<MagnetState>({
  id: 'magnet',
  name: 'Magnet',
  description: 'Every 2 s it pulls its enemy in.',
  color: '#e11d48',
  ability: { name: 'Pull', shownBy: { kind: 'hook', hook: 'onTick' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 69,
  contactDamage: 25,
  initialAbilityState: { nextPullTick: FIRST_PULL_TICK, pullUntilTick: 0 },
  hooks: {
    onTick: ({ world, self, isPhased }) => {
      const { nextPullTick, pullUntilTick } = self.abilityState;
      const actions = [];
      if (world.tick >= nextPullTick) {
        actions.push({
          kind: 'setAbilityState' as const,
          state: {
            nextPullTick: world.tick + PULL_PERIOD_TICKS,
            pullUntilTick: world.tick + PULL_TICKS,
          },
        });
      }
      const pulling = world.tick >= nextPullTick || world.tick < pullUntilTick;
      const target = pulling ? nearestEnemy(self, world.balls) : undefined;
      if (target !== undefined) {
        // A phased ball can't be gripped (ADR 0028): the Magnet still turns toward it.
        if (!isPhased(target)) {
          actions.push({
            kind: 'steer' as const,
            targetId: target.id,
            toward: self.position,
            share: PULL_SHARE,
          });
        }
        // The pull is mutual: the Magnet turns toward its enemy too, so both meet head-on.
        actions.push({
          kind: 'setVelocity' as const,
          velocity: steerToward(self.position, self.velocity, target.position, PULL_SHARE),
        });
      }
      return actions;
    },
  },
});
