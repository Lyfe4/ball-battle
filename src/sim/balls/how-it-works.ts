// Numbers for a ball's "How it works" in the manual (ADR 0049), written from the constants its
// ability uses, so the text never goes stale.
import { TICK_RATE } from '../constants.ts';

/** Ticks as the seconds a player reads, to one decimal at most: 105 ticks is "1.8". */
export function secondsOf(ticks: number): string {
  return String(Math.round((ticks / TICK_RATE) * 10) / 10);
}

/** A share as a whole percentage: 0.37 is "37%". */
export function percentOf(share: number): string {
  return `${String(Math.round(share * 100))}%`;
}
