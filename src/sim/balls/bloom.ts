import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { secondsOf } from './how-it-works.ts';
import type { BallState } from '../types.ts';

export type BloomState = Readonly<{
  /** The tick it next regrows. */
  nextHealTick: number;
  /** Its regrowth is paused until this tick, after a hit (0: never hit). */
  pausedUntil: number;
}>;

/** It heals HEAL_AMOUNT every this many ticks, the whole match. */
export const HEAL_EVERY_TICKS = 17;
export const HEAL_AMOUNT = 1;
/** Its first regrowth comes this tick. */
export const FIRST_HEAL_TICK = HEAL_EVERY_TICKS;
/** After every hit it takes its regrowth pauses this long (1 s): the petals close. */
export const PAUSE_TICKS = 60;

/** The tick a Bloom next regrows, read from any ball state (undefined for other balls). */
export function nextHealTickOf(ball: BallState): number | undefined {
  const next = ball.abilityState['nextHealTick'];
  return typeof next === 'number' ? next : undefined;
}

/** The tick a Bloom's regrowth starts again after a hit, read from any ball state. */
export function pausedUntilOf(ball: BallState): number | undefined {
  const until = ball.abilityState['pausedUntil'];
  return typeof until === 'number' ? until : undefined;
}

/**
 * Regrows (ADR 0045): HEAL_AMOUNT every HEAL_EVERY_TICKS, all match long, except that every hit it
 * takes, of any kind, pauses its regrowth for PAUSE_TICKS. Rare hits are healed back between them;
 * a steady stream of small hits keeps it closed and stops the regrowth.
 */
export const bloom = defineBall<BloomState>({
  id: 'bloom',
  name: 'Bloom',
  description: 'Always regrowing, but every hit stops it for a second.',
  color: '#f472b6',
  ability: { name: 'Regrowth', shownBy: { kind: 'healed' } },
  howItWorks: [
    `It regrows ${HEAL_AMOUNT} health every ${secondsOf(HEAL_EVERY_TICKS)} s, all match long.`,
    `Every hit it takes, of any kind, stops that for ${secondsOf(PAUSE_TICKS)} s: its petals close.`,
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 49,
  contactDamage: 21,
  initialAbilityState: { nextHealTick: FIRST_HEAL_TICK, pausedUntil: 0 },
  hooks: {
    onTick: ({ world, self }) => {
      const { nextHealTick, pausedUntil } = self.abilityState;
      if (world.tick < nextHealTick || world.tick < pausedUntil) return [];
      return [
        { kind: 'heal', targetId: self.id, amount: HEAL_AMOUNT },
        {
          kind: 'setAbilityState',
          state: { nextHealTick: world.tick + HEAL_EVERY_TICKS, pausedUntil },
        },
      ];
    },
    onDamageTaken: ({ world, self }) => [
      {
        kind: 'setAbilityState',
        state: {
          nextHealTick: Math.max(self.abilityState.nextHealTick, world.tick + PAUSE_TICKS),
          pausedUntil: world.tick + PAUSE_TICKS,
        },
      },
    ],
  },
});
