import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { percentOf, secondsOf } from './how-it-works.ts';

export type HunterState = Readonly<{ nextSnareTick: number }>;

/** The speed its bump measures prey against: a standard ball's. */
export const PREY_SPEED = 760;
/** How much harder its bump lands per share its prey is slower than PREY_SPEED... */
export const SLOW_PREY_TIMES = 5;
/** ... and how much softer per share its prey is faster. */
export const FAST_PREY_TIMES = 0.7;
/** Its bump never lands harder than this many times... */
export const MOST_TIMES = 2.2;
/** ... or softer than this share. */
export const LEAST_TIMES = 0.75;

/** Its first snare, 2 s in. */
export const FIRST_SNARE_TICK = 120;
/** Ticks between snares (6 s). */
export const SNARE_EVERY_TICKS = 360;
/** A snare stays this long (5 s), then snaps shut on whatever is on it. */
export const SNARE_TICKS = 300;
/** It arms this long after it is laid. */
export const SNARE_ARM_TICKS = 30;
/** World units: the snare's trap, which an enemy ball springs by running into it. */
export const SNARE_RADIUS = 32;
/** World units: a sprung snare holds every enemy ball this close. */
export const SNARE_HOLD_RADIUS = 52;
/** A sprung snare's bite (a hold needs a hit to land). */
export const SNARE_BITE = 2;
/** How long a snared ball is held (the Kraken's `held` status). */
export const SNARE_HOLD_TICKS = 30;

const SPEED = 760;
const BUMP = 24.5;

/** How many times its bump lands on prey moving at `speed`. */
export function preyTimes(speed: number): number {
  const off = 1 - speed / PREY_SPEED;
  const times = 1 + (off > 0 ? SLOW_PREY_TIMES : FAST_PREY_TIMES) * off;
  return Math.min(MOST_TIMES, Math.max(LEAST_TIMES, times));
}

/**
 * Hunts slow prey (prototype): its bump lands harder the slower the ball it hits was moving as it
 * came in (`contactDamageOf` reads the target's real speed before the bounce), so a planted,
 * anchored, held, slowed or naturally slow ball takes more and a fast one less (`preyTimes`). Now
 * and then it lays a snare where it is (a zone with a swept trigger, ADR 0043): an enemy that runs
 * into it is bitten for SNARE_BITE and held (the Kraken's `held`) for SNARE_HOLD_TICKS. A phased
 * ball passes over a snare.
 */
export const hunter = defineBall<HunterState>({
  id: 'hunter',
  name: 'Hunter',
  description: 'Hits slow prey hardest; leaves snares that hold.',
  color: '#b07a4f',
  ability: { name: 'Hunt', shownBy: { kind: 'zoneSpawned' }, tipOn: 'zone' },
  howItWorks: [
    `Its bump of ${String(BUMP)} lands harder the slower its prey is moving: up to ${String(MOST_TIMES)} times on a held or planted ball, as little as ${percentOf(LEAST_TIMES)} on a fast one.`,
    `Every ${secondsOf(SNARE_EVERY_TICKS)} s it leaves a snare; an enemy that runs into one is held for ${secondsOf(SNARE_HOLD_TICKS)} s.`,
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: SPEED,
  maxHealth: 66,
  contactDamage: BUMP,
  initialAbilityState: { nextSnareTick: FIRST_SNARE_TICK },
  contactDamageOf: (_self, stats, target) => stats.contactDamage * preyTimes(target.speed),
  hooks: {
    onTick: ({ world, self }) => {
      if (world.tick < self.abilityState.nextSnareTick) return [];
      return [
        {
          kind: 'spawnZone',
          position: self.position,
          radius: SNARE_HOLD_RADIUS,
          damage: SNARE_BITE,
          delayTicks: SNARE_TICKS,
          status: { kind: 'held', durationTicks: SNARE_HOLD_TICKS },
          trigger: { radius: SNARE_RADIUS, armTicks: SNARE_ARM_TICKS },
        },
        {
          kind: 'setAbilityState',
          state: { nextSnareTick: world.tick + SNARE_EVERY_TICKS },
        },
      ];
    },
  },
});
