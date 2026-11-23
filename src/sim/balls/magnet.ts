import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { secondsOf } from './how-it-works.ts';
import type { AbilityAction, BallState, DamageVia } from '../types.ts';
import { steerToward } from '../steer.ts';
import { nearestEnemy } from './targeting.ts';

export type MagnetState = Readonly<{
  /** The next timed pull starts on this tick. */
  nextPullTick: number;
  /** The pull in progress lasts until (not including) this tick; 0 when none has started. */
  pullUntilTick: number;
  /** How far each tick of the pull in progress turns the enemy (PULL_SHARE or HIT_PULL_SHARE). */
  pullShare: number;
  /** A hit from range can start a pull from this tick on. */
  hitReadyTick: number;
}>;

/** The first pull starts on this tick, so a match doesn't open mid-pull. */
export const FIRST_PULL_TICK = 60;
/** Ticks from the start of one timed pull to the start of the next. */
export const PULL_PERIOD_TICKS = 120;
/** How long each timed pull lasts. */
export const PULL_TICKS = 36;
/** How far each tick of a timed pull turns the enemy's heading toward the Magnet (ADR 0026). */
export const PULL_SHARE = 0.025;
/** How long a pull that a hit from range starts lasts (ADR 0058). */
export const HIT_PULL_TICKS = 60;
/** Its share: harder than a timed pull, so the shooter is dragged in before it gets loose. */
export const HIT_PULL_SHARE = 0.07;
/** Ticks after a hit-started pull ends before a hit can start another. */
export const HIT_PULL_REST_TICKS = 60;

/** True for a hit from range, which starts a pull at once: a projectile or a minion. */
export function startsPull(via: DamageVia | 'contact'): boolean {
  return via === 'projectile' || via === 'minion';
}

/** True while a Magnet is pulling, read from any ball state (false for other balls). */
export function isPulling(ball: BallState, tick: number): boolean {
  const until = ball.abilityState['pullUntilTick'];
  return typeof until === 'number' && tick < until;
}

/**
 * Every PULL_PERIOD_TICKS it pulls the nearest enemy toward itself for PULL_TICKS: each tick the
 * enemy's heading turns toward the Magnet (the `steer` action, ADR 0026). Only direction changes;
 * the enemy keeps its own speed, so a pull drags a ball into contact instead of flinging it.
 * A hit from range (a projectile or minion, `via`) starts a harder pull at once, unless one is in
 * progress or resting (ADR 0058): it reacts to the kind of hit, as the Battery does (ADR 0056), so
 * against a ball that never hits from range it is the timed pull alone.
 */
export const magnet = defineBall<MagnetState>({
  id: 'magnet',
  name: 'Magnet',
  description: 'Pulls every 2 s, and at once when hit from range.',
  color: '#e11d48',
  ability: { name: 'Pull', shownBy: { kind: 'hook', hook: 'onTick' }, tipOn: 'self' },
  howItWorks: [
    `Every ${secondsOf(PULL_PERIOD_TICKS)} s it pulls the nearest enemy toward it for ${secondsOf(PULL_TICKS)} s.`,
    `A shot, throw or minion that hits it starts a harder pull at once, for ${secondsOf(HIT_PULL_TICKS)} s; the next can start ${secondsOf(HIT_PULL_REST_TICKS)} s after it ends.`,
    'The pull only turns the other ball; it keeps its own speed.',
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 68,
  contactDamage: 25,
  initialAbilityState: {
    nextPullTick: FIRST_PULL_TICK,
    pullUntilTick: 0,
    pullShare: PULL_SHARE,
    hitReadyTick: 0,
  },
  hooks: {
    onTick: ({ world, self }) => {
      const { nextPullTick, pullUntilTick, pullShare } = self.abilityState;
      const actions: AbilityAction<MagnetState>[] = [];
      let share = pullShare;
      if (world.tick >= nextPullTick) {
        // A timed pull that starts during a hit-started one keeps the harder pull until both end.
        share = world.tick < pullUntilTick ? Math.max(PULL_SHARE, pullShare) : PULL_SHARE;
        actions.push({
          kind: 'setAbilityState',
          state: {
            ...self.abilityState,
            nextPullTick: world.tick + PULL_PERIOD_TICKS,
            pullUntilTick: Math.max(pullUntilTick, world.tick + PULL_TICKS),
            pullShare: share,
          },
        });
      }
      const pulling = world.tick >= nextPullTick || world.tick < pullUntilTick;
      const target = pulling ? nearestEnemy(self, world.balls) : undefined;
      if (target !== undefined) {
        actions.push({ kind: 'steer', targetId: target.id, toward: self.position, share });
        // The pull is mutual: the Magnet turns toward its enemy too, so both meet head-on.
        actions.push({
          kind: 'setVelocity',
          velocity: steerToward(self.position, self.velocity, target.position, share),
        });
      }
      return actions;
    },
    onDamageTaken: ({ world, self, via }) => {
      const { pullUntilTick, hitReadyTick } = self.abilityState;
      if (!startsPull(via) || world.tick < pullUntilTick || world.tick < hitReadyTick) return [];
      return [
        {
          kind: 'setAbilityState',
          state: {
            ...self.abilityState,
            pullUntilTick: world.tick + HIT_PULL_TICKS,
            pullShare: HIT_PULL_SHARE,
            hitReadyTick: world.tick + HIT_PULL_TICKS + HIT_PULL_REST_TICKS,
          },
        },
      ];
    },
  },
});
