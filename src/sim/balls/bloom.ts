import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState } from '../types.ts';

export type BloomState = Readonly<{
  /** The last tick it took damage (0 before its first hit): its rest counts from here. */
  lastHitTick: number;
  /** Health regrown since that hit; it stops at REGROW_PER_REST. */
  regrown: number;
}>;

/** Ticks without taking damage before it starts to regrow: its petals open. */
export const CALM_TICKS = 90;
/** Once calm, it heals HEAL_AMOUNT every this many ticks. */
export const HEAL_EVERY_TICKS = 15;
/** Even, so shock (which halves heals, ADR 0009) halves it exactly. */
export const HEAL_AMOUNT = 2;
/** The most it regrows in one rest, before the next hit starts a new one. */
export const REGROW_PER_REST = 6;

/** True when a Bloom that last took damage on `lastHitTick` is calm on `tick`: petals open. */
export function isCalm(lastHitTick: number, tick: number): boolean {
  return tick - lastHitTick >= CALM_TICKS;
}

/** A Bloom's state, read from any ball state (undefined for other balls). */
export function bloomStateOf(ball: BallState): BloomState | undefined {
  const { lastHitTick, regrown } = ball.abilityState;
  return typeof lastHitTick === 'number' && typeof regrown === 'number'
    ? { lastHitTick, regrown }
    : undefined;
}

/**
 * Regrows (ADR 0043): once it has gone CALM_TICKS without taking damage, it heals HEAL_AMOUNT every
 * HEAL_EVERY_TICKS, up to REGROW_PER_REST, and any damage at all starts a new rest. Small hits with
 * time between them are healed back whole; a heavy hit is mostly kept, and a steady drip (poison,
 * fire it stands in) never lets it rest. A heal like any other: shock halves it (ADR 0009).
 */
export const bloom = defineBall<BloomState>({
  id: 'bloom',
  name: 'Bloom',
  description: 'Regrows a little if left alone after a hit; shock halves it.',
  color: '#f472b6',
  ability: { name: 'Regrowth', shownBy: { kind: 'healed' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 760,
  maxHealth: 68,
  contactDamage: 21,
  initialAbilityState: { lastHitTick: 0, regrown: 0 },
  hooks: {
    onTick: ({ world, self, stats }) => {
      const { lastHitTick, regrown } = self.abilityState;
      const calmFor = world.tick - lastHitTick - CALM_TICKS;
      if (calmFor < 0 || calmFor % HEAL_EVERY_TICKS !== 0) return [];
      if (regrown >= REGROW_PER_REST || self.health >= stats.maxHealth) return [];
      return [
        { kind: 'heal', targetId: self.id, amount: HEAL_AMOUNT },
        { kind: 'setAbilityState', state: { lastHitTick, regrown: regrown + HEAL_AMOUNT } },
      ];
    },
    onDamageTaken: ({ world }) => [
      { kind: 'setAbilityState', state: { lastHitTick: world.tick, regrown: 0 } },
    ],
  },
});
