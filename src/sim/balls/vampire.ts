import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState } from '../types.ts';
import { percentOf, secondsOf } from './how-it-works.ts';

/** Fraction of the damage it deals that the Vampire heals. */
export const LIFESTEAL = 0.95;
/** How much faster it travels while thirsty (ADR 0077). */
export const THIRST_SPEED = 1.35;
/** How long a hit from afar makes it thirsty. */
export const THIRST_TICKS = 60;

export type VampireState = Readonly<{
  /** While thirsty: the tick it ends; 0 otherwise. */
  thirstyUntil: number;
}>;

/** Health healed for dealing `amount` damage. Rounded so health stays whole. */
export function lifestealFor(amount: number): number {
  return Math.round(amount * LIFESTEAL);
}

/** The tick a Vampire's thirst ends (0 when it isn't thirsty); undefined for other balls. */
export function thirstyUntilOf(ball: BallState): number | undefined {
  const until = ball.abilityState['thirstyUntil'];
  return typeof until === 'number' ? until : undefined;
}

/**
 * Heals itself for most of the damage its bumps deal, never above its max health, on little health
 * of its own: a glass cannon that beats bumpers. Only bumps: it drinks nothing from a ball it never
 * touches, so shooters beat it (ADR 0045). Thirst (ADR 0077): any hit that isn't a bump (a shot, a
 * strike, a skull, poison) makes it THIRST_SPEED as fast for THIRST_TICKS, so it closes in on what
 * hurts it from afar. Its speed follows the state through `cruiseSpeed` (ADR 0008).
 */
export const vampire = defineBall<VampireState>({
  id: 'vampire',
  name: 'Vampire',
  description: 'Heals off its bumps; a hit from afar speeds it up.',
  color: '#a855f7',
  ability: { name: 'Lifesteal', shownBy: { kind: 'healed' }, tipOn: 'self' },
  howItWorks: [
    `It heals ${percentOf(LIFESTEAL)} of what its bumps deal, rounded, never past full health.`,
    'Only bumps heal it: a ball it never touches feeds it nothing.',
    `Any hit that isn't a bump makes it ${percentOf(THIRST_SPEED - 1)} faster for ${secondsOf(THIRST_TICKS)} s.`,
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 750,
  topSpeed: 750 * THIRST_SPEED,
  maxHealth: 37,
  contactDamage: 23,
  initialAbilityState: { thirstyUntil: 0 },
  cruiseSpeed: (state, stats) =>
    state.thirstyUntil > 0 ? stats.speed * THIRST_SPEED : stats.speed,
  hooks: {
    onTick: ({ world, self }) =>
      self.abilityState.thirstyUntil > 0 && world.tick >= self.abilityState.thirstyUntil
        ? [{ kind: 'setAbilityState', state: { thirstyUntil: 0 } }]
        : [],
    onDamageDealt: ({ self, amount, cause }) => {
      if (cause !== 'contact') return [];
      const heal = lifestealFor(amount);
      return heal > 0 ? [{ kind: 'heal', targetId: self.id, amount: heal }] : [];
    },
    onDamageTaken: ({ world, self, attacker, cause, amount }) =>
      cause === 'contact' || amount <= 0 || attacker.id === self.id
        ? []
        : [{ kind: 'setAbilityState', state: { thirstyUntil: world.tick + THIRST_TICKS } }],
  },
});
