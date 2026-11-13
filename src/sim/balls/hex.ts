import { STANDARD_BALL_RADIUS, TICK_RATE } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState } from '../types.ts';

export type HexState = Readonly<{
  /** The ball its curse is on, or '' for none. */
  cursedId: string;
  /** The tick the curse was laid (for the countdown ring). */
  cursedTick: number;
  /** The mark bursts on this tick. */
  burstTick: number;
}>;

/** A curse bursts this long after the bump that laid it (3 s). */
export const CURSE_FUSE_TICKS = 180;
/** The burst takes this share of the cursed ball's full health. */
export const CURSE_SHARE = 0.25;

/** The burst on a ball of `maxHealth`: CURSE_SHARE of it, rounded, at least 1. */
export function curseBurstFor(maxHealth: number): number {
  return Math.max(1, Math.round(maxHealth * CURSE_SHARE));
}

/** A Hex's curse, read from any ball state (undefined for other balls, or no curse). */
export function hexCurseOf(
  ball: BallState,
):
  | { readonly cursedId: string; readonly cursedTick: number; readonly burstTick: number }
  | undefined {
  const { cursedId, cursedTick, burstTick } = ball.abilityState;
  return typeof cursedId === 'string' &&
    cursedId !== '' &&
    typeof cursedTick === 'number' &&
    typeof burstTick === 'number'
    ? { cursedId, cursedTick, burstTick }
    : undefined;
}

const NO_CURSE: HexState = { cursedId: '', cursedTick: 0, burstTick: 0 };

/**
 * Curses (ADR 0049): its bump marks the enemy, and CURSE_FUSE_TICKS later the mark bursts for
 * CURSE_SHARE of that ball's full health. A bump on a ball already marked does nothing: the
 * countdown keeps running. It works the same on any ball; a big ball takes a big burst because it
 * is big, and a frail one a small burst. The burst is ability damage from its onTick hook, so it is
 * no bump: Thorns' spikes never answer it, and a phased Ghost takes none of it.
 */
export const hex = defineBall<HexState>({
  id: 'hex',
  name: 'Hex',
  description: 'Its bump curses: 3 s later the mark bursts for a quarter of its health.',
  color: '#d946ef',
  ability: { name: 'Curse', shownBy: { kind: 'hookDamage', hook: 'onTick' } },
  howItWorks: [
    `Its bump puts a mark on the other ball. ${String(CURSE_FUSE_TICKS / TICK_RATE)} s later the mark bursts for a quarter of that ball's full health, rounded.`,
    'A bump on a ball already marked does nothing; the countdown keeps running.',
    `So a ${String(80)} health ball takes ${String(curseBurstFor(80))} a burst, a ${String(40)} health one only ${String(curseBurstFor(40))}.`,
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 770,
  maxHealth: 66,
  contactDamage: 15,
  initialAbilityState: NO_CURSE,
  hooks: {
    onHitBall: ({ world, self, other }) => {
      const { cursedId, burstTick } = self.abilityState;
      // A mark already counting down keeps counting: a bump never resets it.
      if (cursedId === other.id && world.tick < burstTick) return [];
      return [
        {
          kind: 'setAbilityState',
          state: {
            cursedId: other.id,
            cursedTick: world.tick,
            burstTick: world.tick + CURSE_FUSE_TICKS,
          },
        },
      ];
    },
    onTick: ({ world, self, maxHealthOf }) => {
      const { cursedId, burstTick } = self.abilityState;
      if (cursedId === '' || world.tick < burstTick) return [];
      const target = world.balls.find((ball) => ball.id === cursedId);
      const clear = { kind: 'setAbilityState' as const, state: NO_CURSE };
      if (target === undefined || target.health <= 0) return [clear];
      return [
        clear,
        { kind: 'damage', targetId: cursedId, amount: curseBurstFor(maxHealthOf(target)) },
      ];
    },
  },
});
