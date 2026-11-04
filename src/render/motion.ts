// Pure curves for battle feel (ADR 0007): squash, shake, the health ghost and the intro. Numbers
// in, numbers out, so each can be unit tested without a canvas.
import type { Vec2 } from '../sim/types.ts';
import { theme } from './theme.ts';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** 0 when an effect starts, 1 when it is over. */
export function progress(startMs: number, nowMs: number, durationMs: number): number {
  return durationMs <= 0 ? 1 : clamp01((nowMs - startMs) / durationMs);
}

/** Quadratic ease-out falloff: 1 at the start, 0 at the end, settling gently. */
const falloff = (p: number): number => (1 - p) * (1 - p);

/**
 * How much a ball is squashed `p` of the way through a squash of `amount`: scale along the
 * impact normal and across it. Area stays roughly constant, so it reads as soft, not shrinking.
 */
export function squashScale(amount: number, p: number): { along: number; across: number } {
  const squash = amount * falloff(clamp01(p));
  return { along: 1 - squash, across: 1 + squash * 0.5 };
}

/**
 * Screen shake offset in world units: two out-of-step sine waves, so it doesn't just slide along
 * one diagonal, decaying to nothing. Never more than the theme's knockout shake. Driven by
 * effect time, so it freezes during a hit-stop and a replay shakes the same way.
 */
export function shakeOffset(amplitude: number, p: number, nowMs: number): Vec2 {
  const size = Math.min(amplitude, theme.shakeKnockoutOffset) * falloff(clamp01(p));
  if (size === 0) return { x: 0, y: 0 };
  const phase = (nowMs / 1000) * theme.shakeHz * Math.PI * 2;
  return { x: size * Math.sin(phase), y: size * Math.sin(phase * 1.31 + 1.7) };
}

/** A ball's health ghost: the health it had before a recent hit, held, then drained. */
export interface GhostEntry {
  /** Health the ghost drains from. */
  readonly from: number;
  /** When it started holding. */
  readonly startMs: number;
}

/**
 * The ghost's health now: `from` during the hold, then easing down to `health` over the drain.
 * Never below the real health, so a heal simply covers it.
 */
export function ghostHealth(entry: GhostEntry | undefined, health: number, nowMs: number): number {
  if (entry === undefined) return health;
  const drain = progress(entry.startMs + theme.ghostHoldMs, nowMs, theme.ghostDrainMs);
  const eased = 1 - falloff(drain);
  return Math.max(health, entry.from + (health - entry.from) * eased);
}

/** True once a ghost has fully drained and can be forgotten. */
export function ghostDone(entry: GhostEntry, nowMs: number): boolean {
  return nowMs >= entry.startMs + theme.ghostHoldMs + theme.ghostDrainMs;
}

/**
 * How a ball looks during the intro: it pops in (grows past full size and settles), the second
 * ball a moment after the first. With reduced motion it fades in instead, at full size.
 */
export function introLook(
  index: number,
  nowMs: number,
  reducedMotion: boolean,
): { scale: number; alpha: number } {
  const p = progress(index * theme.introStaggerMs, nowMs, theme.introPopMs);
  if (reducedMotion) return { scale: 1, alpha: p };
  if (p >= 1) return { scale: 1, alpha: 1 };
  // Rises to 1 + overshoot at 70%, then settles back to 1.
  const peak = 1 + theme.introOvershoot;
  const scale = p < 0.7 ? (p / 0.7) * peak : peak - ((p - 0.7) / 0.3) * theme.introOvershoot;
  return { scale, alpha: clamp01(p * 3) };
}

/**
 * The winner's ring `p` of the way through its pulses: each pulse grows outwards and fades. With
 * reduced motion it is a steady ring that fades out once, without growing.
 */
export function winnerRing(p: number, reducedMotion: boolean): { growth: number; alpha: number } {
  if (p >= 1) return { growth: 0, alpha: 0 };
  if (reducedMotion) return { growth: 0, alpha: 1 - p };
  const pulse = (p * theme.winnerPulses) % 1;
  return { growth: pulse * theme.winnerRingGrowth, alpha: 1 - pulse };
}
