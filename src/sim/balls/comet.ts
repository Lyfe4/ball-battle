import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';

export type CometState = Readonly<{
  /** The tick it last touched a ball (or the start): it has built up speed since. */
  since: number;
  /** How much faster than its own speed it is going, 0 to MOST_BOOST. */
  boost: number;
}>;

/** It builds up to this much faster than its own speed... */
export const MOST_BOOST = 0.75;
/** ...over this many ticks without touching a ball. */
export const BUILD_TICKS = 150;
/** The share of its bump that goes with its speed: (speed now / own speed - 1) times this. */
export const SPEED_SHARE = 0.4;

const SPEED = 725;
const BUMP = 20.5;

/** Its boost `ticks` after it last touched a ball. */
export function boostAfter(ticks: number): number {
  return (MOST_BOOST * Math.min(ticks, BUILD_TICKS)) / BUILD_TICKS;
}

/**
 * Momentum (prototype, Track C1): the longer it goes without touching a ball, the faster it flies
 * (up to MOST_BOOST over BUILD_TICKS), and its bump lands as hard as it is going: SPEED_SHARE of
 * its bump goes with (speed now / own speed), read from its real velocity, so anything that slows
 * it (a web, a slow, a hold) takes its punch too. Touching any ball spends the speed: it starts
 * again.
 */
export const comet = defineBall<CometState>({
  id: 'comet',
  name: 'Comet',
  description: 'Speeds up until it touches a ball; hits as hard as it flies.',
  color: '#f59e0b',
  ability: { name: 'Momentum', shownBy: { kind: 'hook', hook: 'onHitBall' }, tipOn: 'self' },
  radius: STANDARD_BALL_RADIUS,
  speed: SPEED,
  maxHealth: 74,
  contactDamage: BUMP,
  initialAbilityState: { since: 0, boost: 0 },
  cruiseSpeed: (state, stats) => stats.speed * (1 + state.boost),
  topSpeed: SPEED * (1 + MOST_BOOST),
  contactDamageOf: (self, stats) => {
    const vx = self.velocity.x;
    const vy = self.velocity.y;
    const ratio = Math.sqrt(vx * vx + vy * vy) / stats.speed;
    return stats.contactDamage * (1 + SPEED_SHARE * (ratio - 1));
  },
  hooks: {
    onTick: ({ world, self }) => {
      const boost = boostAfter(world.tick - self.abilityState.since);
      return boost === self.abilityState.boost
        ? []
        : [{ kind: 'setAbilityState', state: { ...self.abilityState, boost } }];
    },
    onHitBall: ({ world }) => [{ kind: 'setAbilityState', state: { since: world.tick, boost: 0 } }],
  },
});
