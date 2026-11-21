import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState } from '../types.ts';
import { percentOf, secondsOf } from './how-it-works.ts';
import { nearestEnemy } from './targeting.ts';

export type JousterState = Readonly<{
  /** The tick of its next charge. */
  nextCharge: number;
  /** While charging: the tick the charge ends. */
  chargeEnds: number;
  charging: boolean;
}>;

/** Its first charge, 1 s in. */
export const FIRST_CHARGE_TICK = 60;
/** Ticks from one charge's start to the next. */
export const CHARGE_EVERY_TICKS = 150;
/** How long a charge lasts, unless it hits a ball first. */
export const CHARGE_TICKS = 60;
/** How much faster it travels while charging. */
export const CHARGE_SPEED = 1.5;
/** A bump at least this direct (the cosine of its approach angle) is head-on. */
export const HEAD_ON = 0.85;
/** A head-on bump lands this many times as hard. */
export const LANCE_TIMES = 3;
/** Any other bump lands at this share: the lance glances off. */
export const GLANCE_SHARE = 0.4;

const SPEED = 770;
const BUMP = 11;

/** A Jouster's state, read from any ball state (undefined for other balls). */
export function jousterStateOf(ball: BallState): JousterState | undefined {
  const { nextCharge, chargeEnds, charging } = ball.abilityState;
  if (typeof nextCharge !== 'number' || typeof chargeEnds !== 'number') return undefined;
  return typeof charging === 'boolean' ? { nextCharge, chargeEnds, charging } : undefined;
}

/**
 * A lance (ADR 0077): every CHARGE_EVERY_TICKS it turns straight at the nearest enemy and charges
 * at CHARGE_SPEED for CHARGE_TICKS, or until it hits a ball. Any bump of its own, charging or not,
 * lands LANCE_TIMES as hard when it is head-on (HEAD_ON or more direct) and at GLANCE_SHARE
 * otherwise (`bumpTimesOf`), so its whole hit is in where it meets a ball, never in a damage action
 * (ADR 0015). Its bump is light (11), so a lance hit is at most 33: it never one-shots a ball.
 */
export const jouster = defineBall<JousterState>({
  id: 'jouster',
  name: 'Jouster',
  description: 'Its lance hits triple head-on, but a glance only scratches.',
  color: '#a16207',
  ability: { name: 'Lance', shownBy: { kind: 'hook', hook: 'onTick' } },
  howItWorks: [
    `Every ${secondsOf(CHARGE_EVERY_TICKS)} s it charges straight at its enemy, ${percentOf(CHARGE_SPEED - 1)} faster for up to ${secondsOf(CHARGE_TICKS)} s.`,
    `A head-on bump does ${String(LANCE_TIMES)} times its ${String(BUMP)}; a glancing one ${percentOf(GLANCE_SHARE)} of it.`,
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: SPEED,
  maxHealth: 66,
  contactDamage: BUMP,
  initialAbilityState: { nextCharge: FIRST_CHARGE_TICK, chargeEnds: 0, charging: false },
  cruiseSpeed: (state, stats) => (state.charging ? stats.speed * CHARGE_SPEED : stats.speed),
  topSpeed: SPEED * CHARGE_SPEED,
  bumpTimesOf: (directness) => (directness >= HEAD_ON ? LANCE_TIMES : GLANCE_SHARE),
  hooks: {
    onTick: ({ world, self }) => {
      const s = self.abilityState;
      const tick = world.tick;
      const target = nearestEnemy(self, world.balls);
      if (tick >= s.nextCharge && target !== undefined) {
        const dx = target.position.x - self.position.x;
        const dy = target.position.y - self.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance === 0) return [];
        return [
          {
            kind: 'setAbilityState',
            state: {
              nextCharge: tick + CHARGE_EVERY_TICKS,
              chargeEnds: tick + CHARGE_TICKS,
              charging: true,
            },
          },
          {
            kind: 'setVelocity',
            velocity: { x: (dx / distance) * SPEED, y: (dy / distance) * SPEED },
          },
        ];
      }
      return s.charging && tick >= s.chargeEnds
        ? [{ kind: 'setAbilityState', state: { ...s, charging: false } }]
        : [];
    },
    onHitBall: ({ self }) =>
      self.abilityState.charging
        ? [{ kind: 'setAbilityState', state: { ...self.abilityState, charging: false } }]
        : [],
  },
});
