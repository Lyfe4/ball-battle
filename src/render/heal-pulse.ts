// The heal pulse (ADR 0028): one effect for every heal on every ball, driven by `healed` events.
// Pure sizing here; drawn in draw-cues.ts.
import { theme } from './theme.ts';

/** A heal to draw: its fading strength (1 just healed, 0 gone) and how much it restored. */
export interface HealPulse {
  readonly strength: number;
  readonly amount: number;
  readonly maxHealth: number;
}

/**
 * How big a heal looks, from `theme.healMinSize` up to 1: the heal as a share of max health,
 * reaching full size at `theme.healFullShare`. A heal cut by a status restores less, so it simply
 * looks smaller; nothing else marks it (the rule cue says why).
 */
export function healSize(amount: number, maxHealth: number): number {
  if (amount <= 0 || maxHealth <= 0) return 0;
  const share = amount / maxHealth / theme.healFullShare;
  return Math.min(1, Math.max(theme.healMinSize, share));
}
