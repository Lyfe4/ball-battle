import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import type { BallState } from '../types.ts';

export type GhostState = Readonly<{
  /** It is faded on every tick before this one (0 before its first hit). */
  fadedUntil: number;
  /** A hit from this tick on fades it again. */
  nextFadeTick: number;
}>;

/** How long it stays faded after a hit. */
export const FADE_TICKS = 56;
/** It fades at most once every this many ticks, counted from the start of a fade. */
export const FADE_EVERY_TICKS = 205;

/** True while a Ghost is faded on `tick`, read from any ball state (false for other balls). */
export function isFaded(ball: BallState, tick: number): boolean {
  const until = ball.abilityState['fadedUntil'];
  return typeof until === 'number' && tick < until;
}

/**
 * Fades (ADR 0045): a hit that lands on it fades it for FADE_TICKS, and while it is faded nothing
 * hurts it, of any kind. It still bumps and is bumped as usual; only the damage misses. It fades at
 * most once every FADE_EVERY_TICKS: a fade that came on every hit was all or nothing against a
 * steady rhythm (it missed every other poison tick, or none), so the wait sets how much of a drip
 * it misses. One big hit lands whole; the small hits just after a hit (the next poison tick, the
 * next burn, the next shockwave, a boomerang's return) miss.
 */
export const ghost = defineBall<GhostState>({
  id: 'ghost',
  name: 'Ghost',
  description: 'Fades for a moment after a hit: nothing hurts it then.',
  color: '#c4b5fd',
  ability: { name: 'Fade', shownBy: { kind: 'hitReduced' } },
  radius: STANDARD_BALL_RADIUS,
  speed: 770,
  maxHealth: 67,
  contactDamage: 24,
  initialAbilityState: { fadedUntil: 0, nextFadeTick: 0 },
  incomingDamageOf: (self, amount, tick) => (tick < self.abilityState.fadedUntil ? 0 : amount),
  hooks: {
    onDamageTaken: ({ world, self }) =>
      world.tick < self.abilityState.nextFadeTick
        ? []
        : [
            {
              kind: 'setAbilityState',
              state: {
                fadedUntil: world.tick + FADE_TICKS,
                nextFadeTick: world.tick + FADE_EVERY_TICKS,
              },
            },
          ],
  },
});
