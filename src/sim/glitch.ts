// The glitch (proposal, ADR 0050 draft): one rule for any ball. While a ball is glitched its
// ability is off and its ability clock stands still. It keeps moving and bumping like a plain ball
// of its stats: none of its hooks run, and what its ability does to its own body falls back to the
// plain ball's (its speed, its bump, its defence, its phasing). Every timer its ability keeps is
// read on the ability clock, so it pauses rather than resets, and its size, which is its body,
// stays as it is. What its ability already put in the world (a shot in flight, a zone, a skull, a
// status on another ball) carries on.
import type { BallState } from './types.ts';

/**
 * Proto switches, set only by the measuring scripts (scripts/bloom-glitch): which way each open
 * question is decided. Defaults are the proposal's.
 */
export const glitchProto = { keepSizeHit: true };

/**
 * True while the ball's ability is switched off by a glitch. The glitch takes hold from the tick
 * after the bump that laid it, so that bump lands in full on both sides (a Vampire still drinks
 * it, Thorns still answer it). Without a tick: whether it carries the status at all.
 */
export function isGlitched(ball: BallState, tick?: number): boolean {
  if (ball.statuses.length === 0) return false;
  const status = ball.statuses.find((candidate) => candidate.kind === 'glitched');
  return status !== undefined && (tick === undefined || status.sinceTick < tick);
}

/**
 * The tick on the ball's ability clock: the match tick less every tick it has spent glitched.
 * Equal to `tick` for a ball that was never glitched, so nothing changes for it.
 */
export function abilityTickOf(ball: BallState, tick: number): number {
  return tick - (ball.abilityPausedTicks ?? 0);
}

/** Every glitched ball's ability clock stands still for one more tick. */
export function pauseGlitchedClocks(balls: readonly BallState[]): readonly BallState[] {
  if (!balls.some(isGlitched)) return balls;
  return balls.map((ball) =>
    isGlitched(ball) ? { ...ball, abilityPausedTicks: (ball.abilityPausedTicks ?? 0) + 1 } : ball,
  );
}
