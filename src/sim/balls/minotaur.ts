import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState } from '../types.ts';
import { secondsOf } from './how-it-works.ts';
import { nearestEnemy } from './targeting.ts';

export type MinotaurPhase = 'roam' | 'windup' | 'charge';

export type MinotaurState = Readonly<{
  phase: MinotaurPhase;
  /** Roaming: the tick it lowers its head. Winding up: the tick it charges. Charging: its cap. */
  phaseEnds: number;
  /** The point it charges at: where its enemy was the moment it lowered its head. */
  aimX: number;
  aimY: number;
}>;

/** Its first wind-up, 1 s in. */
export const FIRST_WINDUP_TICK = 60;
/** Ticks it roams after a charge ends before it lowers its head again. */
export const ROAM_TICKS = 90;
/** Head lowered: it crawls for this long, then charges at the point it marked. */
export const WINDUP_TICKS = 24;
/** Its speed while winding up, as a share of its own. */
export const WINDUP_SHARE = 0.3;
/** Its speed while charging, as a multiple of its own. */
export const CHARGE_SPEED = 1.6;
/** A charge that meets neither a ball nor a wall stops after this long. */
export const CHARGE_MAX_TICKS = 60;
/** A bump mid-charge lands this many times as hard. */
export const CHARGE_TIMES = 3.4;
/** A charge into a wall: a shockwave round the impact. */
export const SHOCK_RADIUS = 220;
export const SHOCK_DAMAGE = 5;
export const SHOCK_DELAY_TICKS = 8;

const SPEED = 760;
const BUMP = 13;

/** A Minotaur's state, read from any ball state (undefined for other balls). */
export function minotaurStateOf(ball: BallState): MinotaurState | undefined {
  const { phase, phaseEnds, aimX, aimY } = ball.abilityState;
  if (phase !== 'roam' && phase !== 'windup' && phase !== 'charge') return undefined;
  if (typeof phaseEnds !== 'number' || typeof aimX !== 'number' || typeof aimY !== 'number') {
    return undefined;
  }
  return { phase, phaseEnds, aimX, aimY };
}

const roamFrom = (tick: number, s: MinotaurState): MinotaurState => ({
  ...s,
  phase: 'roam',
  phaseEnds: tick + ROAM_TICKS,
});

/**
 * A committed charge (prototype): it roams, then lowers its head and marks where its enemy IS,
 * crawls for WINDUP_TICKS, and charges in a straight line at that point at CHARGE_SPEED. It never
 * turns mid-charge, so a ball that has moved off the line is missed. A bump mid-charge lands
 * CHARGE_TIMES as hard (`contactDamageOf`, ADR 0015); a charge that ends in a wall sends out a
 * shockwave round the impact instead. Either way it roams again. Unlike the Jouster's lance, how
 * head-on the bump is changes nothing beyond the usual directness: the whole rule is the line.
 */
export const minotaur = defineBall<MinotaurState>({
  id: 'minotaur',
  name: 'Minotaur',
  description: 'It marks its enemy, then charges in a straight line: a hit lands huge.',
  color: '#c0632b',
  ability: { name: 'Charge', shownBy: { kind: 'hook', hook: 'onTick' }, tipOn: 'self' },
  howItWorks: [
    `Every ${secondsOf(ROAM_TICKS)} s it lowers its head for ${secondsOf(WINDUP_TICKS)} s, then charges in a straight line at where its enemy was, ${String(CHARGE_SPEED)} times as fast.`,
    `A bump mid-charge does ${String(CHARGE_TIMES)} times its ${String(BUMP)}; a charge into a wall sends out a shockwave, ${String(SHOCK_DAMAGE)} to any enemy near it.`,
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: SPEED,
  maxHealth: 71,
  contactDamage: BUMP,
  initialAbilityState: { phase: 'roam', phaseEnds: FIRST_WINDUP_TICK, aimX: 0, aimY: 0 },
  cruiseSpeed: (state, stats) =>
    state.phase === 'charge'
      ? stats.speed * CHARGE_SPEED
      : state.phase === 'windup'
        ? stats.speed * WINDUP_SHARE
        : stats.speed,
  topSpeed: SPEED * CHARGE_SPEED,
  contactDamageOf: (self, stats) =>
    self.abilityState.phase === 'charge' ? stats.contactDamage * CHARGE_TIMES : stats.contactDamage,
  hooks: {
    onTick: ({ world, self }) => {
      const s = self.abilityState;
      const tick = world.tick;
      if (tick < s.phaseEnds) return [];
      if (s.phase === 'roam') {
        const target = nearestEnemy(self, world.balls);
        if (target === undefined) return [];
        const state = {
          phase: 'windup',
          phaseEnds: tick + WINDUP_TICKS,
          aimX: target.position.x,
          aimY: target.position.y,
        } as const;
        return [{ kind: 'setAbilityState', state }];
      }
      if (s.phase === 'charge') return [{ kind: 'setAbilityState', state: roamFrom(tick, s) }];
      // The wind-up is over: charge at the marked point, never turning on the way.
      const dx = s.aimX - self.position.x;
      const dy = s.aimY - self.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const charge = { ...s, phase: 'charge', phaseEnds: tick + CHARGE_MAX_TICKS } as const;
      if (distance < 1) return [{ kind: 'setAbilityState', state: charge }];
      return [
        { kind: 'setAbilityState', state: charge },
        {
          kind: 'setVelocity',
          velocity: { x: (dx / distance) * SPEED, y: (dy / distance) * SPEED },
        },
      ];
    },
    onHitBall: ({ world, self }) =>
      self.abilityState.phase === 'charge'
        ? [{ kind: 'setAbilityState', state: roamFrom(world.tick, self.abilityState) }]
        : [],
    onWallHit: ({ world, self }) => {
      if (self.abilityState.phase !== 'charge') return [];
      return [
        {
          kind: 'spawnZone',
          position: self.position,
          radius: SHOCK_RADIUS,
          damage: SHOCK_DAMAGE,
          delayTicks: SHOCK_DELAY_TICKS,
        },
        { kind: 'setAbilityState', state: roamFrom(world.tick, self.abilityState) },
      ];
    },
  },
});
