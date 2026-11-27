import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { secondsOf } from './how-it-works.ts';
import { nearestTarget } from './targeting.ts';

/** Above ground, tunnelling at its target, or still under the spot it is about to burst from. */
export type MolePhase = 'up' | 'dig' | 'rumble';

export type MoleState = Readonly<{
  phase: MolePhase;
  /** The tick its phase ends: it digs, must stop tunnelling, or bursts up. */
  nextTick: number;
}>;

/** Its first dig, 1.5 s in. */
export const FIRST_DIG_TICK = 90;
/** How long it stays up between digs. */
export const SURFACE_TICKS = 180;
/** The longest it tunnels before it stops, wherever it is. */
export const DIG_TICKS = 25;
/** How fast it tunnels (world units a second). */
export const DIG_SPEED = 1500;
/** It stops tunnelling once its target's centre is this close to its own. */
export const CATCH_DISTANCE = 30;
/** The ground rumbles this long over the spot where it stopped before it bursts up. */
export const RUMBLE_TICKS = 8;
/** How fast it creeps while the ground rumbles: all but still. */
export const RUMBLE_SPEED = 1;
/** World units: its burst catches every enemy this close to the spot (an area hit). */
export const BURST_RADIUS = 70;
/** The burst's damage to each enemy caught in it. */
export const BURST_DAMAGE = 15;

const SPEED = 760;

/**
 * Digs (prototype): every SURFACE_TICKS it goes underground. Underground it is phased (ADR 0049:
 * nothing touches it, no hit lands) and tunnels straight at the nearest target at DIG_SPEED, unable
 * to hurt anything. When it reaches its target, or after DIG_TICKS, it stops; the ground over it
 * rumbles for RUMBLE_TICKS (a zone, ADR 0006) and then it bursts up there, hitting every enemy
 * within BURST_RADIUS of the spot. A ball that is slow, held or planted is still there; one that
 * keeps moving has moved on.
 */
export const mole = defineBall<MoleState>({
  id: 'mole',
  name: 'Mole',
  description: 'Tunnels under its enemy and bursts up beneath it.',
  color: '#a47551',
  ability: { name: 'Dig', shownBy: { kind: 'zoneSpawned' }, tipOn: 'zone' },
  howItWorks: [
    `Every ${secondsOf(SURFACE_TICKS)} s it digs: underground nothing touches it, and it tunnels at the nearest enemy for up to ${secondsOf(DIG_TICKS)} s.`,
    `Then it bursts up where it stopped, ${secondsOf(RUMBLE_TICKS)} s later, hitting every enemy still close by for ${String(BURST_DAMAGE)}.`,
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: SPEED,
  maxHealth: 57,
  contactDamage: 21,
  initialAbilityState: { phase: 'up', nextTick: FIRST_DIG_TICK },
  cruiseSpeed: (state, stats) =>
    state.phase === 'dig' ? DIG_SPEED : state.phase === 'rumble' ? RUMBLE_SPEED : stats.speed,
  phasedOf: (self) => self.abilityState.phase !== 'up',
  incomingDamageOf: (self, amount) => (self.abilityState.phase === 'up' ? amount : 0),
  hooks: {
    onTick: ({ world, self, aimPointOf }) => {
      const { phase, nextTick } = self.abilityState;
      const { tick } = world;
      if (phase === 'up') {
        return tick < nextTick
          ? []
          : [{ kind: 'setAbilityState', state: { phase: 'dig', nextTick: tick + DIG_TICKS } }];
      }
      if (phase === 'rumble') {
        return tick < nextTick
          ? []
          : [{ kind: 'setAbilityState', state: { phase: 'up', nextTick: tick + SURFACE_TICKS } }];
      }
      const target = nearestTarget(self, world.balls, world.minions, aimPointOf);
      const dx = target === undefined ? 0 : target.position.x - self.position.x;
      const dy = target === undefined ? 0 : target.position.y - self.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (target === undefined || distance <= CATCH_DISTANCE || tick >= nextTick) {
        return [
          {
            kind: 'spawnZone',
            position: self.position,
            radius: BURST_RADIUS,
            damage: BURST_DAMAGE,
            delayTicks: RUMBLE_TICKS,
          },
          {
            kind: 'setAbilityState',
            state: { phase: 'rumble', nextTick: tick + RUMBLE_TICKS },
          },
        ];
      }
      return [
        {
          kind: 'setVelocity',
          velocity: { x: (dx / distance) * DIG_SPEED, y: (dy / distance) * DIG_SPEED },
        },
      ];
    },
  },
});
