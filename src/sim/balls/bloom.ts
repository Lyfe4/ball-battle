import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState } from '../types.ts';

export type BloomState = Readonly<{
  /** The tick it next regrows. */
  nextHealTick: number;
}>;

/** It heals HEAL_AMOUNT every this many ticks, the whole match. */
export const HEAL_EVERY_TICKS = 26;
export const HEAL_AMOUNT = 1;
/** Its first regrowth comes this tick. */
export const FIRST_HEAL_TICK = HEAL_EVERY_TICKS;

/** The tick a Bloom next regrows, read from any ball state (undefined for other balls). */
export function nextHealTickOf(ball: BallState): number | undefined {
  const next = ball.abilityState['nextHealTick'];
  return typeof next === 'number' ? next : undefined;
}

/**
 * Regrows (ADR 0045): HEAL_AMOUNT every HEAL_EVERY_TICKS, all match long, whatever is happening.
 * A long fight of small hits is healed back as it goes; a few big hits outpace it.
 */
export const bloom = defineBall<BloomState>({
  id: 'bloom',
  name: 'Bloom',
  description: 'Always regrowing: it heals a little at a time.',
  color: '#f472b6',
  ability: { name: 'Regrowth', shownBy: { kind: 'healed' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 48,
  contactDamage: 21,
  initialAbilityState: { nextHealTick: FIRST_HEAL_TICK },
  hooks: {
    onTick: ({ world, self }) => {
      if (world.tick < self.abilityState.nextHealTick) return [];
      return [
        { kind: 'heal', targetId: self.id, amount: HEAL_AMOUNT },
        { kind: 'setAbilityState', state: { nextHealTick: world.tick + HEAL_EVERY_TICKS } },
      ];
    },
  },
});
